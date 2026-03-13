import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { DiagnosticEvalReportPdf } from '@/components/diagnostics/DiagnosticEvalReportPdf'
import type { EvalReportData } from '@/components/diagnostics/DiagnosticEvalReportPdf'
import { getPythonAgentUrl } from '@/lib/agent/url'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/diagnostics/[id]/export-pdf
 *
 * Generate and stream a PDF of the full eval report.
 * [id] = diagnostic_analyses.id
 *
 * Body: { report: EvalReportData }
 *   OR: {} (fetches the stored report from the database)
 *
 * Pattern mirrors /api/labs/export-pdf/route.ts
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
    let reportData: EvalReportData | null = body.report ?? null

    if (!reportData) {
      // Fetch stored report from Python agent
      const agentUrl = getPythonAgentUrl()
      const agentRes = await fetch(`${agentUrl}/agent/eval/by-analysis/${analysisId}`)

      if (!agentRes.ok) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }

      const rec = await agentRes.json()
      if (!rec?.report) {
        return NextResponse.json({ error: 'Report not complete' }, { status: 400 })
      }

      // Map snake_case from Python → camelCase for the PDF component
      const r = rec.report
      reportData = _mapToCamelCase(r)
    }

    const pdfBuffer = await renderToBuffer(
      DiagnosticEvalReportPdf({ data: reportData })
    )

    const filename = `bfm-eval-${reportData.patientName.replace(/\s+/g, '-').toLowerCase()}-${reportData.reportDate}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}

/**
 * Map Python snake_case EvalReport fields to TypeScript camelCase EvalReportData.
 * Only needed when fetching from the DB directly (body.report is already camelCase
 * when sent from the frontend component).
 */
function _mapToCamelCase(r: Record<string, unknown>): EvalReportData {
  const urgency = r.urgency as Record<string, unknown>
  return {
    patientName: r.patient_name as string,
    reportDate: r.report_date as string,
    urgency: {
      score: (urgency?.score as number) ?? 0,
      rationale: (urgency?.rationale as string) ?? '',
      timeline: (urgency?.timeline as string) ?? '',
      criticalPath: (urgency?.critical_path as string) ?? '',
    },
    dealBreakers: ((r.deal_breakers as unknown[]) ?? []).map((d: unknown) => {
      const db = d as Record<string, unknown>
      return {
        name: db.name as string,
        finding: db.finding as string,
        protocol: db.protocol as string,
        urgency: db.urgency as string,
        patientDataCitation: db.patient_data_citation as string,
      }
    }),
    frequencyPhases: ((r.frequency_phases as unknown[]) ?? []).map((p: unknown) => {
      const fp = p as Record<string, unknown>
      return {
        phase: fp.phase as number,
        protocolName: fp.protocol_name as string,
        trigger: fp.trigger as string,
        patientDataCitation: fp.patient_data_citation as string,
        sequencingNote: (fp.sequencing_note as string) ?? '',
      }
    }),
    supplementation: ((r.supplementation as unknown[]) ?? []).map((s: unknown) => {
      const sup = s as Record<string, unknown>
      return {
        name: sup.name as string,
        trigger: sup.trigger as string,
        dosage: (sup.dosage as string) ?? '',
        timing: (sup.timing as string) ?? '',
        patientDataCitation: sup.patient_data_citation as string,
        priority: (sup.priority as number) ?? 2,
      }
    }),
    fiveLevers: ((r.five_levers as unknown[]) ?? []).map((l: unknown) => {
      const lv = l as Record<string, unknown>
      return {
        leverNumber: lv.lever_number as number,
        leverName: lv.lever_name as string,
        patientStatus: lv.patient_status as string,
        recommendation: lv.recommendation as string,
        patientDataCitation: lv.patient_data_citation as string,
      }
    }),
    patientAnalogies: ((r.patient_analogies as unknown[]) ?? []).map((a: unknown) => {
      const an = a as Record<string, unknown>
      return {
        finding: an.finding as string,
        analogy: an.analogy as string,
        whatThisMeans: an.what_this_means as string,
        hopefulFraming: an.hopeful_framing as string,
      }
    }),
    monitoring: ((r.monitoring as unknown[]) ?? []).map((m: unknown) => {
      const mo = m as Record<string, unknown>
      return {
        metric: mo.metric as string,
        baseline: mo.baseline as string,
        target: mo.target as string,
        reassessmentInterval: mo.reassessment_interval as string,
      }
    }),
    clinicalSummary: (r.clinical_summary as string) ?? '',
    confidenceNotes: (r.confidence_notes as string) ?? '',
  }
}
