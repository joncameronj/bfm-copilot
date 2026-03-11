'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert01Icon,
  Cancel01Icon,
  Download01Icon,
  Loading03Icon,
  PillIcon,
  PrinterIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import type { Supplementation } from '@/types/diagnostic-analysis'

const LAYER_CARDS: Record<number, { label: string; accent: string; bg: string; border: string }> = {
  1: { label: 'Layer 1 — High Priorities', accent: 'text-red-800', bg: 'bg-red-50', border: 'border-red-200' },
  2: { label: 'Layer 2 — Next If No Response', accent: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  3: { label: 'Layer 3 — If They Are Still Stuck', accent: 'text-neutral-700', bg: 'bg-neutral-50', border: 'border-neutral-200' },
}

// Eval report sub-types for rich display
export interface EvalReportDisplay {
  urgency?: { score: number; rationale: string; timeline: string; critical_path: string }
  deal_breakers?: Array<{ name: string; finding: string; protocol: string; urgency: string; patient_data_citation: string }>
  five_levers?: Array<{ lever_number: number; lever_name: string; patient_status: string; recommendation: string; patient_data_citation: string }>
  patient_analogies?: Array<{ finding: string; analogy: string; what_this_means: string; hopeful_framing: string }>
  monitoring?: Array<{ metric: string; baseline: string; target: string; reassessment_interval: string }>
  confidence_notes?: string
}

export interface CopilotReportData {
  patientName: string
  analysisDate: string
  summary: string
  protocols: Array<{
    title: string
    category: string
    priority: number
    layer: number
    frequencies: Array<{
      name: string
      rationale?: string
      diagnosticTrigger?: string
    }>
  }>
  supplementation: Supplementation[]
  evalReport?: EvalReportDisplay
}

interface CopilotReportModalProps {
  data: CopilotReportData
  diagnosticAnalysisId: string
  onClose: () => void
}

export function CopilotReportModal({
  data,
  diagnosticAnalysisId,
  onClose,
}: CopilotReportModalProps) {
  const [downloading, setDownloading] = useState(false)

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/diagnostics/${diagnosticAnalysisId}/export-copilot-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bfm-copilot-${data.patientName.replace(/\s+/g, '-').toLowerCase()}-${data.analysisDate}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Group protocols by layer
  const protocolsByLayer: Record<number, typeof data.protocols> = {}
  for (const p of data.protocols) {
    const layer = p.layer || 1
    if (!protocolsByLayer[layer]) protocolsByLayer[layer] = []
    protocolsByLayer[layer].push(p)
  }
  const layers = Object.keys(protocolsByLayer).map(Number).sort()

  // Group supplements by layer
  const supplementsByLayer: Record<number, Supplementation[]> = {}
  for (const s of data.supplementation) {
    const layer = s.layer ?? 1
    if (!supplementsByLayer[layer]) supplementsByLayer[layer] = []
    supplementsByLayer[layer].push(s)
  }
  const suppLayers = Object.keys(supplementsByLayer).map(Number).sort((a, b) => {
    if (a === 0) return 1
    if (b === 0) return -1
    return a - b
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print:bg-white print:static print:block">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none print:mx-0">
        {/* Top bar */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-2xl print:hidden">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">CoPilot Analysis Report</h2>
            <p className="text-sm text-neutral-500">{data.patientName} · {data.analysisDate}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} className="text-neutral-500" />
          </button>
        </div>

        {/* Report content */}
        <div className="p-6 space-y-6" id="copilot-report-content">
          {/* Header with logo */}
          <div className="flex items-center gap-4 pb-4 border-b-2 border-blue-600">
            <img
              src="/images/copilot-logo-gradient.svg"
              alt="BFM CoPilot"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-xl font-bold text-blue-700">BFM CoPilot Analysis Report</h1>
              <p className="text-sm text-neutral-500">
                Patient: {data.patientName} | Date: {data.analysisDate}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div>
            <h2 className="text-base font-bold text-blue-700 border-b border-blue-100 pb-2 mb-3">
              Clinical Summary
            </h2>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {data.summary}
            </p>
          </div>

          {/* Urgency Badge */}
          {data.evalReport?.urgency && (
            <div className={cn(
              'rounded-xl p-4 border',
              data.evalReport.urgency.score >= 4 ? 'bg-red-50 border-red-200' :
              data.evalReport.urgency.score >= 3 ? 'bg-amber-50 border-amber-200' :
              'bg-green-50 border-green-200'
            )}>
              <div className="flex items-center gap-3 mb-2">
                <div className={cn(
                  'text-2xl font-bold',
                  data.evalReport.urgency.score >= 4 ? 'text-red-700' :
                  data.evalReport.urgency.score >= 3 ? 'text-amber-700' :
                  'text-green-700'
                )}>
                  {data.evalReport.urgency.score}/5
                </div>
                <div>
                  <p className="font-semibold text-neutral-900">Urgency Rating</p>
                  <p className="text-xs text-neutral-600">{data.evalReport.urgency.timeline}</p>
                </div>
              </div>
              <p className="text-sm text-neutral-700">{data.evalReport.urgency.rationale}</p>
              {data.evalReport.urgency.critical_path && (
                <p className="text-xs text-neutral-500 mt-1">
                  <span className="font-medium">Critical path:</span> {data.evalReport.urgency.critical_path}
                </p>
              )}
            </div>
          )}

          {/* Deal Breakers Callout */}
          {data.evalReport?.deal_breakers && data.evalReport.deal_breakers.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h2 className="text-base font-bold text-red-800 mb-3 flex items-center gap-2">
                <HugeiconsIcon icon={Alert01Icon} size={18} className="text-red-600" />
                Deal Breakers ({data.evalReport.deal_breakers.length})
              </h2>
              <div className="space-y-3">
                {data.evalReport.deal_breakers.map((db, i) => (
                  <div key={i} className="bg-white/60 rounded-lg px-3 py-2">
                    <p className="font-semibold text-red-900 text-sm">{db.name}</p>
                    <p className="text-xs text-neutral-700 mt-0.5">{db.finding}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      <span className="font-medium">Protocol:</span> {db.protocol} · <span className="font-medium">Citation:</span> {db.patient_data_citation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Five Levers */}
          {data.evalReport?.five_levers && data.evalReport.five_levers.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-blue-700 border-b border-blue-100 pb-2 mb-3">
                Five Levers Assessment
              </h2>
              <div className="space-y-2">
                {data.evalReport.five_levers.map((lever, i) => (
                  <div key={i} className="bg-neutral-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">L{lever.lever_number}</span>
                      <p className="font-semibold text-neutral-900 text-sm">{lever.lever_name}</p>
                    </div>
                    <p className="text-xs text-neutral-700"><span className="font-medium">Status:</span> {lever.patient_status}</p>
                    <p className="text-xs text-neutral-600 mt-0.5"><span className="font-medium">Action:</span> {lever.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Patient Analogies */}
          {data.evalReport?.patient_analogies && data.evalReport.patient_analogies.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-blue-700 border-b border-blue-100 pb-2 mb-3">
                Patient Communication Analogies
              </h2>
              <div className="space-y-3">
                {data.evalReport.patient_analogies.map((a, i) => (
                  <div key={i} className="bg-blue-50/50 rounded-xl px-4 py-3">
                    <p className="font-semibold text-neutral-900 text-sm mb-1">{a.finding}</p>
                    <p className="text-sm text-neutral-700 italic">&ldquo;{a.analogy}&rdquo;</p>
                    <p className="text-xs text-neutral-600 mt-1">{a.what_this_means}</p>
                    <p className="text-xs text-green-700 mt-1 font-medium">{a.hopeful_framing}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Layered Protocols */}
          <div>
            <h2 className="text-base font-bold text-blue-700 border-b border-blue-100 pb-2 mb-3">
              Protocol Recommendations ({data.protocols.reduce((sum, p) => sum + p.frequencies.length, 0)} frequencies)
            </h2>
            <div className="space-y-4">
              {layers.map(layer => {
                const config = LAYER_CARDS[layer] || LAYER_CARDS[3]
                const protocols = protocolsByLayer[layer].sort((a, b) => a.priority - b.priority)

                return (
                  <div key={layer}>
                    <div className={cn('text-xs font-bold px-3 py-1.5 rounded-lg inline-block mb-2', config.bg, config.accent)}>
                      {config.label}
                    </div>
                    <div className="space-y-2">
                      {protocols.map((protocol, pi) =>
                        protocol.frequencies.map((freq, fi) => (
                          <div key={`${pi}-${fi}`} className="bg-neutral-50 rounded-xl px-4 py-3">
                            <p className="font-semibold text-neutral-900">{freq.name}</p>
                            {freq.rationale && (
                              <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{freq.rationale}</p>
                            )}
                            {freq.diagnosticTrigger && (
                              <p className="text-xs text-neutral-500 mt-1">
                                <span className="font-medium">Trigger:</span> {freq.diagnosticTrigger}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Supplementation */}
          {data.supplementation.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-blue-700 border-b border-blue-100 pb-2 mb-3">
                Supplement Stack ({data.supplementation.length} items)
              </h2>
              <div className="space-y-4">
                {suppLayers.map(layer => {
                  const config = LAYER_CARDS[layer] || { label: 'General', bg: 'bg-neutral-50', accent: 'text-neutral-600' }
                  return (
                    <div key={layer}>
                      {suppLayers.length > 1 && (
                        <div className={cn('text-xs font-bold px-3 py-1.5 rounded-lg inline-block mb-2', config.bg, config.accent)}>
                          {config.label}
                        </div>
                      )}
                      <div className="space-y-2">
                        {supplementsByLayer[layer].map((s, i) => (
                          <div key={i} className="py-2 border-b border-neutral-100 last:border-0">
                            <div className="flex items-start gap-3">
                              <HugeiconsIcon icon={PillIcon} size={14} className="text-neutral-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0 flex items-baseline justify-between gap-4">
                                <p className="font-semibold text-neutral-900 text-sm">{s.name}</p>
                                <div className="text-right flex-shrink-0 max-w-[40%]">
                                  {s.dosage && <p className="text-sm text-neutral-700 truncate">{s.dosage}</p>}
                                  {s.timing && <p className="text-xs text-neutral-400 truncate">{s.timing}</p>}
                                </div>
                              </div>
                            </div>
                            {s.rationale && (
                              <p className="text-xs text-neutral-500 mt-1 ml-[26px]">{s.rationale}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Monitoring Checklist */}
          {data.evalReport?.monitoring && data.evalReport.monitoring.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-blue-700 border-b border-blue-100 pb-2 mb-3">
                Monitoring Checklist
              </h2>
              <div className="overflow-hidden rounded-xl border border-neutral-200">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-700">Metric</th>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-700">Baseline</th>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-700">Target</th>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-700">Reassess</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.evalReport.monitoring.map((m, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}>
                        <td className="px-3 py-2 font-medium text-neutral-900">{m.metric}</td>
                        <td className="px-3 py-2 text-neutral-600">{m.baseline}</td>
                        <td className="px-3 py-2 text-neutral-600">{m.target}</td>
                        <td className="px-3 py-2 text-neutral-500">{m.reassessment_interval}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confidence Notes */}
          {data.evalReport?.confidence_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">Data Quality Notes</p>
              <p className="text-xs text-amber-700">{data.evalReport.confidence_notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-neutral-400 pt-4 border-t border-neutral-200">
            <p>CONFIDENTIAL — For licensed practitioner use only. Not for patient distribution without clinical review.</p>
            <p className="mt-1">© {new Date().getFullYear()} BFM CoPilot. Clinical decision support only — does not constitute medical advice.</p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-medium transition-colors"
          >
            <HugeiconsIcon icon={PrinterIcon} size={16} />
            Print
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {downloading ? (
              <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" />
            ) : (
              <HugeiconsIcon icon={Download01Icon} size={16} />
            )}
            Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
