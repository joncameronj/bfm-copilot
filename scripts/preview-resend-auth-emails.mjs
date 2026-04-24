#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const TEMPLATE_DOC = path.join(
  process.cwd(),
  'docs/resend-auth-email-templates.md'
)
const OUTPUT_FILE = path.join(process.cwd(), 'docs/auth-email-preview.html')

const variables = {
  action_url:
    'https://copilot.energeticdebt.com/auth/verify/recovery/sample-token-hash',
  otp_code: '123456',
  support_email: 'support@beyondfunctionalmedicine.com',
  product_name: 'Copilot',
  recipient_email: 'joncameronj@gmail.com',
  logo_url: 'https://copilot.energeticdebt.com/images/copilot-logo-gradient-email-v1.png',
}

const templates = parseTemplates(await readFile(TEMPLATE_DOC, 'utf8'))

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
await writeFile(OUTPUT_FILE, buildPreviewPage(templates), 'utf8')

console.log(`Generated ${OUTPUT_FILE}`)

function parseTemplates(markdown) {
  const sections = markdown
    .split(/^## /gm)
    .slice(1)
    .map((section) => `## ${section}`)

  return sections.map((section) => ({
    title: getMatch(section, /^## (.+)$/m, 'title'),
    envName: getMatch(
      section,
      /Environment variable: `([^`]+)`/,
      'environment variable'
    ),
    subject: getMatch(section, /Subject: `([^`]+)`/, 'subject'),
    html: renderTemplate(
      getMatch(section, /```html\n([\s\S]+?)\n```/, 'HTML template')
    ),
  }))
}

function renderTemplate(html) {
  return html.replace(
    /\{\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}\}/g,
    (_, key) => variables[key] ?? ''
  )
}

function buildPreviewPage(templates) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Copilot Auth Email Preview</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, sans-serif;
        background: #f4f4f5;
        color: #171717;
      }

      body {
        margin: 0;
      }

      header {
        padding: 28px 32px 18px;
        background: #ffffff;
        border-bottom: 1px solid #e5e5e5;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 24px;
        line-height: 32px;
        font-weight: 600;
      }

      p {
        margin: 0;
        color: #525252;
      }

      main {
        display: grid;
        gap: 28px;
        padding: 28px 32px 40px;
      }

      section {
        background: #ffffff;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        overflow: hidden;
      }

      .meta {
        padding: 16px 18px;
        border-bottom: 1px solid #e5e5e5;
      }

      h2 {
        margin: 0 0 6px;
        font-size: 16px;
        line-height: 22px;
      }

      dl {
        display: grid;
        gap: 4px;
        margin: 0;
        color: #525252;
        font-size: 13px;
        line-height: 18px;
      }

      dt {
        display: inline;
        font-weight: 600;
      }

      dd {
        display: inline;
        margin: 0;
      }

      iframe {
        display: block;
        width: 100%;
        height: 760px;
        border: 0;
        background: #ffffff;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Copilot Auth Email Preview</h1>
      <p>Sample render of every production auth email template.</p>
    </header>
    <main>
      ${templates.map(buildTemplatePreview).join('\n')}
    </main>
  </body>
</html>`
}

function buildTemplatePreview(template) {
  return `<section>
        <div class="meta">
          <h2>${escapeHtml(template.title)}</h2>
          <dl>
            <div><dt>Subject:</dt> <dd>${escapeHtml(template.subject)}</dd></div>
            <div><dt>Secret:</dt> <dd>${escapeHtml(template.envName)}</dd></div>
          </dl>
        </div>
        <iframe title="${escapeHtml(template.title)}" srcdoc="${escapeAttribute(template.html)}"></iframe>
      </section>`
}

function getMatch(value, pattern, label) {
  const match = value.match(pattern)
  if (!match) {
    throw new Error(`Could not parse ${label}`)
  }

  return match[1].trim()
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/\n/g, '&#10;')
}
