// src/lib/tracking/events.ts
// Usage tracking system for analytics (WS-5)

import { createClient } from '@/lib/supabase/client'

export type EventType =
  | 'login'
  | 'lab_analysis'
  | 'protocol_generated'
  | 'conversation_started'
  | 'diagnostic_uploaded'
  | 'patient_created'
  | 'feedback_submitted'

interface EventMetadata {
  [key: string]: unknown
}

/**
 * Track a usage event
 * Silently fails if tracking fails - tracking should never break the app
 */
export async function trackEvent(
  eventType: EventType,
  metadata: EventMetadata = {}
): Promise<void> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: eventType,
      metadata,
    })
  } catch (error) {
    // Silently fail - tracking shouldn't break the app
    console.error('Failed to track event:', error)
  }
}

/**
 * Track a login event
 */
export const trackLogin = () => trackEvent('login')

/**
 * Track a lab analysis event
 */
export const trackLabAnalysis = (patientId: string, ominousCount?: number) =>
  trackEvent('lab_analysis', { patient_id: patientId, ominous_count: ominousCount })

/**
 * Track a protocol generation event
 */
export const trackProtocolGenerated = (conversationId: string, patientId?: string) =>
  trackEvent('protocol_generated', { conversation_id: conversationId, patient_id: patientId })

/**
 * Track a conversation start event
 */
export const trackConversationStarted = (conversationId: string, conversationType?: string) =>
  trackEvent('conversation_started', {
    conversation_id: conversationId,
    conversation_type: conversationType,
  })

/**
 * Track a diagnostic upload event
 */
export const trackDiagnosticUploaded = (fileType: string, patientId?: string) =>
  trackEvent('diagnostic_uploaded', { file_type: fileType, patient_id: patientId })

/**
 * Track a patient creation event
 */
export const trackPatientCreated = (patientId: string) =>
  trackEvent('patient_created', { patient_id: patientId })

/**
 * Track a feedback submission event
 */
export const trackFeedbackSubmitted = (
  rating: 'positive' | 'negative' | 'neutral',
  messageId?: string,
  feedbackType?: string
) =>
  trackEvent('feedback_submitted', {
    rating,
    message_id: messageId,
    feedback_type: feedbackType,
  })

// Server-side tracking function for API routes
export async function trackEventServer(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  eventType: EventType,
  metadata: EventMetadata = {}
): Promise<void> {
  try {
    await supabase.from('usage_events').insert({
      user_id: userId,
      event_type: eventType,
      metadata,
    })
  } catch (error) {
    console.error('Failed to track event:', error)
  }
}
