import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Webhook } from 'standardwebhooks'
import {
  verifyWhopWebhook,
  WebhookVerificationError,
} from '@/lib/whop/verify-signature'

describe('verifyWhopWebhook', () => {
  const TEST_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'

  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('WHOP_WEBHOOK_SECRET', TEST_SECRET)
  })

  function signPayload(body: string) {
    const wh = new Webhook(TEST_SECRET)
    const msgId = 'msg_test123'
    const timestamp = new Date()
    const signature = wh.sign(msgId, timestamp, body)

    return {
      'webhook-id': msgId,
      'webhook-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
      'webhook-signature': signature,
    }
  }

  it('returns parsed payload for valid signature', () => {
    const body = JSON.stringify({ action: 'membership.activated', data: {} })
    const headers = signPayload(body)

    const result = verifyWhopWebhook(body, headers)
    expect(result).toEqual(JSON.parse(body))
  })

  it('throws WebhookVerificationError for invalid signature', () => {
    const body = JSON.stringify({ action: 'test' })
    const headers = {
      'webhook-id': 'msg_bad',
      'webhook-timestamp': Math.floor(Date.now() / 1000).toString(),
      'webhook-signature': 'v1,invalidsignature==',
    }

    expect(() => verifyWhopWebhook(body, headers)).toThrow(
      WebhookVerificationError
    )
  })

  it('throws when WHOP_WEBHOOK_SECRET is empty', () => {
    vi.stubEnv('WHOP_WEBHOOK_SECRET', '')

    expect(() => verifyWhopWebhook('{}', {})).toThrow(
      WebhookVerificationError
    )
  })

  it('throws when WHOP_WEBHOOK_SECRET is not set', () => {
    delete process.env.WHOP_WEBHOOK_SECRET

    expect(() => verifyWhopWebhook('{}', {})).toThrow(
      'WHOP_WEBHOOK_SECRET is not configured'
    )
  })
})
