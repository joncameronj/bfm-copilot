// Protocol Types - WS-4: Protocol Management for Practitioners

export type ProtocolStatus = 'draft' | 'active' | 'completed' | 'archived' | 'superseded';
export type ProtocolCategory = 'general' | 'detox' | 'hormone' | 'gut' | 'immune' | 'metabolic' | 'neurological';
export type FeedbackOutcome = 'positive' | 'negative' | 'neutral' | 'partial';
export type FeedbackRating = 'thumbs_up' | 'thumbs_down';

export interface ProtocolPatient {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ProtocolFeedback {
  id: string;
  protocolId: string;
  practitionerId: string;
  outcome: FeedbackOutcome;
  outcomeText?: string;
  adjustmentsMade?: string;
  rating?: FeedbackRating;
  labComparison?: string;
  createdAt: Date;
}

export interface Protocol {
  id: string;
  practitionerId: string;
  patientId: string | null;
  patient?: ProtocolPatient | null;
  title: string;
  content: string;
  category: ProtocolCategory;
  status: ProtocolStatus;
  durationDays: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProtocolWithFeedback extends Protocol {
  feedback: ProtocolFeedback[];
}

export interface ProtocolFilters {
  status?: ProtocolStatus | 'all';
  category?: ProtocolCategory | 'all';
  patientId?: string;
  search?: string;
}

export interface CreateProtocolInput {
  patientId?: string;
  title: string;
  content: string;
  category?: ProtocolCategory;
  durationDays?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface UpdateProtocolInput extends Partial<CreateProtocolInput> {
  status?: ProtocolStatus;
}

export interface SubmitFeedbackInput {
  outcome: FeedbackOutcome;
  outcomeText?: string;
  adjustmentsMade?: string;
  rating?: FeedbackRating;
  labComparison?: string;
}

// Database row types (snake_case for Supabase)
export interface ProtocolRow {
  id: string;
  practitioner_id: string;
  patient_id: string | null;
  title: string;
  content: string;
  category: string;
  status: string;
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProtocolFeedbackRow {
  id: string;
  protocol_id: string;
  practitioner_id: string;
  outcome: string;
  outcome_text: string | null;
  adjustments_made: string | null;
  rating: string | null;
  lab_comparison: string | null;
  created_at: string;
}

// API response types
export interface ProtocolApiResponse {
  id: string;
  practitionerId: string;
  patientId: string | null;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  title: string;
  content: string;
  category: string;
  status: string;
  durationDays: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  feedback?: Array<{
    id: string;
    outcome: string;
    outcomeText?: string;
    rating?: string;
    createdAt: string;
  }>;
}

// Helper function to convert API response to Protocol type
export function apiToProtocol(response: ProtocolApiResponse): ProtocolWithFeedback {
  return {
    id: response.id,
    practitionerId: response.practitionerId,
    patientId: response.patientId,
    patient: response.patient ? {
      id: response.patient.id,
      firstName: response.patient.firstName,
      lastName: response.patient.lastName,
    } : null,
    title: response.title,
    content: response.content,
    category: response.category as ProtocolCategory,
    status: response.status as ProtocolStatus,
    durationDays: response.durationDays,
    startDate: response.startDate,
    endDate: response.endDate,
    notes: response.notes,
    createdAt: new Date(response.createdAt),
    updatedAt: new Date(response.updatedAt),
    feedback: response.feedback?.map(f => ({
      id: f.id,
      protocolId: response.id,
      practitionerId: response.practitionerId,
      outcome: f.outcome as FeedbackOutcome,
      outcomeText: f.outcomeText,
      rating: f.rating as FeedbackRating | undefined,
      createdAt: new Date(f.createdAt),
    })) || [],
  };
}

// Status display helpers
export const STATUS_LABELS: Record<ProtocolStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
  superseded: 'Superseded',
};

export const STATUS_COLORS: Record<ProtocolStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-neutral-100 text-neutral-500',
  superseded: 'bg-yellow-100 text-yellow-700',
};

export const CATEGORY_LABELS: Record<ProtocolCategory, string> = {
  general: 'General',
  detox: 'Detox',
  hormone: 'Hormone',
  gut: 'Gut Health',
  immune: 'Immune',
  metabolic: 'Metabolic',
  neurological: 'Neurological',
};

export const CATEGORY_COLORS: Record<ProtocolCategory, string> = {
  general: 'bg-neutral-100 text-neutral-700',
  detox: 'bg-green-100 text-green-700',
  hormone: 'bg-purple-100 text-purple-700',
  gut: 'bg-orange-100 text-orange-700',
  immune: 'bg-blue-100 text-blue-700',
  metabolic: 'bg-red-100 text-red-700',
  neurological: 'bg-indigo-100 text-indigo-700',
};

export const OUTCOME_LABELS: Record<FeedbackOutcome, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
  partial: 'Partial',
};

export const OUTCOME_COLORS: Record<FeedbackOutcome, string> = {
  positive: 'text-green-600',
  negative: 'text-red-600',
  neutral: 'text-neutral-600',
  partial: 'text-yellow-600',
};
