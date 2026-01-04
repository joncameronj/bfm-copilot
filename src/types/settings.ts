import type { Database } from './database'

// Profile type from database
export type Profile = Database['public']['Tables']['profiles']['Row']

// User preferences type
export interface UserPreferences {
  id: string
  user_id: string
  email_lab_results: boolean
  email_protocol_updates: boolean
  email_system_announcements: boolean
  email_weekly_digest: boolean
  default_patient_view: 'list' | 'grid'
  auto_save_notes: boolean
  health_reminder_frequency: 'daily' | 'weekly' | 'monthly' | 'never'
  share_progress_with_practitioner: boolean
  created_at: string
  updated_at: string
}

// API payloads
export interface ProfileUpdatePayload {
  fullName?: string
}

export interface PasswordChangePayload {
  currentPassword: string
  newPassword: string
}

export interface PreferencesUpdatePayload {
  email_lab_results?: boolean
  email_protocol_updates?: boolean
  email_system_announcements?: boolean
  email_weekly_digest?: boolean
  default_patient_view?: 'list' | 'grid'
  auto_save_notes?: boolean
  health_reminder_frequency?: 'daily' | 'weekly' | 'monthly' | 'never'
  share_progress_with_practitioner?: boolean
}

// Model settings for AI configuration
export type ReasoningEffort = 'low' | 'medium' | 'high'
export type ReasoningSummary = 'auto' | 'concise' | 'detailed'

export interface ModelSettings {
  chat_model: string
  reasoning_effort: ReasoningEffort
  reasoning_summary: ReasoningSummary
}

export interface ModelSettingsUpdatePayload {
  chat_model?: string
  reasoning_effort?: ReasoningEffort
  reasoning_summary?: ReasoningSummary
}

// Available model options for the dropdown
export const AVAILABLE_MODELS = [
  { value: 'gpt-5.2', label: 'GPT-5.2', description: 'Latest flagship model with extended thinking' },
  { value: 'gpt-4.5-preview', label: 'GPT-4.5 Preview', description: 'Preview of next generation model' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Fast multimodal model' },
  { value: 'o1', label: 'o1', description: 'Advanced reasoning model' },
  { value: 'o1-mini', label: 'o1-mini', description: 'Efficient reasoning model' },
  { value: 'o3-mini', label: 'o3-mini', description: 'Latest efficient reasoning model' },
] as const

export const REASONING_EFFORT_OPTIONS = [
  { value: 'low', label: 'Low', description: 'Faster responses, less thorough reasoning' },
  { value: 'medium', label: 'Medium', description: 'Balanced speed and reasoning depth' },
  { value: 'high', label: 'High', description: 'Most thorough reasoning, slower responses' },
] as const

export const REASONING_SUMMARY_OPTIONS = [
  { value: 'auto', label: 'Auto', description: 'Let the model decide summary level' },
  { value: 'concise', label: 'Concise', description: 'Brief reasoning summaries' },
  { value: 'detailed', label: 'Detailed', description: 'Comprehensive reasoning explanations' },
] as const
