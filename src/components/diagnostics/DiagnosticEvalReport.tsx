'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  Alert01Icon,
  AiMagicIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Download01Icon,
  File01Icon,
  Loading03Icon,
  PillIcon,
  Settings01Icon,
  StethoscopeIcon,
  Tick01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import type { EvalReportData } from './DiagnosticEvalReportPdf'

interface DiagnosticEvalReportProps {
  report: EvalReportData
  diagnosticAnalysisId: string
  onClose: () => void
}

function UrgencyBadge({ score }: { score: number }) {
  const label = score >= 5 ? 'CRITICAL' : score >= 4 ? 'URGENT' : score >= 3 ? 'MODERATE' : score >= 2.5 ? 'MILD' : 'MAINTENANCE'
  const classes =
    score >= 5
      ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
      : score >= 4
        ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
        : score >= 3
          ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200'
          : 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold', classes)}>
      <span className="text-lg font-bold">{score}</span>
      <span>/5 · {label}</span>
    </span>
  )
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string
  icon: IconSvgElement
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-neutral-200 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 bg-neutral-50 hover:bg-neutral-100 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={icon} size={18} className="text-neutral-600" />
          <span className="font-semibold text-neutral-900">{title}</span>
          {badge && <span className="ml-2">{badge}</span>}
        </div>
        <HugeiconsIcon
          icon={open ? ArrowUp01Icon : ArrowDown01Icon}
          size={16}
          className="text-neutral-400"
        />
      </button>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  )
}

function DealBreakerCard({
  db,
  index,
}: {
  db: EvalReportData['dealBreakers'][0]
  index: number
}) {
  return (
    <div className="border-l-4 border-red-500 bg-red-50 rounded-r-xl px-4 py-3 mb-3">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-900">{db.name}</p>
          <p className="text-sm text-red-800 mt-0.5">{db.finding}</p>
          <p className="text-sm text-neutral-700 mt-1">
            <span className="font-medium">Protocol:</span> {db.protocol}
          </p>
          <p className="text-xs text-neutral-500 mt-1 italic">
            ↳ {db.patientDataCitation}
          </p>
        </div>
      </div>
    </div>
  )
}

const LAYER_CONFIG: Record<number, { label: string; subtitle: string; color: string }> = {
  1: { label: 'Layer 1 — High Priorities', subtitle: 'Address these first.', color: 'bg-red-50 text-red-800' },
  2: { label: 'Layer 2 — Next If No Response', subtitle: 'If symptoms persist after 4-6 weeks.', color: 'bg-amber-50 text-amber-800' },
  3: { label: 'Layer 3 — If They Are Still Stuck', subtitle: 'Deep-dive for resistant cases.', color: 'bg-blue-50 text-blue-800' },
}

function FrequencyPhaseList({ phases }: { phases: EvalReportData['frequencyPhases'] }) {
  const grouped: Record<number, typeof phases> = {}
  for (const p of phases) {
    if (!grouped[p.phase]) grouped[p.phase] = []
    grouped[p.phase].push(p)
  }
  const phaseNums = Object.keys(grouped).map(Number).sort()

  return (
    <div className="space-y-5">
      {phaseNums.map(phase => {
        const config = LAYER_CONFIG[phase] || { label: `Layer ${phase}`, subtitle: '', color: 'bg-neutral-100 text-neutral-600' }
        const firstItem = grouped[phase][0]
        const label = firstItem?.layerLabel ? `Layer ${phase} — ${firstItem.layerLabel}` : config.label
        return (
          <div key={phase}>
            <div className="mb-2">
              <p className={cn('text-xs font-semibold px-2.5 py-1 rounded-lg inline-block', config.color)}>
                {label}
              </p>
              {config.subtitle && (
                <p className="text-xs text-neutral-500 mt-1 ml-0.5">{config.subtitle}</p>
              )}
            </div>
            <div className="space-y-2">
              {grouped[phase].map((fp, i) => (
                <div key={i} className="bg-neutral-50 rounded-xl px-4 py-3">
                  <p className="font-medium text-neutral-900">{fp.protocolName}</p>
                  <p className="text-sm text-neutral-600 mt-0.5">{fp.trigger}</p>
                  {fp.sequencingNote && (
                    <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                      <span>⚠</span>
                      {fp.sequencingNote}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400 mt-1 italic">↳ {fp.patientDataCitation}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SupplementTable({ items }: { items: EvalReportData['supplementation'] }) {
  // Group by layer (0 = unassigned/general)
  const grouped: Record<number, typeof items> = {}
  for (const s of items) {
    const layer = s.layer ?? 0
    if (!grouped[layer]) grouped[layer] = []
    grouped[layer].push(s)
  }
  // Sort layers: 1, 2, 3, then 0 (general) at end
  const layers = Object.keys(grouped).map(Number).sort((a, b) => {
    if (a === 0) return 1
    if (b === 0) return -1
    return a - b
  })

  const LAYER_SUPPLEMENT_LABELS: Record<number, { label: string; color: string }> = {
    1: { label: 'Day 1 — High Priority Supplements', color: 'bg-red-50 text-red-700' },
    2: { label: 'Week 1-2 — Lab-Triggered Supplements', color: 'bg-amber-50 text-amber-700' },
    3: { label: 'If Still Stuck — Advanced Supplements', color: 'bg-blue-50 text-blue-700' },
    0: { label: 'General Supplements', color: 'bg-neutral-50 text-neutral-600' },
  }

  return (
    <div className="space-y-4">
      {layers.map(layer => {
        const meta = LAYER_SUPPLEMENT_LABELS[layer] || LAYER_SUPPLEMENT_LABELS[0]
        const layerItems = [...grouped[layer]].sort((a, b) => a.priority - b.priority)
        return (
          <div key={layer}>
            {layers.length > 1 && (
              <p className={cn('text-xs font-semibold px-2.5 py-1 rounded-lg inline-block mb-2', meta.color)}>
                {meta.label}
              </p>
            )}
            <div className="space-y-2">
              {layerItems.map((s, i) => (
                <div key={i} className="flex items-start gap-4 py-2 border-b border-neutral-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900">{s.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{s.trigger}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {s.dosage && <p className="text-sm text-neutral-700">{s.dosage}</p>}
                    {s.timing && <p className="text-xs text-neutral-400">{s.timing}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LeverCard({ lever }: { lever: EvalReportData['fiveLevers'][0] }) {
  return (
    <div className="border-l-4 border-indigo-400 bg-indigo-50 rounded-r-xl px-4 py-3 mb-3">
      <p className="font-semibold text-indigo-900">
        Lever {lever.leverNumber}: {lever.leverName}
      </p>
      <p className="text-sm text-neutral-700 mt-1">{lever.patientStatus}</p>
      <p className="text-sm text-indigo-800 mt-1 italic">→ {lever.recommendation}</p>
      <p className="text-xs text-neutral-400 mt-1">↳ {lever.patientDataCitation}</p>
    </div>
  )
}

function AnalogyCard({ analogy }: { analogy: EvalReportData['patientAnalogies'][0] }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4 mb-3">
      <p className="text-xs font-semibold text-emerald-700 mb-2">{analogy.finding}</p>
      <p className="text-sm text-neutral-700 leading-relaxed">{analogy.analogy}</p>
      <p className="text-sm text-neutral-600 mt-2">{analogy.whatThisMeans}</p>
      <p className="text-sm text-emerald-700 mt-2 italic">{analogy.hopefulFraming}</p>
    </div>
  )
}

export function DiagnosticEvalReport({
  report,
  diagnosticAnalysisId,
  onClose,
}: DiagnosticEvalReportProps) {
  const [downloading, setDownloading] = useState(false)

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/diagnostics/${diagnosticAnalysisId}/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report }),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bfm-eval-${report.patientName.replace(/\s+/g, '-').toLowerCase()}-${report.reportDate}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Full Clinical Eval Report</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            {report.patientName} · {report.reportDate} · Claude Opus 4.6
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Urgency */}
      <div className="bg-neutral-50 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <UrgencyBadge score={report.urgency.score} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-700">{report.urgency.rationale}</p>
            <p className="text-sm font-medium text-neutral-900 mt-1">
              Critical path: <span className="text-blue-700">{report.urgency.criticalPath}</span>
            </p>
            <p className="text-xs text-neutral-500 mt-1">Timeline: {report.urgency.timeline}</p>
          </div>
        </div>
      </div>

      {/* Deal Breakers */}
      {report.dealBreakers.length > 0 && (
        <CollapsibleSection
          title={`Deal Breakers (${report.dealBreakers.length})`}
          icon={Alert01Icon}
          defaultOpen={true}
          badge={
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
              Address First
            </span>
          }
        >
          {report.dealBreakers.map((db, i) => (
            <DealBreakerCard key={i} db={db} index={i} />
          ))}
        </CollapsibleSection>
      )}

      {/* Frequency Phases */}
      <CollapsibleSection
        title={`Frequency Protocols (${report.frequencyPhases.length})`}
        icon={AiMagicIcon}
        defaultOpen={true}
      >
        <FrequencyPhaseList phases={report.frequencyPhases} />
      </CollapsibleSection>

      {/* Supplementation */}
      {report.supplementation.length > 0 && (
        <CollapsibleSection
          title={`Supplement Stack (${report.supplementation.length})`}
          icon={PillIcon}
          defaultOpen={true}
        >
          <SupplementTable items={report.supplementation} />
        </CollapsibleSection>
      )}

      {/* Five Levers */}
      {report.fiveLevers.length > 0 && (
        <CollapsibleSection
          title="The Five Levers"
          icon={Settings01Icon}
          defaultOpen={false}
        >
          {report.fiveLevers.map((lever, i) => (
            <LeverCard key={i} lever={lever} />
          ))}
        </CollapsibleSection>
      )}

      {/* Patient Analogies */}
      {report.patientAnalogies.length > 0 && (
        <CollapsibleSection
          title="Patient Communication Guide"
          icon={StethoscopeIcon}
          defaultOpen={false}
          badge={
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
              Plain language
            </span>
          }
        >
          <p className="text-xs text-neutral-500 mb-4">
            Use these practitioner-tested analogies when explaining findings to the patient.
            No medical jargon — visualizable metaphors that build understanding and compliance.
          </p>
          {report.patientAnalogies.map((analogy, i) => (
            <AnalogyCard key={i} analogy={analogy} />
          ))}
        </CollapsibleSection>
      )}

      {/* Monitoring */}
      {report.monitoring.length > 0 && (
        <CollapsibleSection
          title={`Monitoring Plan (${report.monitoring.length} metrics)`}
          icon={Tick01Icon}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {report.monitoring.map((m, i) => (
              <div key={i} className="grid grid-cols-4 gap-3 py-2 border-b border-neutral-100 last:border-0 text-sm">
                <p className="font-medium text-neutral-900">{m.metric}</p>
                <p className="text-neutral-600">{m.baseline}</p>
                <p className="text-emerald-700">{m.target}</p>
                <p className="text-neutral-400 text-right">{m.reassessmentInterval}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Clinical Summary */}
      <div className="bg-blue-50 rounded-2xl px-5 py-4">
        <h3 className="font-semibold text-blue-900 mb-3">Clinical Narrative</h3>
        <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
          {report.clinicalSummary}
        </p>
        {report.confidenceNotes && (
          <p className="text-xs text-amber-700 mt-3 italic">{report.confidenceNotes}</p>
        )}
      </div>
    </div>
  )
}
