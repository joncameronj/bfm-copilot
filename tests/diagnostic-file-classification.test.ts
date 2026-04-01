import { describe, expect, it } from 'vitest'

import {
  classifyDiagnosticFile,
  reclassifyDiagnosticFileType,
} from '@/lib/diagnostics/file-classification'
import {
  summarizeUploadExtractionStage,
  type DiagnosticFileForExtraction,
} from '@/lib/diagnostics/extraction-pipeline'

function buildFile(
  overrides: Partial<DiagnosticFileForExtraction> = {}
): DiagnosticFileForExtraction {
  return {
    id: 'file-1',
    upload_id: 'upload-1',
    filename: 'Unknown.pdf',
    file_type: 'other',
    mime_type: 'application/pdf',
    storage_path: 'diagnostics/file-1.pdf',
    status: 'uploaded',
    diagnostic_extracted_values: [],
    ...overrides,
  }
}

describe('diagnostic file classification', () => {
  it('classifies opaque LabCorp-style PDFs as blood panels', () => {
    expect(
      classifyDiagnosticFile('HASKINS-TIM-02_10_2026.pdf', 'application/pdf', {
        preferBloodPanelForUnknownReport: true,
      })
    ).toBe('blood_panel')
  })

  it('keeps explicit diagnostic filenames on their known types', () => {
    expect(classifyDiagnosticFile('HRV In Office Template PDF.pdf', 'application/pdf')).toBe('hrv')
    expect(classifyDiagnosticFile('Ortho 2-3-26.pdf', 'application/pdf')).toBe('ortho')
    expect(classifyDiagnosticFile('Valsalva 2-24-26.pdf', 'application/pdf')).toBe('valsalva')
    expect(classifyDiagnosticFile('UA Results 1st Test Results.pdf', 'application/pdf')).toBe('urinalysis')
  })

  it('classifies DePuls files', () => {
    expect(classifyDiagnosticFile('Depuls 2-3-26.pdf', 'application/pdf')).toBe('d_pulse')
    expect(classifyDiagnosticFile('D-Pulse 2-3-26.pdf', 'application/pdf')).toBe('d_pulse')
    expect(classifyDiagnosticFile('DPulse Report.pdf', 'application/pdf')).toBe('d_pulse')
  })

  it('only reclassifies "other" files', () => {
    expect(
      reclassifyDiagnosticFileType('blood_panel', 'HASKINS-TIM-02_10_2026.pdf', 'application/pdf', {
        preferBloodPanelForUnknownReport: true,
      })
    ).toBe('blood_panel')
  })
})

describe('upload extraction stage summary', () => {
  it('treats reclassified lab PDFs without extractions as pending extraction work', () => {
    const summary = summarizeUploadExtractionStage([
      buildFile({ filename: 'HASKINS-TIM-02_10_2026.pdf' }),
    ])

    expect(summary.recognizedFiles).toBe(1)
    expect(summary.pendingFiles).toBe(1)
    expect(summary.processingFiles).toBe(0)
  })

  it('counts successful extraction results for reclassified lab PDFs', () => {
    const summary = summarizeUploadExtractionStage([
      buildFile({
        filename: 'HASKINS-TIM-02_10_2026.pdf',
        diagnostic_extracted_values: [
          {
            id: 'extract-1',
            status: 'complete',
            created_at: new Date().toISOString(),
          },
        ],
      }),
    ])

    expect(summary.recognizedFiles).toBe(1)
    expect(summary.successfulFiles).toBe(1)
    expect(summary.pendingFiles).toBe(0)
  })

  it('treats stale processing records as pending so retries can reclaim them', () => {
    const summary = summarizeUploadExtractionStage([
      buildFile({
        filename: 'HASKINS-TIM-02_10_2026.pdf',
        diagnostic_extracted_values: [
          {
            id: 'extract-1',
            status: 'processing',
            created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
          },
        ],
      }),
    ])

    expect(summary.pendingFiles).toBe(1)
    expect(summary.processingFiles).toBe(0)
  })
})
