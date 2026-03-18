import { Webhook } from 'standardwebhooks'

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookVerificationError'
  }
}

/**
 * Verify a Whop webhook using Standard Webhooks spec.
 * Returns the parsed payload if valid, throws WebhookVerificationError if not.
 */
export function verifyWhopWebhook(
  body: string,
  headers: Record<string, string>
): unknown {
  const secret = process.env.WHOP_WEBHOOK_SECRET

  if (!secret) {
    throw new WebhookVerificationError('WHOP_WEBHOOK_SECRET is not configured')
  }

  const wh = new Webhook(secret)

  try {
    return wh.verify(body, headers)
  } catch {
    throw new WebhookVerificationError('Invalid webhook signature')
  }
}
