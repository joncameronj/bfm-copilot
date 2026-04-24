export type AuthEmailAction =
  | 'recovery'
  | 'magiclink'
  | 'magic_link'
  | 'signup'
  | 'invite'
  | 'email_change'
  | 'reauthentication'
  | string

export type AuthEmailTemplateKey =
  | 'recovery'
  | 'magiclink'
  | 'signup'
  | 'invite'
  | 'email_change_current'
  | 'email_change_new'
  | 'reauthentication'
  | 'generic'

export interface SupabaseAuthHookUser {
  email?: string
  new_email?: string
  user_metadata?: {
    full_name?: string
    name?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface SupabaseAuthEmailData {
  token?: string
  token_hash?: string
  redirect_to?: string
  email_action_type?: AuthEmailAction
  site_url?: string
  token_new?: string
  token_hash_new?: string
  old_email?: string
  [key: string]: unknown
}

export type AuthEmailTemplateIds = Partial<Record<AuthEmailTemplateKey, string>>

export interface BuildAuthEmailMessagesOptions {
  user: SupabaseAuthHookUser
  emailData: SupabaseAuthEmailData
  supabaseUrl: string
  from: string
  replyTo?: string
  supportEmail: string
  productName?: string
  logoUrl?: string
  templateIds?: AuthEmailTemplateIds
}

export interface AuthEmailMessage {
  to: string
  from: string
  replyTo?: string
  subject: string
  text: string
  html: string
  templateId?: string
  variables: Record<string, string>
  templateKey: AuthEmailTemplateKey
}

interface TemplateCopy {
  subject: string
  preheader: string
  headline: string
  body: string
  buttonLabel: string
  aside: string
  showFallbackLink?: boolean
  showOtpCode?: boolean
}

const DEFAULT_PRODUCT_NAME = 'Copilot'
const DEFAULT_LOGO_URL =
  'https://copilot.energeticdebt.com/images/copilot-logo-gradient-email-v1.png'

const COPY: Record<AuthEmailTemplateKey, TemplateCopy> = {
  recovery: {
    subject: 'Set or reset your Copilot password',
    preheader: 'Use this secure link to set or reset your Copilot password.',
    headline: 'Set or reset your password',
    body: 'Use the secure button below to set a new password for your Copilot account.',
    buttonLabel: 'Set password',
    aside:
      'If you did not request this email, you can ignore it. Your account remains protected.',
    showFallbackLink: true,
  },
  magiclink: {
    subject: 'Log in to Copilot',
    preheader: 'Use this secure link to log in to Copilot.',
    headline: 'Log in to Copilot',
    body: 'Use the secure button below to finish signing in to your Copilot account.',
    buttonLabel: 'Log in',
    aside: 'This link is unique to you and should not be forwarded.',
    showFallbackLink: true,
  },
  signup: {
    subject: 'Verify your Copilot email',
    preheader: 'Confirm your email address to finish setting up Copilot.',
    headline: 'Verify your email',
    body: 'Confirm this email address to finish setting up your Copilot account.',
    buttonLabel: 'Verify email',
    aside:
      'If you did not create a Copilot account, you can ignore this email.',
    showFallbackLink: true,
  },
  invite: {
    subject: 'You have been invited to Copilot',
    preheader: 'Accept your Copilot invitation and finish account setup.',
    headline: 'Accept your invitation',
    body: 'You have been invited to Copilot. Use the secure button below to finish account setup.',
    buttonLabel: 'Accept invitation',
    aside: 'This invitation is intended only for the recipient of this email.',
    showFallbackLink: true,
  },
  email_change_current: {
    subject: 'Confirm your current Copilot email',
    preheader: 'Confirm this email address change for your Copilot account.',
    headline: 'Confirm current email',
    body: 'Confirm that this current email address should be changed on your Copilot account.',
    buttonLabel: 'Confirm current email',
    aside: 'If you did not request this change, contact support immediately.',
    showFallbackLink: true,
  },
  email_change_new: {
    subject: 'Confirm your new Copilot email',
    preheader: 'Confirm this new email address for your Copilot account.',
    headline: 'Confirm new email',
    body: 'Confirm that this new email address should be used for your Copilot account.',
    buttonLabel: 'Confirm new email',
    aside:
      'You must confirm both the current and new addresses before the change is complete.',
    showFallbackLink: true,
  },
  reauthentication: {
    subject: 'Confirm this Copilot action',
    preheader: 'Use this code or secure link to confirm your Copilot action.',
    headline: 'Confirm this action',
    body: 'Use the secure button or verification code below to continue.',
    buttonLabel: 'Confirm action',
    aside: 'This confirmation is required before Copilot can continue.',
    showOtpCode: true,
  },
  generic: {
    subject: 'Secure Copilot access link',
    preheader: 'Use this secure link to continue with Copilot.',
    headline: 'Continue to Copilot',
    body: 'Use the secure button below to continue with your Copilot account.',
    buttonLabel: 'Continue',
    aside: 'If you were not expecting this email, you can ignore it.',
    showFallbackLink: true,
  },
}

export function normalizeTemplateKey(
  action?: AuthEmailAction
): AuthEmailTemplateKey {
  switch (action) {
    case 'recovery':
      return 'recovery'
    case 'magiclink':
    case 'magic_link':
      return 'magiclink'
    case 'signup':
      return 'signup'
    case 'invite':
      return 'invite'
    case 'reauthentication':
      return 'reauthentication'
    default:
      return 'generic'
  }
}

export function buildVerifyUrl(params: {
  supabaseUrl: string
  tokenHash?: string
  type?: string
  redirectTo?: string
  siteUrl?: string
}): string {
  const tokenHash = params.tokenHash
  if (!tokenHash) return params.redirectTo || ''

  const appVerifyUrl = buildAppVerifyUrl({ ...params, tokenHash })
  if (appVerifyUrl) return appVerifyUrl

  const url = new URL(
    '/auth/v1/verify',
    ensureTrailingSlash(params.supabaseUrl)
  )
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', params.type || 'signup')

  if (params.redirectTo) {
    url.searchParams.set('redirect_to', params.redirectTo)
  }

  return url.toString()
}

function buildAppVerifyUrl(params: {
  tokenHash: string
  type?: string
  redirectTo?: string
  siteUrl?: string
}): string | null {
  const baseUrl = getAppVerifyBaseUrl(params.redirectTo, params.siteUrl)
  if (!baseUrl) return null

  const actionType = params.type || 'signup'
  const url = new URL(
    `/auth/verify/${encodeURIComponent(actionType)}/${encodeURIComponent(
      params.tokenHash
    )}`,
    baseUrl
  )

  const nextPath = getSameOriginNextPath(baseUrl, params.redirectTo)
  if (nextPath && nextPath !== getDefaultNextPath(actionType)) {
    url.searchParams.set('next', nextPath)
  }

  return url.toString()
}

function getAppVerifyBaseUrl(
  redirectTo?: string,
  siteUrl?: string
): string | null {
  for (const candidate of [redirectTo, siteUrl]) {
    if (!candidate) continue

    try {
      const url = new URL(candidate)
      if (url.protocol === 'https:' || url.hostname === 'localhost') {
        return url.origin
      }
    } catch {
      continue
    }
  }

  return null
}

function getSameOriginNextPath(
  baseUrl: string,
  redirectTo?: string
): string | null {
  if (!redirectTo) return null

  try {
    const base = new URL(baseUrl)
    const redirect = new URL(redirectTo)
    if (redirect.origin !== base.origin) return null

    return `${redirect.pathname}${redirect.search}${redirect.hash}`
  } catch {
    return null
  }
}

function getDefaultNextPath(actionType: string): string {
  switch (actionType) {
    case 'recovery':
    case 'invite':
      return '/update-password'
    case 'email_change':
      return '/settings'
    default:
      return '/'
  }
}

export function buildAuthEmailMessages(
  options: BuildAuthEmailMessagesOptions
): AuthEmailMessage[] {
  if (!options.user.email) {
    throw new Error('Auth email hook payload is missing user.email')
  }

  const actionType = String(options.emailData.email_action_type || 'generic')

  if (actionType === 'email_change') {
    return buildEmailChangeMessages(options)
  }

  const templateKey = normalizeTemplateKey(actionType)
  return [
    buildMessage({
      options,
      to: options.user.email,
      templateKey,
      actionType,
      token: options.emailData.token,
      tokenHash: options.emailData.token_hash,
    }),
  ]
}

function buildEmailChangeMessages(
  options: BuildAuthEmailMessagesOptions
): AuthEmailMessage[] {
  const messages: AuthEmailMessage[] = []
  const newEmail = options.user.new_email

  if (options.emailData.token_hash_new) {
    messages.push(
      buildMessage({
        options,
        to: options.user.email!,
        templateKey: 'email_change_current',
        actionType: 'email_change',
        token: options.emailData.token,
        tokenHash: options.emailData.token_hash_new,
      })
    )
  }

  if (options.emailData.token_hash) {
    if (!newEmail) {
      throw new Error('Email change payload is missing user.new_email')
    }

    messages.push(
      buildMessage({
        options,
        to: newEmail,
        templateKey: 'email_change_new',
        actionType: 'email_change',
        token: options.emailData.token_new || options.emailData.token,
        tokenHash: options.emailData.token_hash,
      })
    )
  }

  if (messages.length === 0) {
    throw new Error('Email change payload is missing token hashes')
  }

  return messages
}

function buildMessage(params: {
  options: BuildAuthEmailMessagesOptions
  to: string
  templateKey: AuthEmailTemplateKey
  actionType: string
  token?: string
  tokenHash?: string
}): AuthEmailMessage {
  const productName = params.options.productName || DEFAULT_PRODUCT_NAME
  const logoUrl = params.options.logoUrl || DEFAULT_LOGO_URL
  const copy = COPY[params.templateKey]
  const actionUrl = buildVerifyUrl({
    supabaseUrl: params.options.supabaseUrl,
    tokenHash: params.tokenHash,
    type: params.actionType,
    redirectTo: params.options.emailData.redirect_to,
    siteUrl: params.options.emailData.site_url,
  })

  const variables = {
    action_url: actionUrl,
    otp_code: params.token || '',
    support_email: params.options.supportEmail,
    product_name: productName,
    recipient_email: params.to,
    logo_url: logoUrl,
  }

  return {
    to: params.to,
    from: params.options.from,
    replyTo: params.options.replyTo,
    subject: copy.subject,
    text: buildTextEmail(copy, variables),
    html: buildHtmlEmail({
      copy,
      variables,
      productName,
    }),
    templateId: params.options.templateIds?.[params.templateKey],
    variables,
    templateKey: params.templateKey,
  }
}

function buildTextEmail(
  copy: TemplateCopy,
  variables: Record<string, string>
): string {
  const lines = [
    copy.headline,
    '',
    copy.body,
    '',
    variables.action_url ? `Secure link: ${variables.action_url}` : '',
    copy.showOtpCode && variables.otp_code
      ? `Verification code: ${variables.otp_code}`
      : '',
    '',
    copy.aside,
    '',
    `Questions? Contact ${variables.support_email}.`,
  ]

  return lines.filter(Boolean).join('\n')
}

function buildHtmlEmail(params: {
  copy: TemplateCopy
  variables: Record<string, string>
  productName: string
}): string {
  const escaped = {
    actionUrl: escapeHtml(params.variables.action_url),
    otpCode: escapeHtml(params.variables.otp_code),
    supportEmail: escapeHtml(params.variables.support_email),
    recipientEmail: escapeHtml(params.variables.recipient_email),
    productName: escapeHtml(params.productName),
    logoUrl: escapeHtml(params.variables.logo_url),
    headline: escapeHtml(params.copy.headline),
    body: escapeHtml(params.copy.body),
    buttonLabel: escapeHtml(params.copy.buttonLabel),
    aside: escapeHtml(params.copy.aside),
    preheader: escapeHtml(params.copy.preheader),
  }

  const button = escaped.actionUrl
    ? `<tr>
                    <td align="center" style="padding:28px 0 0;">
                      <a href="${escaped.actionUrl}" style="display:inline-block;background:#171717;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;line-height:20px;font-weight:400;text-decoration:none;padding:14px 26px;border-radius:8px;">${escaped.buttonLabel}</a>
                    </td>
                  </tr>`
    : ''

  const fallbackLink =
    params.copy.showFallbackLink && escaped.actionUrl
      ? `<tr>
                    <td style="padding:22px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#737373;text-align:center;">
                      If the button does not work, copy and paste this link into your browser:<br>
                      <a href="${escaped.actionUrl}" style="color:#1E42FC;word-break:break-all;text-decoration:none;">${escaped.actionUrl}</a>
                    </td>
                  </tr>`
      : ''

  const otp =
    params.copy.showOtpCode && escaped.otpCode
      ? `<tr>
                    <td align="center" style="padding:18px 0 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;">
                        <tr>
                          <td style="padding:14px 18px;font-family:'Courier New',Courier,monospace;font-size:28px;line-height:34px;letter-spacing:5px;color:#171717;text-align:center;">${escaped.otpCode}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>`
      : ''

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escaped.headline}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escaped.preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:650px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;">
            <tr>
              <td align="center" style="padding:28px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <img src="${escaped.logoUrl}" width="180" height="44" alt="${escaped.productName}" style="display:block;width:180px;max-width:70%;height:auto;border:0;">
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#f5f5f5;border-radius:18px;">
                        <tr>
                          <td style="padding:38px 32px;text-align:center;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="font-family:Arial,sans-serif;font-size:26px;line-height:32px;font-weight:400;color:#171717;text-align:center;">${escaped.headline}</td>
                              </tr>
                              <tr>
                                <td style="padding-top:14px;font-family:Arial,sans-serif;font-size:16px;line-height:25px;color:#525252;text-align:center;">${escaped.body}</td>
                              </tr>
                              ${button}
                              ${otp}
                              ${fallbackLink}
                              <tr>
                                <td style="padding-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#737373;text-align:center;">${escaped.aside}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px 12px 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#737373;text-align:center;">
                      Sent to ${escaped.recipientEmail}<br>
                      Need help? <a href="mailto:${escaped.supportEmail}" style="color:#1E42FC;text-decoration:none;">${escaped.supportEmail}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
