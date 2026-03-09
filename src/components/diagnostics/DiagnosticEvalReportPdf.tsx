import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#1e40af',
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 9,
    color: '#6b7280',
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 10,
    borderRadius: 6,
  },
  urgencyLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 8,
  },
  urgencyScore: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  urgencyRationale: {
    fontSize: 9,
    color: '#374151',
    marginTop: 4,
    flex: 1,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e40af',
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
    paddingBottom: 4,
    marginBottom: 8,
  },
  dealBreakerCard: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
    padding: 8,
    marginBottom: 6,
    borderRadius: 3,
  },
  dealBreakerName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#991b1b',
    marginBottom: 2,
  },
  dealBreakerProtocol: {
    fontSize: 9,
    color: '#1f2937',
    marginBottom: 2,
  },
  citation: {
    fontSize: 8,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
  frequencyCard: {
    padding: 6,
    marginBottom: 4,
    borderRadius: 3,
  },
  phaseLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 1,
  },
  protocolName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  trigger: {
    fontSize: 9,
    color: '#374151',
    marginTop: 1,
  },
  sequencingNote: {
    fontSize: 8,
    color: '#d97706',
    marginTop: 2,
    fontStyle: 'italic',
  },
  supplementCard: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  supplementName: {
    fontSize: 10,
    fontWeight: 'bold',
    flex: 2,
    color: '#1f2937',
  },
  supplementDosage: {
    fontSize: 9,
    flex: 1,
    color: '#374151',
  },
  supplementTiming: {
    fontSize: 9,
    flex: 1,
    color: '#6b7280',
    textAlign: 'right',
  },
  leverCard: {
    backgroundColor: '#f8fafc',
    padding: 8,
    marginBottom: 6,
    borderRadius: 3,
    borderLeftWidth: 2,
    borderLeftColor: '#6366f1',
  },
  leverTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4338ca',
    marginBottom: 2,
  },
  leverStatus: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 2,
  },
  leverRec: {
    fontSize: 9,
    color: '#1f2937',
    fontStyle: 'italic',
  },
  analogyCard: {
    backgroundColor: '#f0fdf4',
    padding: 8,
    marginBottom: 6,
    borderRadius: 3,
    borderLeftWidth: 2,
    borderLeftColor: '#16a34a',
  },
  analogyFinding: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#15803d',
    marginBottom: 3,
  },
  analogyText: {
    fontSize: 9,
    color: '#1f2937',
    marginBottom: 3,
    lineHeight: 1.4,
  },
  analogyHopeful: {
    fontSize: 9,
    color: '#15803d',
    fontStyle: 'italic',
  },
  monitoringRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  monitoringMetric: {
    fontSize: 9,
    flex: 2,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  monitoringValue: {
    fontSize: 9,
    flex: 1,
    color: '#374151',
    textAlign: 'center',
  },
  summaryText: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },
  phaseHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
    backgroundColor: '#f3f4f6',
    padding: 4,
    marginTop: 6,
    marginBottom: 3,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 8,
  },
  col: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1e40af',
  },
})

// Urgency color mapping
function getUrgencyBgColor(score: number): string {
  if (score >= 5) return '#fef2f2'
  if (score >= 4) return '#fff7ed'
  if (score >= 3) return '#fefce8'
  if (score >= 2.5) return '#f0fdf4'
  return '#f8fafc'
}

function getUrgencyTextColor(score: number): string {
  if (score >= 5) return '#dc2626'
  if (score >= 4) return '#ea580c'
  if (score >= 3) return '#ca8a04'
  if (score >= 2.5) return '#16a34a'
  return '#374151'
}

function getUrgencyLabel(score: number): string {
  if (score >= 5) return 'CRITICAL'
  if (score >= 4) return 'URGENT'
  if (score >= 3) return 'MODERATE'
  if (score >= 2.5) return 'MILD'
  return 'MAINTENANCE'
}

// Group frequency phases by phase number
function groupByPhase(phases: EvalReportData['frequencyPhases']): Record<number, typeof phases> {
  return phases.reduce((acc, item) => {
    const key = item.phase
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<number, typeof phases>)
}

const LAYER_LABELS: Record<number, string> = {
  1: 'Layer 1 — High Priorities (Address First)',
  2: 'Layer 2 — Next If No Response (4-6 Weeks)',
  3: 'Layer 3 — If They Are Still Stuck (2-3 Months)',
}

const SUPPLEMENT_LAYER_LABELS: Record<number, string> = {
  1: 'Day 1 — High Priority Supplements',
  2: 'Week 1-2 — Lab-Triggered Supplements',
  3: 'If Still Stuck — Advanced Supplements',
  0: 'General Supplements',
}

export interface EvalReportData {
  patientName: string
  reportDate: string
  urgency: {
    score: number
    rationale: string
    timeline: string
    criticalPath: string
  }
  dealBreakers: {
    name: string
    finding: string
    protocol: string
    urgency: string
    patientDataCitation: string
  }[]
  frequencyPhases: {
    phase: number
    protocolName: string
    trigger: string
    patientDataCitation: string
    sequencingNote: string
    layerLabel?: string
    layerDescription?: string
  }[]
  supplementation: {
    name: string
    trigger: string
    dosage: string
    timing: string
    patientDataCitation: string
    priority: number
    layer?: number
  }[]
  fiveLevers: {
    leverNumber: number
    leverName: string
    patientStatus: string
    recommendation: string
    patientDataCitation: string
  }[]
  patientAnalogies: {
    finding: string
    analogy: string
    whatThisMeans: string
    hopefulFraming: string
  }[]
  monitoring: {
    metric: string
    baseline: string
    target: string
    reassessmentInterval: string
  }[]
  clinicalSummary: string
  confidenceNotes: string
}

interface Props {
  data: EvalReportData
}

export function DiagnosticEvalReportPdf({ data }: Props) {
  const phaseGroups = groupByPhase(data.frequencyPhases)
  const phases = Object.keys(phaseGroups).map(Number).sort()

  return (
    <Document>
      {/* Page 1: Header, Urgency, Deal Breakers, Frequency Phases */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BFM Full Clinical Eval Report</Text>
          <Text style={styles.headerMeta}>
            Patient: {data.patientName} | Report Date: {data.reportDate} | Generated by Claude Opus 4.6
          </Text>
        </View>

        {/* Urgency Rating */}
        <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyBgColor(data.urgency.score) }]}>
          <View>
            <Text style={[styles.urgencyLabel, { color: getUrgencyTextColor(data.urgency.score) }]}>
              {getUrgencyLabel(data.urgency.score)}
            </Text>
            <Text style={[styles.urgencyScore, { color: getUrgencyTextColor(data.urgency.score) }]}>
              {data.urgency.score}/5
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.urgencyRationale}>{data.urgency.rationale}</Text>
            <Text style={[styles.urgencyRationale, { marginTop: 4, fontStyle: 'italic' }]}>
              Critical Path: {data.urgency.criticalPath}
            </Text>
            <Text style={[styles.urgencyRationale, { marginTop: 2, color: '#6b7280' }]}>
              Timeline: {data.urgency.timeline}
            </Text>
          </View>
        </View>

        {/* Deal Breakers */}
        {data.dealBreakers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Deal Breakers ({data.dealBreakers.length}) — Layer 1: High Priorities
            </Text>
            {data.dealBreakers.map((db, i) => (
              <View key={i} style={styles.dealBreakerCard}>
                <Text style={styles.dealBreakerName}>
                  #{i + 1} {db.name}
                </Text>
                <Text style={styles.dealBreakerProtocol}>
                  Finding: {db.finding}
                </Text>
                <Text style={styles.dealBreakerProtocol}>
                  Protocol: {db.protocol} | {db.urgency}
                </Text>
                <Text style={styles.citation}>
                  Citation: {db.patientDataCitation}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Frequency Phases */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Frequency Protocol Plan ({data.frequencyPhases.length} protocols)
          </Text>
          {phases.map(phase => (
            <View key={phase}>
              <Text style={styles.phaseHeader}>{LAYER_LABELS[phase] || `Layer ${phase}`}</Text>
              {phaseGroups[phase].map((fp, i) => (
                <View key={i} style={[styles.frequencyCard, { backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff' }]}>
                  <Text style={styles.protocolName}>{fp.protocolName}</Text>
                  <Text style={styles.trigger}>{fp.trigger}</Text>
                  {fp.sequencingNote ? (
                    <Text style={styles.sequencingNote}>⚠ {fp.sequencingNote}</Text>
                  ) : null}
                  <Text style={styles.citation}>Citation: {fp.patientDataCitation}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          BFM Copilot — Full Clinical Eval Report | {data.patientName} | {data.reportDate} | Page 1 of 3
          {'\n'}CONFIDENTIAL — For licensed practitioner use only. Not for patient distribution without clinical review.
        </Text>
      </Page>

      {/* Page 2: Supplementation, Five Levers, Monitoring */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BFM Full Clinical Eval Report — {data.patientName}</Text>
          <Text style={styles.headerMeta}>Supplementation Stack & Clinical Levers</Text>
        </View>

        {/* Supplementation — grouped by layer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Supplement Stack ({data.supplementation.length} items)
          </Text>
          {(() => {
            const grouped: Record<number, typeof data.supplementation> = {}
            for (const s of data.supplementation) {
              const layer = s.layer ?? 0
              if (!grouped[layer]) grouped[layer] = []
              grouped[layer].push(s)
            }
            const layers = Object.keys(grouped).map(Number).sort((a, b) => {
              if (a === 0) return 1
              if (b === 0) return -1
              return a - b
            })
            return layers.map(layer => (
              <View key={layer}>
                {layers.length > 1 && (
                  <Text style={styles.phaseHeader}>{SUPPLEMENT_LAYER_LABELS[layer] || `Layer ${layer}`}</Text>
                )}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { flex: 2 }]}>Supplement</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Dosage</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Timing</Text>
                </View>
                {grouped[layer]
                  .sort((a, b) => a.priority - b.priority)
                  .map((s, i) => (
                    <View key={i} style={styles.supplementCard}>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.supplementName}>{s.name}</Text>
                        <Text style={styles.citation}>{s.trigger}</Text>
                      </View>
                      <Text style={styles.supplementDosage}>{s.dosage || '—'}</Text>
                      <Text style={styles.supplementTiming}>{s.timing || '—'}</Text>
                    </View>
                  ))}
              </View>
            ))
          })()}
        </View>

        {/* Five Levers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>The Five Levers Assessment</Text>
          {data.fiveLevers.map((lever, i) => (
            <View key={i} style={styles.leverCard}>
              <Text style={styles.leverTitle}>
                Lever {lever.leverNumber}: {lever.leverName}
              </Text>
              <Text style={styles.leverStatus}>{lever.patientStatus}</Text>
              <Text style={styles.leverRec}>→ {lever.recommendation}</Text>
              <Text style={styles.citation}>Citation: {lever.patientDataCitation}</Text>
            </View>
          ))}
        </View>

        {/* Monitoring */}
        {data.monitoring.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Treatment Monitoring Plan</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Metric</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Baseline</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Target</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Re-assess</Text>
            </View>
            {data.monitoring.map((m, i) => (
              <View key={i} style={styles.monitoringRow}>
                <Text style={[styles.monitoringMetric, { flex: 2 }]}>{m.metric}</Text>
                <Text style={[styles.monitoringValue, { flex: 1 }]}>{m.baseline}</Text>
                <Text style={[styles.monitoringValue, { flex: 1 }]}>{m.target}</Text>
                <Text style={[styles.monitoringValue, { flex: 1, textAlign: 'right' }]}>
                  {m.reassessmentInterval}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          BFM Copilot — Full Clinical Eval Report | {data.patientName} | {data.reportDate} | Page 2 of 3
          {'\n'}CONFIDENTIAL — For licensed practitioner use only. Not for patient distribution without clinical review.
        </Text>
      </Page>

      {/* Page 3: Clinical Summary + Patient-Friendly Analogies */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BFM Full Clinical Eval Report — {data.patientName}</Text>
          <Text style={styles.headerMeta}>Clinical Summary & Patient Communication Guide</Text>
        </View>

        {/* Clinical Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clinical Narrative Summary</Text>
          <Text style={styles.summaryText}>{data.clinicalSummary}</Text>
          {data.confidenceNotes ? (
            <Text style={[styles.summaryText, { color: '#d97706', marginTop: 8, fontStyle: 'italic' }]}>
              Note: {data.confidenceNotes}
            </Text>
          ) : null}
        </View>

        {/* Patient Analogies */}
        {data.patientAnalogies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Communication Guide</Text>
            <Text style={[styles.summaryText, { color: '#6b7280', marginBottom: 8 }]}>
              Use these practitioner-tested analogies when explaining findings to the patient.
              No medical jargon. Visualizable metaphors that build understanding and compliance.
            </Text>
            {data.patientAnalogies.map((analogy, i) => (
              <View key={i} style={styles.analogyCard}>
                <Text style={styles.analogyFinding}>{analogy.finding}</Text>
                <Text style={styles.analogyText}>{analogy.analogy}</Text>
                <Text style={[styles.analogyText, { color: '#374151' }]}>
                  {analogy.whatThisMeans}
                </Text>
                <Text style={styles.analogyHopeful}>{analogy.hopefulFraming}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          BFM Copilot — Full Clinical Eval Report | {data.patientName} | {data.reportDate} | Page 3 of 3
          {'\n'}Generated by Claude Opus 4.6 using BFM Master Protocol Key | CONFIDENTIAL — For licensed practitioner use only
          {'\n'}© {new Date().getFullYear()} BFM Copilot. This report is for clinical decision support only and does not constitute medical advice.
        </Text>
      </Page>
    </Document>
  )
}
