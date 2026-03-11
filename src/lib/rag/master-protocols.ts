// Master Protocol Loader
// Lazy singleton that loads all master protocol markdown files inline,
// mirroring the eval agent's _load_master_protocols() pattern.
// This is the approach that produces near-perfect accuracy:
// ground truth inline, not retrieved from a vector store.

import fs from 'fs'
import path from 'path'

let _cachedProtocols: string | null = null

/**
 * Load all master protocol .md files from agent-assets/master-protocols/
 * and return them as a single combined string with file separators.
 *
 * Cached after first call (module-level singleton).
 */
export function loadMasterProtocols(): string {
  if (_cachedProtocols !== null) {
    return _cachedProtocols
  }

  const protocolsDir = path.join(process.cwd(), 'agent-assets', 'master-protocols')

  if (!fs.existsSync(protocolsDir)) {
    throw new Error(
      `Master protocols directory not found: ${protocolsDir}\n` +
      'Run scripts/ingest_master_protocols.py to generate the .md files.'
    )
  }

  const files = fs
    .readdirSync(protocolsDir)
    .filter((f) => f.endsWith('.md'))
    .sort()

  if (files.length === 0) {
    throw new Error(`No .md files found in ${protocolsDir}`)
  }

  const sections = files.map((filename) => {
    const content = fs.readFileSync(path.join(protocolsDir, filename), 'utf-8')
    return `=== ${filename} ===\n${content}`
  })

  _cachedProtocols = sections.join('\n\n')

  console.log(
    `[MasterProtocols] Loaded ${files.length} master protocol files (${_cachedProtocols.length} chars total)`
  )

  return _cachedProtocols
}
