#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const RESEND_API_URL = 'https://api.resend.com'
const TEMPLATE_DOC = path.join(
  process.cwd(),
  'docs/resend-auth-email-templates.md'
)

const ALIASES = {
  RESEND_TEMPLATE_AUTH_RECOVERY: 'copilot-auth-recovery',
  RESEND_TEMPLATE_AUTH_MAGIC_LINK: 'copilot-auth-magic-link',
  RESEND_TEMPLATE_AUTH_SIGNUP: 'copilot-auth-signup',
  RESEND_TEMPLATE_AUTH_INVITE: 'copilot-auth-invite',
  RESEND_TEMPLATE_AUTH_REAUTHENTICATION: 'copilot-auth-reauthentication',
  RESEND_TEMPLATE_AUTH_EMAIL_CHANGE_CURRENT:
    'copilot-auth-email-change-current',
  RESEND_TEMPLATE_AUTH_EMAIL_CHANGE_NEW: 'copilot-auth-email-change-new',
  RESEND_TEMPLATE_AUTH_GENERIC: 'copilot-auth-generic',
}

const VARIABLES = [
  { key: 'action_url', type: 'string', fallbackValue: 'https://example.com' },
  { key: 'otp_code', type: 'string', fallbackValue: '123456' },
  {
    key: 'support_email',
    type: 'string',
    fallbackValue: 'support@example.com',
  },
  { key: 'product_name', type: 'string', fallbackValue: 'Copilot' },
  {
    key: 'recipient_email',
    type: 'string',
    fallbackValue: 'member@example.com',
  },
  {
    key: 'logo_url',
    type: 'string',
    fallbackValue:
      'https://bfm-copilot.vercel.app/images/copilot-logo-gradient-email-v1.png',
  },
]

const resendApiKey = process.env.RESEND_API_KEY
const sender = process.env.AUTH_EMAIL_FROM
const dryRun = process.argv.includes('--dry-run')
let lastResendRequestAt = 0

if (!resendApiKey && !dryRun) {
  console.error('Missing RESEND_API_KEY. Export it before running this script.')
  process.exit(1)
}

const templates = parseTemplates(await readFile(TEMPLATE_DOC, 'utf8'))

if (dryRun) {
  for (const template of templates) {
    console.log(
      `${template.envName}: ${template.alias} | ${template.subject} | ${template.html.length} html chars`
    )
  }
  process.exit(0)
}

const results = []

for (const template of templates) {
  const payload = {
    name: template.title,
    alias: template.alias,
    subject: template.subject,
    html: normalizeResendVariables(template.html),
    variables: VARIABLES,
    ...(sender ? { from: sender } : {}),
  }

  let response = await resendRequest(`/templates/${template.alias}`, {
    method: 'PATCH',
    body: payload,
  })

  if (response.status === 404) {
    response = await resendRequest('/templates', {
      method: 'POST',
      body: payload,
    })
  }

  if (!response.ok) {
    await fail(template.alias, response)
  }

  const data = await response.json()
  const templateId = data.id

  const publishResponse = await resendRequest(
    `/templates/${encodeURIComponent(templateId)}/publish`,
    { method: 'POST' }
  )

  if (!publishResponse.ok) {
    await fail(`${template.alias} publish`, publishResponse)
  }

  results.push({
    envName: template.envName,
    alias: template.alias,
    id: templateId,
  })
}

console.log('\nPublished Resend templates:\n')
for (const result of results) {
  console.log(`${result.envName}=${result.id} # ${result.alias}`)
}

console.log('\nSupabase secrets command:\n')
console.log('supabase secrets set \\')
console.log(
  results
    .map((result, index) => {
      const suffix = index === results.length - 1 ? '' : ' \\'
      return `  ${result.envName}="${result.id}"${suffix}`
    })
    .join('\n')
)

function parseTemplates(markdown) {
  const sections = markdown
    .split(/^## /gm)
    .slice(1)
    .map((section) => `## ${section}`)

  return sections.map((section) => {
    const title = getMatch(section, /^## (.+)$/m, 'title')
    const envName = getMatch(
      section,
      /Environment variable: `([^`]+)`/,
      `${title} env var`
    )
    const subject = getMatch(section, /Subject: `([^`]+)`/, `${title} subject`)
    const html = getMatch(section, /```html\n([\s\S]+?)\n```/, `${title} HTML`)
    const alias = ALIASES[envName]

    if (!alias) {
      throw new Error(`No alias mapping found for ${envName}`)
    }

    return {
      title,
      envName,
      subject,
      html,
      alias,
    }
  })
}

function getMatch(value, pattern, label) {
  const match = value.match(pattern)
  if (!match) {
    throw new Error(`Could not parse ${label}`)
  }

  return match[1].trim()
}

function normalizeResendVariables(html) {
  return html.replace(
    /\{\{(?!\{)\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    '{{{$1}}}'
  )
}

async function resendRequest(resourcePath, init) {
  await throttleResendRequest()

  return fetch(`${RESEND_API_URL}${resourcePath}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'bfm-copilot-auth-email-template-publisher/1.0',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
}

async function throttleResendRequest() {
  const elapsed = Date.now() - lastResendRequestAt
  const delayMs = Math.max(0, 300 - elapsed)
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  lastResendRequestAt = Date.now()
}

async function fail(label, response) {
  const body = await response.text()
  console.error(`Resend request failed for ${label}: ${response.status}`)
  console.error(body)
  process.exit(1)
}
