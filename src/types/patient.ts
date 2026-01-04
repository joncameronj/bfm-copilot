// Patient Types - WS-4: Patients, Dashboard, Diagnostics & Feedback

export interface Patient {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  email?: string;
  phone?: string;
  chiefComplaints?: string;
  medicalHistory?: string;
  currentMedications?: string[];
  allergies?: string[];
  status: 'active' | 'inactive';
  lastVisitDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientWithStats extends Patient {
  labCount: number;
  conversationCount: number;
  hasOminousAlerts: boolean;
}

export interface PatientNote {
  id: string;
  patientId: string;
  userId: string;
  content: string;
  noteType: 'general' | 'visit' | 'treatment';
  createdAt: Date;
  updatedAt: Date;
}

export type PatientViewMode = 'card' | 'list';

export interface PatientFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  hasAlerts?: boolean;
  sortBy?: 'name' | 'lastVisit' | 'created' | 'age';
  sortOrder?: 'asc' | 'desc';
}

export interface CreatePatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  email?: string;
  phone?: string;
  chiefComplaints?: string;
  medicalHistory?: string;
  currentMedications?: string[];
  allergies?: string[];
}

export interface UpdatePatientInput extends Partial<CreatePatientInput> {
  status?: 'active' | 'inactive';
}

// Database row types (snake_case for Supabase)
export interface PatientRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other';
  email: string | null;
  phone: string | null;
  chief_complaints: string | null;
  medical_history: string | null;
  current_medications: string[] | null;
  allergies: string[] | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// Helper function to convert database row to Patient type
export function rowToPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: new Date(row.date_of_birth),
    gender: row.gender,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    chiefComplaints: row.chief_complaints ?? undefined,
    medicalHistory: row.medical_history ?? undefined,
    currentMedications: row.current_medications ?? undefined,
    allergies: row.allergies ?? undefined,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Helper function to convert Patient to database insert format
export function patientToRow(patient: CreatePatientInput, userId: string): Omit<PatientRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    first_name: patient.firstName,
    last_name: patient.lastName,
    date_of_birth: patient.dateOfBirth,
    gender: patient.gender,
    email: patient.email ?? null,
    phone: patient.phone ?? null,
    chief_complaints: patient.chiefComplaints ?? null,
    medical_history: patient.medicalHistory ?? null,
    current_medications: patient.currentMedications ?? null,
    allergies: patient.allergies ?? null,
    status: 'active',
  };
}
