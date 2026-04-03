import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Webhook Route Handler Tests ──

// Mock verify-signature BEFORE importing the route
const mockVerify = vi.fn()

vi.mock('@/lib/whop/verify-signature', () => ({
  verifyWhopWebhook: (...args: unknown[]) => mockVerify(...args),
  WebhookVerificationError: class WebhookVerificationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'WebhookVerificationError'
    }
  },
}))

// Mock Supabase admin client
const mockFrom = vi.fn()
const mockAuth = {
  admin: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
    generateLink: vi.fn(),
  },
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    auth: mockAuth,
  }),
}))

// Now import the route (uses mocked deps)
const { POST } = await import('@/app/api/webhooks/whop/route')

function makeRequest(body: object): Request {
  return new Request('http://localhost:3000/api/webhooks/whop', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeWhopPayload(
  action: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    action,
    data: {
      id: 'mem_test123',
      product: { id: 'prod_copilot' },
      user: {
        id: 'usr_whop123',
        email: 'test@example.com',
        name: 'Test User',
      },
      ...overrides,
    },
  }
}

// Build a chainable Supabase query mock
function mockQuery(returnData: unknown = null, error: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const resolve = () => Promise.resolve({ data: returnData, error })

  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockImplementation(() => resolve())
  chain.update = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.neq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockImplementation(() => resolve())

  return chain
}

describe('POST /api/webhooks/whop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv('WHOP_COPILOT_PRODUCT_IDS', 'prod_copilot')
    vi.stubEnv('WHOP_WEBHOOK_SECRET', 'whsec_test')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://copilot.example.com')

    // Default: verify passes and returns parsed JSON
    mockVerify.mockImplementation((body: string) => JSON.parse(body))
  })

  it('returns 401 for invalid signature', async () => {
    mockVerify.mockImplementation(() => {
      const err = new Error('Invalid webhook signature')
      err.name = 'WebhookVerificationError'
      throw err
    })

    const response = await POST(makeRequest({ action: 'test' }))
    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid payload structure', async () => {
    const response = await POST(
      makeRequest({ action: 'test', data: { missing: 'fields' } })
    )
    expect(response.status).toBe(400)
  })

  it('ignores non-Copilot product webhooks', async () => {
    const payload = makeWhopPayload('membership.activated')
    // Override product to non-copilot
    ;(payload.data as Record<string, unknown>).product = { id: 'prod_other' }

    const response = await POST(makeRequest(payload))
    const json = await response.json()
    expect(json.status).toBe('ignored')
    expect(json.reason).toBe('non-copilot product')
  })

  it('acknowledges unknown event types', async () => {
    const payload = makeWhopPayload('membership.updated')
    const response = await POST(makeRequest(payload))
    const json = await response.json()
    expect(json.status).toBe('ignored')
  })

  describe('membership.activated', () => {
    it('returns already_processed for duplicate webhook', async () => {
      const subQuery = mockQuery({ id: 'existing-sub-id' })
      mockFrom.mockReturnValue(subQuery)

      const payload = makeWhopPayload('membership.activated')
      const response = await POST(makeRequest(payload))
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.status).toBe('already_processed')
    })

    it('creates new user for unknown email', async () => {
      // 1st call: whop_subscriptions check (no existing)
      const noSubQuery = mockQuery(null)
      // profile select after create
      const profileSelectQuery = mockQuery({ id: 'uuid-new' })
      // profile update
      const profileUpdateQuery = mockQuery(null)
      // subscription insert
      const subInsertQuery = mockQuery(null)

      let callIndex = 0
      mockFrom.mockImplementation((table: string) => {
        callIndex++
        if (callIndex === 1) return noSubQuery // whop_subscriptions check
        if (table === 'profiles') return callIndex <= 3 ? profileSelectQuery : profileUpdateQuery
        return subInsertQuery // whop_subscriptions insert
      })

      mockAuth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      })
      mockAuth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'uuid-new' } },
        error: null,
      })
      mockAuth.admin.generateLink.mockResolvedValue({
        data: {},
        error: null,
      })

      const payload = makeWhopPayload('membership.activated')
      const response = await POST(makeRequest(payload))
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.status).toBe('ok')
      expect(mockAuth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          email_confirm: true,
        })
      )
      expect(mockAuth.admin.generateLink).toHaveBeenCalledWith({
        type: 'recovery',
        email: 'test@example.com',
        options: {
          redirectTo: 'https://copilot.example.com/update-password',
        },
      })
    })

    it('reactivates inactive user without creating new account', async () => {
      const noSubQuery = mockQuery(null)
      const profileQuery = mockQuery({ role: 'member', status: 'inactive' })
      const profileUpdateQuery = mockQuery(null)
      const subInsertQuery = mockQuery(null)

      let callIndex = 0
      mockFrom.mockImplementation((table: string) => {
        callIndex++
        if (callIndex === 1) return noSubQuery
        if (table === 'profiles') return callIndex <= 2 ? profileQuery : profileUpdateQuery
        return subInsertQuery
      })

      mockAuth.admin.listUsers.mockResolvedValue({
        data: {
          users: [{ id: 'uuid-existing', email: 'test@example.com' }],
        },
        error: null,
      })

      const payload = makeWhopPayload('membership.activated')
      const response = await POST(makeRequest(payload))

      expect(response.status).toBe(200)
      expect(mockAuth.admin.createUser).not.toHaveBeenCalled()
    })

    it('does not change role for existing practitioner', async () => {
      const noSubQuery = mockQuery(null)
      const profileQuery = mockQuery({ role: 'practitioner', status: 'active' })
      const profileUpdateChain = mockQuery(null)
      const subInsertQuery = mockQuery(null)

      let callIndex = 0
      mockFrom.mockImplementation((table: string) => {
        callIndex++
        if (callIndex === 1) return noSubQuery
        if (table === 'profiles') return callIndex <= 2 ? profileQuery : profileUpdateChain
        return subInsertQuery
      })

      mockAuth.admin.listUsers.mockResolvedValue({
        data: {
          users: [{ id: 'uuid-pract', email: 'test@example.com' }],
        },
        error: null,
      })

      const payload = makeWhopPayload('membership.activated')
      const response = await POST(makeRequest(payload))

      expect(response.status).toBe(200)
      // The update call should NOT include a role field
      if (profileUpdateChain.update.mock.calls.length > 0) {
        const updateArg = profileUpdateChain.update.mock.calls[0][0]
        expect(updateArg).not.toHaveProperty('role')
      }
    })
  })

  describe('membership.deactivated', () => {
    it('deactivates member with no other active subscriptions', async () => {
      const findSubQuery = mockQuery({ id: 'sub-123', profile_id: 'uuid-member' })
      const updateSubQuery = mockQuery(null)
      const activeSubsQuery = mockQuery([]) // neq chain returns empty array
      // Override: neq returns the resolved value directly
      activeSubsQuery.neq = vi.fn().mockResolvedValue({ data: [], error: null })
      const profileQuery = mockQuery({ role: 'member' })
      const deactivateQuery = mockQuery(null)

      let callIndex = 0
      mockFrom.mockImplementation((table: string) => {
        callIndex++
        if (table === 'whop_subscriptions') {
          if (callIndex === 1) return findSubQuery
          if (callIndex === 2) return updateSubQuery
          return activeSubsQuery
        }
        if (table === 'profiles') {
          return callIndex <= 4 ? profileQuery : deactivateQuery
        }
        return mockQuery(null)
      })

      const payload = makeWhopPayload('membership.deactivated')
      const response = await POST(makeRequest(payload))
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.status).toBe('ok')
    })

    it('returns not_found for unknown membership', async () => {
      mockFrom.mockReturnValue(mockQuery(null))

      const payload = makeWhopPayload('membership.deactivated')
      const response = await POST(makeRequest(payload))
      const json = await response.json()

      expect(json.status).toBe('not_found')
    })
  })
})
