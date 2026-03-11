import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Supplementation } from '@/types/diagnostic-analysis'

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 9,
    color: '#6b7280',
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
  summaryText: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.6,
  },
  layerHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
    backgroundColor: '#f3f4f6',
    padding: 4,
    marginTop: 6,
    marginBottom: 3,
  },
  protocolCard: {
    padding: 6,
    marginBottom: 4,
    borderRadius: 3,
  },
  protocolName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  frequencyName: {
    fontSize: 9,
    color: '#374151',
    marginTop: 2,
  },
  rationale: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
    fontStyle: 'italic',
  },
  trigger: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 1,
  },
  supplementHeader: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  supplementHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  supplementRow: {
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
})

const LAYER_LABELS: Record<number, string> = {
  1: 'Layer 1 — High Priorities',
  2: 'Layer 2 — Next If No Response',
  3: 'Layer 3 — If They Are Still Stuck',
}

export interface CopilotReportPdfData {
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
  logoBase64?: string
  evalReport?: {
    urgency?: { score: number; rationale: string; timeline: string; critical_path: string }
    deal_breakers?: Array<{ name: string; finding: string; protocol: string; urgency: string; patient_data_citation: string }>
    five_levers?: Array<{ lever_number: number; lever_name: string; patient_status: string; recommendation: string; patient_data_citation: string }>
    patient_analogies?: Array<{ finding: string; analogy: string; what_this_means: string; hopeful_framing: string }>
    monitoring?: Array<{ metric: string; baseline: string; target: string; reassessment_interval: string }>
    confidence_notes?: string
  }
}

interface Props {
  data: CopilotReportPdfData
}

function groupByLayer<T extends { layer: number }>(items: T[]): Record<number, T[]> {
  return items.reduce((acc, item) => {
    const key = item.layer || 1
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<number, T[]>)
}

export function CopilotReportPdf({ data }: Props) {
  const protocolsByLayer = groupByLayer(data.protocols.map(p => ({ ...p, layer: p.layer || 1 })))
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
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {data.logoBase64 && (
            <Image style={styles.logo} src={data.logoBase64} />
          )}
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>BFM CoPilot Analysis Report</Text>
            <Text style={styles.headerMeta}>
              Patient: {data.patientName} | Date: {data.analysisDate}
            </Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clinical Summary</Text>
          <Text style={styles.summaryText}>{data.summary}</Text>
        </View>

        {/* Urgency Rating */}
        {data.evalReport?.urgency && (
          <View style={[styles.section, { backgroundColor: data.evalReport.urgency.score >= 4 ? '#fef2f2' : data.evalReport.urgency.score >= 3 ? '#fffbeb' : '#f0fdf4', padding: 8, borderRadius: 4 }]}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: data.evalReport.urgency.score >= 4 ? '#991b1b' : data.evalReport.urgency.score >= 3 ? '#92400e' : '#166534' }}>
              Urgency: {data.evalReport.urgency.score}/5
            </Text>
            <Text style={{ fontSize: 9, color: '#374151', marginTop: 2 }}>{data.evalReport.urgency.rationale}</Text>
            <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>Timeline: {data.evalReport.urgency.timeline} | Critical path: {data.evalReport.urgency.critical_path}</Text>
          </View>
        )}

        {/* Deal Breakers */}
        {data.evalReport?.deal_breakers && data.evalReport.deal_breakers.length > 0 && (
          <View style={[styles.section, { backgroundColor: '#fef2f2', padding: 8, borderRadius: 4 }]}>
            <Text style={[styles.sectionTitle, { color: '#991b1b' }]}>Deal Breakers ({data.evalReport.deal_breakers.length})</Text>
            {data.evalReport.deal_breakers.map((db, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1f2937' }}>{db.name}</Text>
                <Text style={{ fontSize: 8, color: '#4b5563' }}>{db.finding} → {db.protocol}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Five Levers */}
        {data.evalReport?.five_levers && data.evalReport.five_levers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Five Levers Assessment</Text>
            {data.evalReport.five_levers.map((lever, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1f2937' }}>L{lever.lever_number}: {lever.lever_name}</Text>
                <Text style={{ fontSize: 8, color: '#4b5563' }}>Status: {lever.patient_status}</Text>
                <Text style={{ fontSize: 8, color: '#6b7280' }}>Action: {lever.recommendation}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Patient Analogies */}
        {data.evalReport?.patient_analogies && data.evalReport.patient_analogies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Communication</Text>
            {data.evalReport.patient_analogies.map((a, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1f2937' }}>{a.finding}</Text>
                <Text style={{ fontSize: 9, color: '#374151', fontStyle: 'italic', marginTop: 1 }}>{a.analogy}</Text>
                <Text style={{ fontSize: 8, color: '#4b5563', marginTop: 1 }}>{a.what_this_means}</Text>
                <Text style={{ fontSize: 8, color: '#166534', marginTop: 1 }}>{a.hopeful_framing}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Layered Protocols */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Protocol Recommendations ({data.protocols.length} protocols)
          </Text>
          {layers.map(layer => (
            <View key={layer}>
              <Text style={styles.layerHeader}>
                {LAYER_LABELS[layer] || `Layer ${layer}`}
              </Text>
              {protocolsByLayer[layer]
                .sort((a, b) => a.priority - b.priority)
                .map((protocol, pi) => (
                  <View key={pi}>
                    {protocol.frequencies.map((freq, fi) => (
                      <View
                        key={fi}
                        style={[
                          styles.protocolCard,
                          { backgroundColor: (pi + fi) % 2 === 0 ? '#f9fafb' : '#ffffff' },
                        ]}
                      >
                        <Text style={styles.protocolName}>{freq.name}</Text>
                        {freq.rationale && (
                          <Text style={styles.rationale}>{freq.rationale}</Text>
                        )}
                        {freq.diagnosticTrigger && (
                          <Text style={styles.trigger}>Trigger: {freq.diagnosticTrigger}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
            </View>
          ))}
        </View>

        {/* Supplementation */}
        {data.supplementation.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Supplement Stack ({data.supplementation.length} items)
            </Text>
            {suppLayers.map(layer => (
              <View key={layer}>
                {suppLayers.length > 1 && (
                  <Text style={styles.layerHeader}>
                    {LAYER_LABELS[layer] || 'General Supplements'}
                  </Text>
                )}
                <View style={styles.supplementHeader}>
                  <Text style={[styles.supplementHeaderText, { flex: 2 }]}>Supplement</Text>
                  <Text style={[styles.supplementHeaderText, { flex: 1 }]}>Dosage</Text>
                  <Text style={[styles.supplementHeaderText, { flex: 1, textAlign: 'right' }]}>Timing</Text>
                </View>
                {supplementsByLayer[layer].map((s, i) => (
                  <View key={i} style={styles.supplementRow}>
                    <Text style={styles.supplementName}>{s.name}</Text>
                    <Text style={styles.supplementDosage}>{s.dosage || '—'}</Text>
                    <Text style={styles.supplementTiming}>{s.timing || '—'}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Monitoring Checklist */}
        {data.evalReport?.monitoring && data.evalReport.monitoring.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Monitoring Checklist</Text>
            <View style={[styles.supplementHeader, { backgroundColor: '#f3f4f6' }]}>
              <Text style={[styles.supplementHeaderText, { flex: 2, color: '#374151' }]}>Metric</Text>
              <Text style={[styles.supplementHeaderText, { flex: 1, color: '#374151' }]}>Baseline</Text>
              <Text style={[styles.supplementHeaderText, { flex: 1, color: '#374151' }]}>Target</Text>
              <Text style={[styles.supplementHeaderText, { flex: 1, color: '#374151', textAlign: 'right' }]}>Reassess</Text>
            </View>
            {data.evalReport.monitoring.map((m, i) => (
              <View key={i} style={[styles.supplementRow, { paddingVertical: 3 }]}>
                <Text style={[styles.supplementName, { flex: 2, fontSize: 8, fontWeight: 'normal' }]}>{m.metric}</Text>
                <Text style={[styles.supplementDosage, { flex: 1, fontSize: 8 }]}>{m.baseline}</Text>
                <Text style={[styles.supplementDosage, { flex: 1, fontSize: 8 }]}>{m.target}</Text>
                <Text style={[styles.supplementTiming, { flex: 1, fontSize: 8 }]}>{m.reassessment_interval}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Confidence Notes */}
        {data.evalReport?.confidence_notes && (
          <View style={[styles.section, { backgroundColor: '#fffbeb', padding: 6, borderRadius: 4 }]}>
            <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#92400e' }}>Data Quality Notes</Text>
            <Text style={{ fontSize: 8, color: '#78350f', marginTop: 2 }}>{data.evalReport.confidence_notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          BFM CoPilot Analysis Report | {data.patientName} | {data.analysisDate}
          {'\n'}CONFIDENTIAL — For licensed practitioner use only. Not for patient distribution without clinical review.
          {'\n'}© {new Date().getFullYear()} BFM CoPilot. This report is for clinical decision support only and does not constitute medical advice.
        </Text>
      </Page>
    </Document>
  )
}
