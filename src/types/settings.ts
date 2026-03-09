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
  eval_mode_enabled: boolean
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
  eval_mode_enabled?: boolean
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

// AI Provider type
export type AIProvider = 'anthropic'

// Available AI providers
export const AVAILABLE_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)', description: 'Extended thinking, tool use, vision' },
] as const

// Available Anthropic model options for the dropdown
export const AVAILABLE_MODELS = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Most capable, deep reasoning', provider: 'anthropic' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Best balance of speed and capability', provider: 'anthropic' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', description: 'Fast model for simple tasks', provider: 'anthropic' },
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
