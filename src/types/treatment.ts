// Treatment Session Types for FSM (Frequency Specific Microcurrent)

export type TreatmentEffect = 'positive' | 'negative' | 'nil';

export interface FSMFrequency {
  id: string;
  name: string;
  frequencyA: number;
  frequencyB: number | null;
  category: string | null;
  condition: string | null;
  description: string | null;
  source: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FrequencyUsed {
  id: string;
  name: string;
  frequencyA: number;
  frequencyB?: number;
}

export interface TreatmentSession {
  id: string;
  patientId: string;
  practitionerId: string;
  protocolId: string | null;
  sessionDate: string;
  sessionTime: string | null;
  frequenciesUsed: FrequencyUsed[];
  effect: TreatmentEffect;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TreatmentSessionWithDetails extends TreatmentSession {
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  protocol?: {
    id: string;
    title: string;
  };
}

export interface CreateTreatmentSessionInput {
  patientId: string;
  protocolId?: string;
  sessionDate: string;
  sessionTime?: string;
  frequenciesUsed: FrequencyUsed[];
  effect: TreatmentEffect;
  notes?: string;
}

export interface UpdateTreatmentSessionInput {
  protocolId?: string;
  sessionDate?: string;
  sessionTime?: string;
  frequenciesUsed?: FrequencyUsed[];
  effect?: TreatmentEffect;
  notes?: string;
}

export interface TreatmentSessionFilters {
  effect?: TreatmentEffect | 'all';
  startDate?: string;
  endDate?: string;
  search?: string;
}

// Database row types (snake_case for Supabase)
export interface TreatmentSessionRow {
  id: string;
  patient_id: string;
  practitioner_id: string;
  protocol_id: string | null;
  session_date: string;
  session_time: string | null;
  frequencies_used: FrequencyUsed[];
  effect: TreatmentEffect;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FSMFrequencyRow {
  id: string;
  name: string;
  frequency_a: number;
  frequency_b: number | null;
  category: string | null;
  condition: string | null;
  description: string | null;
  source: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Helper functions
export function rowToSession(row: TreatmentSessionRow): TreatmentSession {
  return {
    id: row.id,
    patientId: row.patient_id,
    practitionerId: row.practitioner_id,
    protocolId: row.protocol_id,
    sessionDate: row.session_date,
    sessionTime: row.session_time,
    frequenciesUsed: row.frequencies_used || [],
    effect: row.effect,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function rowToFrequency(row: FSMFrequencyRow): FSMFrequency {
  return {
    id: row.id,
    name: row.name,
    frequencyA: row.frequency_a,
    frequencyB: row.frequency_b,
    category: row.category,
    condition: row.condition,
    description: row.description,
    source: row.source,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Display helpers
export const EFFECT_LABELS: Record<TreatmentEffect, string> = {
  positive: 'Positive',
  negative: 'Negative',
  nil: 'No Effect',
};

export const EFFECT_COLORS: Record<TreatmentEffect, string> = {
  positive: 'bg-green-100 text-green-700',
  negative: 'bg-red-100 text-red-700',
  nil: 'bg-neutral-100 text-neutral-600',
};

export const EFFECT_BADGE_VARIANTS: Record<TreatmentEffect, 'success' | 'danger' | 'neutral'> = {
  positive: 'success',
  negative: 'danger',
  nil: 'neutral',
};
