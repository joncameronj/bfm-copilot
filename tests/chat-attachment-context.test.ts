import { describe, expect, it, vi } from 'vitest'

import { buildAttachmentContext } from '@/lib/chat/attachment-context'
import type { DiagnosticType } from '@/types/shared'

function makeBlob(text: string): Blob {
  return new Blob([text], { type: 'application/pdf' })
}

function makeSupabaseMock(options: {
  downloadData?: Blob | null
  downloadError?: unknown
  signedUrl?: string
  signedUrlError?: unknown
}) {
  const download = vi.fn(async () => ({
    data: options.downloadData ?? makeBlob(''),
    error: options.downloadError ?? null,
  }))
  const createSignedUrl = vi.fn(async () => ({
    data: options.signedUrl ? { signedUrl: options.signedUrl } : null,
    error: options.signedUrlError ?? null,
  }))

  return {
    client: {
      storage: {
        from: vi.fn(() => ({
          download,
          createSignedUrl,
        })),
      },
    },
    download,
    createSignedUrl,
  }
}

describe('buildAttachmentContext', () => {
  it('uses embedded text for generic text PDFs without calling vision extraction', async () => {
    const supabase = makeSupabaseMock({
      downloadData: makeBlob('pdf bytes'),
      signedUrl: 'https://example.test/signed.pdf',
    })
    const parsePdfBuffer = vi.fn(async () => ({
      text: 'This PDF has embedded text. '.repeat(20),
      numpages: 2,
    }))
    const extractDiagnosticValues = vi.fn()

    const context = await buildAttachmentContext(
      supabase.client,
      'user-1',
      ['storage:user-1/chat/conv/123-article.pdf'],
      [{ id: 'storage:user-1/chat/conv/123-article.pdf', filename: 'article.pdf', mimeType: 'application/pdf' }],
      { parsePdfBuffer, extractDiagnosticValues }
    )

    expect(context).toContain('text preview')
    expect(context).toContain('This PDF has embedded text.')
    expect(parsePdfBuffer).toHaveBeenCalledTimes(1)
    expect(extractDiagnosticValues).not.toHaveBeenCalled()
    expect(supabase.createSignedUrl).not.toHaveBeenCalled()
  })

  it('uses diagnostic vision extraction for recognized text PDFs', async () => {
    const supabase = makeSupabaseMock({
      downloadData: makeBlob('pdf bytes'),
      signedUrl: 'https://example.test/hrv.pdf',
    })
    const parsePdfBuffer = vi.fn(async () => ({
      text: 'This PDF has embedded text. '.repeat(20),
      numpages: 2,
    }))
    const extractDiagnosticValues = vi.fn(
      async (_url: string, _type: DiagnosticType, _mime?: string) => ({
        success: true,
        data: { findings: ['PSNS switched pattern'] },
        confidence: 0.88,
        rawResponse: '{}',
      })
    )

    const context = await buildAttachmentContext(
      supabase.client,
      'user-1',
      ['storage:user-1/chat/conv/123-hrv.pdf'],
      [{ id: 'storage:user-1/chat/conv/123-hrv.pdf', filename: 'HRV In Office Template.pdf', mimeType: 'application/pdf' }],
      { parsePdfBuffer, extractDiagnosticValues }
    )

    expect(context).toContain('visually extracted as hrv')
    expect(context).toContain('PSNS switched pattern')
    expect(parsePdfBuffer).not.toHaveBeenCalled()
    expect(extractDiagnosticValues).toHaveBeenCalledWith(
      'https://example.test/hrv.pdf',
      'hrv',
      'application/pdf'
    )
  })

  it('falls back to vision extraction for scanned or empty PDFs', async () => {
    const supabase = makeSupabaseMock({
      downloadData: makeBlob('pdf bytes'),
      signedUrl: 'https://example.test/scanned.pdf',
    })
    const parsePdfBuffer = vi.fn(async () => ({ text: '', numpages: 3 }))
    const extractDiagnosticValues = vi.fn(
      async (_url: string, _type: DiagnosticType, _mime?: string) => ({
        success: true,
        data: { findings: ['Patient name visible', 'Lab values are shown'] },
        confidence: 0.91,
        rawResponse: '{}',
      })
    )

    const context = await buildAttachmentContext(
      supabase.client,
      'user-1',
      ['storage:user-1/chat/conv/123-scanned.pdf'],
      [{ id: 'storage:user-1/chat/conv/123-scanned.pdf', filename: 'scanned.pdf', mimeType: 'application/pdf' }],
      { parsePdfBuffer, extractDiagnosticValues }
    )

    expect(context).toContain('had little or no embedded text')
    expect(context).toContain('Visual extraction fallback')
    expect(context).toContain('Patient name visible')
    expect(extractDiagnosticValues).toHaveBeenCalledWith(
      'https://example.test/scanned.pdf',
      'other',
      'application/pdf'
    )
  })

  it('uses vision extraction for image uploads', async () => {
    const supabase = makeSupabaseMock({
      signedUrl: 'https://example.test/photo.png',
    })
    const extractDiagnosticValues = vi.fn(
      async (_url: string, _type: DiagnosticType, _mime?: string) => ({
        success: true,
        data: { findings: ['Screenshot contains a urinalysis strip result'] },
        confidence: 0.84,
        rawResponse: '{}',
      })
    )

    const context = await buildAttachmentContext(
      supabase.client,
      'user-1',
      ['storage:user-1/chat/conv/123-UA.png'],
      [{ id: 'storage:user-1/chat/conv/123-UA.png', filename: 'UA.png', mimeType: 'image/png' }],
      { extractDiagnosticValues }
    )

    expect(context).toContain('visually extracted as urinalysis')
    expect(context).toContain('Screenshot contains a urinalysis strip result')
    expect(context).not.toContain('use the diagnostics upload flow')
    expect(supabase.download).not.toHaveBeenCalled()
  })

  it('skips files outside the authenticated user storage scope', async () => {
    const supabase = makeSupabaseMock({
      downloadData: makeBlob('pdf bytes'),
      signedUrl: 'https://example.test/other.pdf',
    })
    const parsePdfBuffer = vi.fn()
    const extractDiagnosticValues = vi.fn()

    const context = await buildAttachmentContext(
      supabase.client,
      'user-1',
      ['storage:user-2/chat/conv/123-report.pdf'],
      [{ id: 'storage:user-2/chat/conv/123-report.pdf', filename: 'report.pdf', mimeType: 'application/pdf' }],
      { parsePdfBuffer, extractDiagnosticValues }
    )

    expect(context).toContain('skipped due to access scope mismatch')
    expect(supabase.download).not.toHaveBeenCalled()
    expect(supabase.createSignedUrl).not.toHaveBeenCalled()
    expect(extractDiagnosticValues).not.toHaveBeenCalled()
  })

  it('uses a readable timeout fallback when extraction takes too long', async () => {
    const supabase = makeSupabaseMock({
      signedUrl: 'https://example.test/photo.png',
    })
    const extractDiagnosticValues = vi.fn(
      () => new Promise<never>(() => {
        // Intentionally never resolves.
      })
    )

    const context = await buildAttachmentContext(
      supabase.client,
      'user-1',
      ['storage:user-1/chat/conv/123-photo.png'],
      [{ id: 'storage:user-1/chat/conv/123-photo.png', filename: 'photo.png', mimeType: 'image/png' }],
      { extractDiagnosticValues, perFileTimeoutMs: 5, totalTimeoutMs: 20 }
    )

    expect(context).toContain('extraction timed out')
    expect(context).toContain('readable context was not available for this reply')
    expect(context).not.toContain('cannot read')
    expect(context).not.toContain('not able to read')
  })
})
