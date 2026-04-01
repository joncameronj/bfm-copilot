import type { DiagnosticType } from '@/types/shared'

export interface DiagnosticClassificationOptions {
  preferBloodPanelForUnknownReport?: boolean
}

const BLOOD_PANEL_HINTS = [
  'labcorp',
  'quest',
  'blood',
  'labs',
  'panel',
  'cbc',
  'cmp',
  'bmp',
  'metabolic',
  'lipid',
  'thyroid',
  'chemistry',
  'comprehensive',
  'ferritin',
  'glucose',
  'insulin',
  'a1c',
  'hba1c',
]

const GENERIC_REPORT_HINTS = ['result', 'results', 'report', 'final report']

function normalizeFilename(filename: string): string {
  return filename.toLowerCase().trim()
}

function hasAnyKeyword(filename: string, keywords: string[]): boolean {
  return keywords.some((keyword) => filename.includes(keyword))
}

function hasDelimitedToken(filename: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[\\s._-])${escaped}(?:$|[\\s._-])`).test(filename)
}

function isPdfOrImage(filename: string, mimeType?: string | null): boolean {
  const lowerMime = mimeType?.toLowerCase() || ''
  const lowerFilename = normalizeFilename(filename)

  return (
    lowerMime === 'application/pdf' ||
    lowerMime.startsWith('image/') ||
    lowerFilename.endsWith('.pdf') ||
    lowerFilename.endsWith('.png') ||
    lowerFilename.endsWith('.jpg') ||
    lowerFilename.endsWith('.jpeg') ||
    lowerFilename.endsWith('.heic') ||
    lowerFilename.endsWith('.webp')
  )
}

function isOpaquePatientStyleLabFilename(filename: string): boolean {
  const stem = normalizeFilename(filename).replace(/\.[^.]+$/, '')
  const hasDate = /\d{1,2}[-_]\d{1,2}[-_]\d{2,4}/.test(stem)
  const hasPatientNamePattern = /[a-z]{3,}[-_][a-z]{2,}(?:[-_][a-z]{2,})?[-_]\d/.test(stem)
  const tokenCount = stem.split(/[-_\s]+/).filter(Boolean).length

  return hasDate && hasPatientNamePattern && tokenCount >= 3
}

export function classifyDiagnosticFile(
  filename: string,
  mimeType?: string | null,
  options: DiagnosticClassificationOptions = {}
): DiagnosticType {
  const lower = normalizeFilename(filename)

  if (hasAnyKeyword(lower, ['pulse', 'dpulse', 'depuls', 'd-pulse', 'd pulse'])) return 'd_pulse'
  if (hasAnyKeyword(lower, ['hrv'])) return 'hrv'
  if (hasAnyKeyword(lower, ['ortho'])) return 'ortho'
  if (hasAnyKeyword(lower, ['valsalva'])) return 'valsalva'
  if (hasAnyKeyword(lower, ['urinalysis', 'urine']) || hasDelimitedToken(lower, 'ua')) return 'urinalysis'
  if (hasAnyKeyword(lower, ['vcs', 'visual contrast'])) return 'vcs'
  if (hasAnyKeyword(lower, ['brainwave', 'eeg', 'qeeg'])) return 'brainwave'
  if (hasAnyKeyword(lower, ['nes', 'nes scan'])) return 'nes_scan'
  if (hasAnyKeyword(lower, ['mold', 'mycotox'])) return 'mold_toxicity'

  if (hasAnyKeyword(lower, BLOOD_PANEL_HINTS) || hasDelimitedToken(lower, 'lab')) return 'blood_panel'

  if (
    options.preferBloodPanelForUnknownReport &&
    isPdfOrImage(filename, mimeType) &&
    (
      isOpaquePatientStyleLabFilename(filename) ||
      hasAnyKeyword(lower, GENERIC_REPORT_HINTS)
    )
  ) {
    return 'blood_panel'
  }

  return 'other'
}

export function reclassifyDiagnosticFileType(
  currentType: DiagnosticType,
  filename: string,
  mimeType?: string | null,
  options: DiagnosticClassificationOptions = {}
): DiagnosticType {
  if (currentType !== 'other') {
    return currentType
  }

  return classifyDiagnosticFile(filename, mimeType, options)
}
