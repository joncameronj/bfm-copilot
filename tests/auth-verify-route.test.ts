import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

const { GET } = await import('@/app/auth/verify/[type]/[tokenHash]/route')

function makeRequest(url: string) {
  return new NextRequest(url)
}

function makeContext(type: string | undefined, tokenHash: string | undefined) {
  return {
    params: Promise.resolve({ type, tokenHash }),
  }
}

describe('GET /auth/verify/[type]/[tokenHash]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue({
      auth: {
        verifyOtp: mocks.verifyOtp,
      },
    })
    mocks.verifyOtp.mockResolvedValue({ data: {}, error: null })
  })

  it('exchanges a recovery token hash server-side and redirects to password setup', async () => {
    const response = await GET(
      makeRequest('http://localhost:3005/auth/verify/recovery/hash-123'),
      makeContext('recovery', 'hash-123')
    )

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      type: 'recovery',
      token_hash: 'hash-123',
    })
    expect(response.headers.get('location')).toBe(
      'http://localhost:3005/update-password'
    )
  })

  it('keeps same-origin next redirects after a valid token exchange', async () => {
    const response = await GET(
      makeRequest(
        'http://localhost:3005/auth/verify/email_change/hash-123?next=/settings?tab=security'
      ),
      makeContext('email_change', 'hash-123')
    )

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      type: 'email_change',
      token_hash: 'hash-123',
    })
    expect(response.headers.get('location')).toBe(
      'http://localhost:3005/settings?tab=security'
    )
  })

  it('rejects unsupported auth link types before calling Supabase', async () => {
    const response = await GET(
      makeRequest('http://localhost:3005/auth/verify/not-real/hash-123'),
      makeContext('not-real', 'hash-123')
    )

    expect(mocks.verifyOtp).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'http://localhost:3005/login?error=auth_link_invalid'
    )
  })

  it('sends failed recovery links back to the reset form', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mocks.verifyOtp.mockResolvedValue({
      data: {},
      error: new Error('expired token'),
    })

    const response = await GET(
      makeRequest('http://localhost:3005/auth/verify/recovery/hash-123'),
      makeContext('recovery', 'hash-123')
    )

    expect(response.headers.get('location')).toBe(
      'http://localhost:3005/reset-password?error=auth_link_invalid'
    )
    consoleErrorSpy.mockRestore()
  })
})
