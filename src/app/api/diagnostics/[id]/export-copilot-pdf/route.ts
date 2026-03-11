import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { CopilotReportPdf } from '@/components/diagnostics/CopilotReportPdf'
import type { CopilotReportPdfData } from '@/components/diagnostics/CopilotReportPdf'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Cache the logo base64 string
let logoBase64Cache: string | undefined

function getLogoBase64(): string | undefined {
  if (logoBase64Cache) return logoBase64Cache
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'copilot-logo-gradient.svg')
    const svgContent = fs.readFileSync(logoPath, 'utf-8')
    logoBase64Cache = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`
    return logoBase64Cache
  } catch {
    return undefined
  }
}

/**
 * POST /api/diagnostics/[id]/export-copilot-pdf
 *
 * Generate a PDF from the CoPilot analysis data (no Python agent call).
 * Body: { patientName, analysisDate, summary, protocols, supplementation }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: analysisId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns this analysis
    const { data: analysis } = await supabase
      .from('diagnostic_analyses')
      .select('id, practitioner_id')
      .eq('id', analysisId)
      .maybeSingle()

    if (!analysis || analysis.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const reportData: CopilotReportPdfData = {
      patientName: body.patientName,
      analysisDate: body.analysisDate,
      summary: body.summary,
      protocols: body.protocols,
      supplementation: body.supplementation,
      logoBase64: getLogoBase64(),
    }

    const pdfBuffer = await renderToBuffer(
      CopilotReportPdf({ data: reportData })
    )

    const filename = `bfm-copilot-${reportData.patientName.replace(/\s+/g, '-').toLowerCase()}-${reportData.analysisDate}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('CoPilot PDF export error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
