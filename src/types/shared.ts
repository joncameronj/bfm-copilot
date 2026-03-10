// User roles (WS-5 owns role logic, but types defined here)
export type UserRole = 'admin' | 'practitioner' | 'member'

export interface User {
  id: string
  email: string
  fullName: string | null
  role: UserRole
  status: 'active' | 'inactive'
  selfPatientId: string | null // For members who ARE their own patient
  createdAt: Date
  updatedAt: Date
}

export interface Patient {
  id: string
  userId: string
  firstName: string
  lastName: string
  dateOfBirth: Date
  gender: 'male' | 'female' | 'other'
  email?: string
  phone?: string
  chiefComplaints?: string
  medicalHistory?: string
  currentMedications?: string[]
  allergies?: string[]
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

export interface PatientContext {
  gender: 'male' | 'female'
  age: number
}

export interface Conversation {
  id: string
  userId: string
  patientId: string | null
  title: string
  threadId: string | null
  conversationType: 'general' | 'lab_analysis' | 'diagnostics' | 'brainstorm'
  messageCount: number
  isStarred: boolean
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface LabResult {
  id: string
  patientId: string
  userId: string
  testDate: Date
  ominousCount: number
  ominousMarkersTriggered: string[]
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export type LabCategory =
  | 'cardiac'
  | 'inflammation'
  | 'anemia'
  | 'lipids'
  | 'diabetes'
  | 'bone_mineral'
  | 'renal'
  | 'hepatic'
  | 'thyroid'
  | 'hormones'
  | 'cbc'

export type DiagnosticType =
  | 'd_pulse'
  | 'hrv'
  | 'nes_scan'
  | 'mold_toxicity'
  | 'blood_panel'
  | 'urinalysis'    // UA - pH, protein levels
  | 'vcs'           // Visual Contrast Spectrum
  | 'brainwave'     // EEG/brainwave analysis
  | 'ortho'         // NervExpress Ortho test (supine/upright)
  | 'valsalva'      // NervExpress Valsalva test (normal/deep breathing)
  | 'other'

export interface DiagnosticUpload {
  id: string
  userId: string
  patientId: string | null
  status: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'complete' | 'error'
  analysisSummary: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DiagnosticFile {
  id: string
  uploadId: string
  filename: string
  fileType: DiagnosticType
  mimeType: string
  sizeBytes: number
  storagePath: string
  status: 'pending' | 'uploaded' | 'processed' | 'error'
  createdAt: Date
}

export interface Feedback {
  id: string
  userId: string
  messageId: string | null
  patientId: string | null
  feedbackType: 'response_quality' | 'protocol_outcome' | 'general'
  rating: 'positive' | 'negative' | 'neutral'
  outcome?: 'success' | 'partial' | 'no_improvement'
  comment: string | null
  createdAt: Date
}

export interface UsageEvent {
  id: string
  userId: string
  eventType:
    | 'login'
    | 'lab_analysis'
    | 'protocol_generated'
    | 'conversation_started'
    | 'diagnostic_uploaded'
    | 'patient_created'
    | 'feedback_submitted'
  metadata: Record<string, unknown>
  createdAt: Date
}
