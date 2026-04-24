import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import {
  buildAuthEmailMessages,
  type AuthEmailTemplateIds,
  type SupabaseAuthEmailData,
  type SupabaseAuthHookUser,
} from './template.ts'

interface SupabaseAuthEmailHookPayload {
  user: SupabaseAuthHookUser
  email_data: SupabaseAuthEmailData
}

const RESEND_EMAILS_URL = 'https://api.resend.com/emails'

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') || Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')

  if (!resendApiKey || !hookSecret || !supabaseUrl) {
    return jsonResponse(
      {
        error:
          'Missing RESEND_API_KEY, SEND_EMAIL_HOOK_SECRET, or SUPABASE_URL',
      },
      500
    )
  }

  const rawBody = await request.text()
  const headers = Object.fromEntries(request.headers)

  let payload: SupabaseAuthEmailHookPayload
  try {
    const secret = hookSecret.replace(/^v1,whsec_/, '')
    payload = new Webhook(secret).verify(
      rawBody,
      headers
    ) as SupabaseAuthEmailHookPayload
  } catch (error) {
    console.error('Auth email hook verification failed:', error)
    return jsonResponse({ error: 'Invalid hook signature' }, 401)
  }

  try {
    const messages = buildAuthEmailMessages({
      user: payload.user,
      emailData: payload.email_data,
      supabaseUrl,
      from:
        Deno.env.get('AUTH_EMAIL_FROM') || 'Copilot <onboarding@resend.dev>',
      replyTo: Deno.env.get('AUTH_EMAIL_REPLY_TO') || undefined,
      supportEmail:
        Deno.env.get('AUTH_SUPPORT_EMAIL') || 'support@cliniccopilot.com',
      productName: Deno.env.get('AUTH_PRODUCT_NAME') || 'Copilot',
      logoUrl:
        Deno.env.get('AUTH_EMAIL_LOGO_URL') ||
        'https://copilot.energeticdebt.com/images/copilot-logo-gradient-email-v1.png',
      templateIds: readTemplateIds(),
    })

    for (const message of messages) {
      const error = await sendResendEmail(resendApiKey, message)
      if (error) {
        console.error('Resend auth email failed:', error)
        return jsonResponse({ error }, 502)
      }
    }

    return jsonResponse({}, 200)
  } catch (error) {
    console.error('Auth email hook failed:', error)
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Failed to send auth email',
      },
      400
    )
  }
})

async function sendResendEmail(
  apiKey: string,
  message: ReturnType<typeof buildAuthEmailMessages>[number]
): Promise<string | null> {
  const body = message.templateId
    ? {
        from: message.from,
        to: [message.to],
        subject: message.subject,
        reply_to: message.replyTo,
        template: {
          id: message.templateId,
          variables: message.variables,
        },
      }
    : {
        from: message.from,
        to: [message.to],
        subject: message.subject,
        reply_to: message.replyTo,
        html: message.html,
        text: message.text,
      }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(removeUndefined(body)),
  })

  if (response.ok) return null

  const responseText = await response.text()
  return responseText || `Resend returned ${response.status}`
}

function readTemplateIds(): AuthEmailTemplateIds {
  return {
    recovery: Deno.env.get('RESEND_TEMPLATE_AUTH_RECOVERY') || undefined,
    magiclink: Deno.env.get('RESEND_TEMPLATE_AUTH_MAGIC_LINK') || undefined,
    signup: Deno.env.get('RESEND_TEMPLATE_AUTH_SIGNUP') || undefined,
    invite: Deno.env.get('RESEND_TEMPLATE_AUTH_INVITE') || undefined,
    email_change_current:
      Deno.env.get('RESEND_TEMPLATE_AUTH_EMAIL_CHANGE_CURRENT') || undefined,
    email_change_new:
      Deno.env.get('RESEND_TEMPLATE_AUTH_EMAIL_CHANGE_NEW') || undefined,
    reauthentication:
      Deno.env.get('RESEND_TEMPLATE_AUTH_REAUTHENTICATION') || undefined,
    generic: Deno.env.get('RESEND_TEMPLATE_AUTH_GENERIC') || undefined,
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUndefined)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, removeUndefined(entryValue)])
  )
}
