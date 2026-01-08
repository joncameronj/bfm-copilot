// Evaluation Mode Types
// Used for the 4-tier rating system in eval mode

export type EvaluationRating = 'correct' | 'partially_correct' | 'partially_fail' | 'fail'

export type EvaluationContentType = 'chat_response' | 'protocol' | 'patient_analysis'

// Database row type
export interface ChatEvaluation {
  id: string
  message_id: string
  conversation_id: string
  evaluator_id: string
  content_type: EvaluationContentType
  rating: EvaluationRating
  correct_aspects: string | null
  needs_adjustment: string | null
  message_content: string
  patient_id: string | null
  is_eval_mode: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// API request payload for submitting an evaluation
export interface ChatEvaluationSubmission {
  messageId: string
  conversationId: string
  contentType: EvaluationContentType
  rating: EvaluationRating
  correctAspects?: string
  needsAdjustment?: string
  messageContent: string
  patientId?: string
}

// API response for a submitted evaluation
export interface ChatEvaluationResponse {
  id: string
  messageId: string
  rating: EvaluationRating
  createdAt: string
}

// Camel-cased version for frontend use
export interface ChatEvaluationData {
  id: string
  messageId: string
  conversationId: string
  evaluatorId: string
  contentType: EvaluationContentType
  rating: EvaluationRating
  correctAspects: string | null
  needsAdjustment: string | null
  messageContent: string
  patientId: string | null
  isEvalMode: boolean
  createdAt: string
  updatedAt: string
  // Joined data
  evaluator?: {
    id: string
    email: string
    fullName: string | null
  }
}

// Admin panel list response
export interface ChatEvaluationsListResponse {
  data: ChatEvaluationData[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  stats: {
    totalEvaluations: number
    byRating: Record<EvaluationRating, number>
    byContentType: Record<EvaluationContentType, number>
    evalModeCount: number
    regularFeedbackCount: number
  }
}

// Rating metadata for UI
export const RATING_CONFIG: Record<EvaluationRating, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: 'check' | 'alert' | 'x'
}> = {
  correct: {
    label: 'Correct',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: 'check',
  },
  partially_correct: {
    label: 'Partially Correct',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: 'check',
  },
  partially_fail: {
    label: 'Partially Fail',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: 'alert',
  },
  fail: {
    label: 'Fail',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'x',
  },
}

// Content type labels for UI
export const CONTENT_TYPE_LABELS: Record<EvaluationContentType, string> = {
  chat_response: 'Chat Response',
  protocol: 'Protocol',
  patient_analysis: 'Patient Analysis',
}

// Users who have access to eval mode
export const EVAL_MODE_USERS = [
  'drrob@shslasvegas.com',
  'joncameron@etho.net',
] as const
