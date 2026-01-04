// Recommendation types for Phase 3

export type RecommendationStatus = 'pending' | 'accepted' | 'rejected' | 'superseded'
export type FeedbackRating = 'thumbs_up' | 'thumbs_down'

export interface Recommendation {
  id: string
  userId: string
  conversationId: string | null
  content: string
  status: RecommendationStatus
  parentRecommendationId: string | null
  iterationCount: number
  createdAt: Date
  updatedAt: Date
}

export interface RecommendationFeedback {
  id: string
  recommendationId: string
  userId: string
  rating: FeedbackRating
  feedbackText: string | null
  createdAt: Date
}

export interface RecommendationWithFeedback extends Recommendation {
  feedback?: RecommendationFeedback[]
}

// API request/response types
export interface CreateRecommendationPayload {
  conversationId?: string
  content: string
}

export interface SubmitFeedbackPayload {
  rating: FeedbackRating
  feedbackText?: string
}

export interface UpdateRecommendationPayload {
  status?: RecommendationStatus
}
