/**
 * Patient context for chat conversations
 * Provides full patient data to AI agent for contextual responses
 */

export interface PatientChatContext {
  patient: {
    id: string
    name: string
    age: number
    gender: string
    dateOfBirth: string
    email?: string
    phone?: string
    status: string
  }
  clinical: {
    chiefComplaints: string
    medicalHistory: string
    currentMedications: string[]
    allergies: string[]
  }
  labs: {
    hasLabs: boolean
    count: number
    latestLabDate?: string
    ominousMarkersCount?: number
    ominousMarkers?: string[]
  }
  diagnostics: {
    hasAnalyses: boolean
    count: number
    latestAnalysisSummary?: string
    pendingRecommendations?: number
  }
  treatments: {
    hasTreatments: boolean
    totalSessions: number
    lastSessionDate?: string
    positiveOutcomes: number
    recentFrequencies?: string[]
  }
}

export interface QuickAction {
  id: string
  label: string
  icon: string
  prompt: string
}

export interface StartConversationResponse {
  conversationId: string
  context: PatientChatContext
  quickActions: QuickAction[]
  openingMessage: string
}
