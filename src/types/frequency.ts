/**
 * Types for approved frequency protocols and manual protocol builder
 */

export type FrequencyCategory = 'general' | 'thyroid' | 'diabetes' | 'neurological' | 'hormones'

/**
 * Approved frequency from the approved_frequency_names table
 */
export interface ApprovedFrequency {
  id: string
  name: string
  aliases: string[]
  category: FrequencyCategory
  description: string | null
  sourceImageId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Filters for browsing approved frequencies
 */
export interface FrequencyFilters {
  category?: FrequencyCategory | 'all'
  search?: string
  isActive?: boolean
  limit?: number
}

/**
 * Frequency usage in a treatment session
 */
export interface FrequencyUsed {
  id: string
  name: string
}

/**
 * Request body for creating a manual treatment session
 */
export interface ManualProtocolInput {
  patientId: string
  frequencyIds: string[]
  sessionDate: string
  sessionTime?: string
  effect?: 'positive' | 'negative' | 'nil'
  notes?: string
}

/**
 * API response for approved frequencies
 */
export interface ApprovedFrequenciesResponse {
  frequencies: ApprovedFrequency[]
  total: number
}

/**
 * API response for creating a treatment session
 */
export interface TreatmentSessionResponse {
  id: string
  patientId: string
  practitionerId: string
  sessionDate: string
  sessionTime: string | null
  frequenciesUsed: FrequencyUsed[]
  effect: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}
