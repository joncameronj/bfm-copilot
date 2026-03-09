'use client'

import { cn } from '@/lib/utils'
import type { EvalReportData } from './DiagnosticEvalReportPdf'

interface LayerQuickRefModalProps {
  report: EvalReportData
  onClose: () => void
  onViewFull: () => void
  onDownloadPdf: () => void
  downloading?: boolean
}

const LAYER_CARDS: Record<number, { label: string; accent: string; bg: string; border: string }> = {
  1: { label: 'Layer 1 — High Priorities', accent: 'text-red-800', bg: 'bg-red-50', border: 'border-red-200' },
  2: { label: 'Layer 2 — Next If No Response', accent: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  3: { label: 'Layer 3 — If They Are Still Stuck', accent: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200' },
}

export function LayerQuickRefModal({
  report,
  onClose,
  onViewFull,
  onDownloadPdf,
  downloading = false,
}: LayerQuickRefModalProps) {
  const layers = [1, 2, 3] as const

  const protocolsByLayer = (layer: number) =>
    report.frequencyPhases.filter(fp => fp.phase === layer)

  const supplementsByLayer = (layer: number) =>
    report.supplementation.filter(s => (s.layer ?? 0) === layer)

  const dealBreakerNames = report.dealBreakers.map(db => db.name)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Treatment Layer Overview</h2>
            <p className="text-sm text-neutral-500">{report.patientName} · {report.reportDate}</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-4">
          {layers.map(layer => {
            const config = LAYER_CARDS[layer]
            const protocols = protocolsByLayer(layer)
            const supplements = supplementsByLayer(layer)
            const isEmpty = protocols.length === 0 && supplements.length === 0 && (layer !== 1 || dealBreakerNames.length === 0)

            if (isEmpty) return null

            return (
              <div key={layer} className={cn('border rounded-xl p-4', config.border, config.bg)}>
                <h3 className={cn('font-semibold text-sm mb-3', config.accent)}>{config.label}</h3>

                {layer === 1 && dealBreakerNames.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-neutral-600 mb-1">Deal Breakers</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dealBreakerNames.map((name, i) => (
                        <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {protocols.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-neutral-600 mb-1">Protocols</p>
                    <div className="flex flex-wrap gap-1.5">
                      {protocols.map((fp, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white/70 text-neutral-800 text-xs font-medium rounded-full border border-neutral-200">
                          {fp.protocolName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {supplements.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-neutral-600 mb-1">Supplements</p>
                    <div className="flex flex-wrap gap-1.5">
                      {supplements.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white/70 text-neutral-700 text-xs rounded-full border border-neutral-200">
                          {s.name}
                          {s.dosage ? ` (${s.dosage})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onDownloadPdf}
            disabled={downloading}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 rounded-xl text-sm font-medium transition-colors"
          >
            {downloading ? 'Downloading...' : 'Download PDF'}
          </button>
          <button
            onClick={onViewFull}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            View Full Report
          </button>
        </div>
      </div>
    </div>
  )
}
