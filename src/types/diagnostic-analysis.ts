// Diagnostic Analysis Pipeline Types
// AI-generated protocol recommendations from diagnostic uploads

import type { ProtocolCategory } from './protocol';
import type { FrequencyUsed } from './treatment';

// Re-export for convenience
export type { FrequencyUsed } from './treatment';

// ============================================
// STATUS TYPES
// ============================================

export type AnalysisStatus = 'pending' | 'processing' | 'complete' | 'error';
export type RecommendationStatus = 'recommended' | 'approved' | 'executed' | 'declined';
export type ExecutionOutcome = 'positive' | 'negative' | 'neutral' | 'pending';

// ============================================
// FREQUENCY RECOMMENDATION
// ============================================

export interface RecommendedFrequency {
  id: string;
  name: string;
  frequencyA?: number;  // Deprecated - no Hz values should be stored
  frequencyB?: number;  // Deprecated - no Hz values should be stored
  rationale?: string;  // Why this frequency was recommended
  source_reference?: string;  // Which BFM doc section led to this
  diagnostic_trigger?: string;  // Which diagnostic finding triggered this
}

// ============================================
// SUPPLEMENTATION
// ============================================

export interface Supplementation {
  name: string;
  dosage: string;
  timing: string;
  rationale: string;
  layer?: number;
}

// ============================================
// DIAGNOSTIC ANALYSIS
// ============================================

export interface DiagnosticAnalysis {
  id: string;
  diagnosticUploadId: string;
  patientId: string;
  practitionerId: string;
  summary: string;  // "Dr. Rob's voice" explanation
  rawAnalysis: Record<string, unknown>;
  status: AnalysisStatus;
  errorMessage: string | null;
  ragContext: Record<string, unknown>;
  supplementation: Supplementation[];  // Analysis-level supplementation
  isArchived: boolean;  // Soft delete flag
  archivedAt: Date | null;  // When analysis was archived
  createdAt: Date;
  updatedAt: Date;
}

export interface DiagnosticAnalysisWithPatient extends DiagnosticAnalysis {
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface DiagnosticAnalysisWithRecommendations extends DiagnosticAnalysis {
  recommendations: ProtocolRecommendation[];
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

// ============================================
// PROTOCOL RECOMMENDATION
// ============================================

export interface ProtocolRecommendation {
  id: string;
  diagnosticAnalysisId: string;
  patientId: string;
  title: string;
  description: string | null;
  category: ProtocolCategory;
  recommendedFrequencies: RecommendedFrequency[];
  supplementation: Supplementation[];
  priority: number;
  status: RecommendationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProtocolRecommendationWithExecutions extends ProtocolRecommendation {
  executions: ProtocolExecution[];
}

// ============================================
// PROTOCOL EXECUTION
// ============================================

export interface ProtocolExecution {
  id: string;
  protocolRecommendationId: string;
  patientId: string;
  practitionerId: string;
  executedAt: Date;
  frequenciesUsed: FrequencyUsed[];
  durationMinutes: number | null;
  notes: string | null;
  outcome: ExecutionOutcome | null;
  outcomeNotes: string | null;
  outcomeRecordedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// FLATTENED FREQUENCY CARD (Display-Time Transformation)
// ============================================

export interface FlattenedFrequencyCard {
  // Frequency details
  frequencyId: string;
  frequencyName: string;
  frequencyRationale?: string;
  sourceReference?: string;
  diagnosticTrigger?: string;

  // Context from parent protocol
  originalProtocolId: string;
  originalProtocolTitle: string;
  category: ProtocolCategory;
  priority: number;

  // Current status (from protocol_recommendations.status)
  status: RecommendationStatus;

  // Local execution state (UI only, not persisted)
  pendingExecution?: boolean;
}

// ============================================
// BATCH EXECUTION
// ============================================

export interface BatchExecutionRequest {
  diagnosticAnalysisId: string;
  patientId: string;
  frequencies: Array<{
    protocolRecommendationId: string;
    frequencyId: string;
    frequencyName: string;
  }>;
  sessionDate: string;  // YYYY-MM-DD
  sessionTime?: string; // HH:MM:SS
  effect: 'positive' | 'negative' | 'nil' | 'pending';
  notes?: string;
}

// ============================================
// INPUT TYPES
// ============================================

export interface GenerateAnalysisInput {
  diagnosticUploadId: string;
  patientId: string;
}

export interface ExecuteRecommendationInput {
  frequenciesUsed: FrequencyUsed[];
  durationMinutes?: number;
  notes?: string;
}

export interface RecordOutcomeInput {
  outcome: ExecutionOutcome;
  outcomeNotes?: string;
}

// ============================================
// DATABASE ROW TYPES (snake_case for Supabase)
// ============================================

export interface DiagnosticAnalysisRow {
  id: string;
  diagnostic_upload_id: string;
  patient_id: string;
  practitioner_id: string;
  summary: string;
  raw_analysis: Record<string, unknown>;
  status: AnalysisStatus;
  error_message: string | null;
  rag_context: Record<string, unknown>;
  supplementation: Supplementation[];
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProtocolRecommendationRow {
  id: string;
  diagnostic_analysis_id: string;
  patient_id: string;
  title: string;
  description: string | null;
  category: string;
  recommended_frequencies: RecommendedFrequency[];
  supplementation: Supplementation[];
  priority: number;
  status: RecommendationStatus;
  created_at: string;
  updated_at: string;
}

export interface ProtocolExecutionRow {
  id: string;
  protocol_recommendation_id: string;
  patient_id: string;
  practitioner_id: string;
  executed_at: string;
  frequencies_used: FrequencyUsed[];
  duration_minutes: number | null;
  notes: string | null;
  outcome: ExecutionOutcome | null;
  outcome_notes: string | null;
  outcome_recorded_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function rowToAnalysis(row: DiagnosticAnalysisRow): DiagnosticAnalysis {
  return {
    id: row.id,
    diagnosticUploadId: row.diagnostic_upload_id,
    patientId: row.patient_id,
    practitionerId: row.practitioner_id,
    summary: row.summary,
    rawAnalysis: row.raw_analysis || {},
    status: row.status,
    errorMessage: row.error_message,
    ragContext: row.rag_context || {},
    supplementation: row.supplementation || [],
    isArchived: row.is_archived || false,
    archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function rowToRecommendation(row: ProtocolRecommendationRow): ProtocolRecommendation {
  return {
    id: row.id,
    diagnosticAnalysisId: row.diagnostic_analysis_id,
    patientId: row.patient_id,
    title: row.title,
    description: row.description,
    category: row.category as ProtocolCategory,
    recommendedFrequencies: row.recommended_frequencies || [],
    supplementation: row.supplementation || [],
    priority: row.priority,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function rowToExecution(row: ProtocolExecutionRow): ProtocolExecution {
  return {
    id: row.id,
    protocolRecommendationId: row.protocol_recommendation_id,
    patientId: row.patient_id,
    practitionerId: row.practitioner_id,
    executedAt: new Date(row.executed_at),
    frequenciesUsed: row.frequencies_used || [],
    durationMinutes: row.duration_minutes,
    notes: row.notes,
    outcome: row.outcome,
    outcomeNotes: row.outcome_notes,
    outcomeRecordedAt: row.outcome_recorded_at ? new Date(row.outcome_recorded_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================
// DISPLAY HELPERS
// ============================================

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  complete: 'Complete',
  error: 'Error',
};

export const ANALYSIS_STATUS_COLORS: Record<AnalysisStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export const RECOMMENDATION_STATUS_LABELS: Record<RecommendationStatus, string> = {
  recommended: 'Recommended',
  approved: 'Approved',
  executed: 'Executed',
  declined: 'Declined',
};

export const RECOMMENDATION_STATUS_COLORS: Record<RecommendationStatus, string> = {
  recommended: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  executed: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-neutral-100 text-neutral-500',
};

export const OUTCOME_LABELS: Record<ExecutionOutcome, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
  pending: 'Pending',
};

export const OUTCOME_COLORS: Record<ExecutionOutcome, string> = {
  positive: 'bg-green-100 text-green-700',
  negative: 'bg-red-100 text-red-700',
  neutral: 'bg-neutral-100 text-neutral-600',
  pending: 'bg-yellow-100 text-yellow-700',
};

export const OUTCOME_BADGE_VARIANTS: Record<ExecutionOutcome, 'success' | 'danger' | 'neutral' | 'warning'> = {
  positive: 'success',
  negative: 'danger',
  neutral: 'neutral',
  pending: 'warning',
};
