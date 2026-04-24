import { describe, expect, it } from 'vitest'
import {
  buildAuthEmailMessages,
  buildVerifyUrl,
  normalizeTemplateKey,
} from '../supabase/functions/send-auth-email/template'

const baseOptions = {
  supabaseUrl: 'https://project-ref.supabase.co',
  from: 'Copilot <auth@example.com>',
  replyTo: 'support@example.com',
  supportEmail: 'support@example.com',
  productName: 'Copilot',
}

describe('send-auth-email template routing', () => {
  it('normalizes supported Supabase auth email actions', () => {
    expect(normalizeTemplateKey('recovery')).toBe('recovery')
    expect(normalizeTemplateKey('magiclink')).toBe('magiclink')
    expect(normalizeTemplateKey('magic_link')).toBe('magiclink')
    expect(normalizeTemplateKey('signup')).toBe('signup')
    expect(normalizeTemplateKey('invite')).toBe('invite')
    expect(normalizeTemplateKey('reauthentication')).toBe('reauthentication')
    expect(normalizeTemplateKey('email_change')).toBe('generic')
    expect(normalizeTemplateKey('unknown')).toBe('generic')
  })

  it('builds app verify URLs from token hashes when a redirect origin is available', () => {
    const url = new URL(
      buildVerifyUrl({
        supabaseUrl: 'https://project-ref.supabase.co/',
        tokenHash: 'hash-123',
        type: 'recovery',
        redirectTo: 'https://app.example.com/update-password',
      })
    )

    expect(url.origin).toBe('https://app.example.com')
    expect(url.pathname).toBe('/auth/verify/recovery/hash-123')
    expect(url.searchParams.get('next')).toBeNull()
  })

  it('falls back to direct Supabase verify URLs without an app origin', () => {
    const url = new URL(
      buildVerifyUrl({
        supabaseUrl: 'https://project-ref.supabase.co/',
        tokenHash: 'hash-123',
        type: 'recovery',
      })
    )

    expect(url.origin).toBe('https://project-ref.supabase.co')
    expect(url.pathname).toBe('/auth/v1/verify')
    expect(url.searchParams.get('token_hash')).toBe('hash-123')
  })

  it.each([
    ['recovery', 'recovery', 'Set or reset your Copilot password'],
    ['magiclink', 'magiclink', 'Log in to Copilot'],
    ['signup', 'signup', 'Verify your Copilot email'],
    ['invite', 'invite', 'You have been invited to Copilot'],
    ['reauthentication', 'reauthentication', 'Confirm this Copilot action'],
    ['something_else', 'generic', 'Secure Copilot access link'],
  ])('builds %s email payloads', (action, templateKey, subject) => {
    const [message] = buildAuthEmailMessages({
      ...baseOptions,
      user: { email: 'user@example.com' },
      emailData: {
        email_action_type: action,
        token: '123456',
        token_hash: `${action}-hash`,
        redirect_to: 'https://app.example.com/',
      },
      templateIds: {
        [templateKey]: `template-${templateKey}`,
      },
    })

    expect(message.to).toBe('user@example.com')
    expect(message.subject).toBe(subject)
    expect(message.templateKey).toBe(templateKey)
    expect(message.templateId).toBe(`template-${templateKey}`)
    expect(message.variables).toMatchObject({
      action_url: expect.stringContaining('/auth/verify/'),
      otp_code: '123456',
      support_email: 'support@example.com',
      product_name: 'Copilot',
      recipient_email: 'user@example.com',
      logo_url:
        'https://copilot.energeticdebt.com/images/copilot-logo-gradient-email-v1.png',
    })
    expect(message.html).toContain(
      'https://copilot.energeticdebt.com/images/copilot-logo-gradient-email-v1.png',
    )
  })

  it('maps secure email change token hashes to current and new addresses', () => {
    const messages = buildAuthEmailMessages({
      ...baseOptions,
      user: {
        email: 'current@example.com',
        new_email: 'new@example.com',
      },
      emailData: {
        email_action_type: 'email_change',
        token: '111111',
        token_hash_new: 'current-address-hash',
        token_new: '222222',
        token_hash: 'new-address-hash',
        redirect_to: 'https://app.example.com/settings',
      },
      templateIds: {
        email_change_current: 'template-email-change-current',
        email_change_new: 'template-email-change-new',
      },
    })

    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({
      to: 'current@example.com',
      subject: 'Confirm your current Copilot email',
      templateKey: 'email_change_current',
      templateId: 'template-email-change-current',
    })
    expect(messages[0].variables.otp_code).toBe('111111')
    expect(new URL(messages[0].variables.action_url).pathname).toBe(
      '/auth/verify/email_change/current-address-hash'
    )

    expect(messages[1]).toMatchObject({
      to: 'new@example.com',
      subject: 'Confirm your new Copilot email',
      templateKey: 'email_change_new',
      templateId: 'template-email-change-new',
    })
    expect(messages[1].variables.otp_code).toBe('222222')
    expect(new URL(messages[1].variables.action_url).pathname).toBe(
      '/auth/verify/email_change/new-address-hash'
    )
  })

  it('throws when a secure email change payload omits the new email address', () => {
    expect(() =>
      buildAuthEmailMessages({
        ...baseOptions,
        user: { email: 'current@example.com' },
        emailData: {
          email_action_type: 'email_change',
          token_hash: 'new-address-hash',
        },
      })
    ).toThrow('user.new_email')
  })
})
