// Database types - generated from Supabase schema
// This file represents the database schema structure

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'practitioner' | 'member'
          status: 'active' | 'inactive'
          self_patient_id: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'practitioner' | 'member'
          status?: 'active' | 'inactive'
          self_patient_id?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'practitioner' | 'member'
          status?: 'active' | 'inactive'
          self_patient_id?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      patients: {
        Row: {
          id: string
          user_id: string
          first_name: string
          last_name: string
          date_of_birth: string
          gender: 'male' | 'female'
          email: string | null
          phone: string | null
          chief_complaints: string | null
          medical_history: string | null
          current_medications: string[] | null
          allergies: string[] | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          first_name: string
          last_name: string
          date_of_birth: string
          gender: 'male' | 'female'
          email?: string | null
          phone?: string | null
          chief_complaints?: string | null
          medical_history?: string | null
          current_medications?: string[] | null
          allergies?: string[] | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          first_name?: string
          last_name?: string
          date_of_birth?: string
          gender?: 'male' | 'female'
          email?: string | null
          phone?: string | null
          chief_complaints?: string | null
          medical_history?: string | null
          current_medications?: string[] | null
          allergies?: string[] | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          patient_id: string | null
          title: string
          thread_id: string | null
          conversation_type: 'general' | 'lab_analysis' | 'diagnostics' | 'brainstorm'
          message_count: number
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patient_id?: string | null
          title?: string
          thread_id?: string | null
          conversation_type?: 'general' | 'lab_analysis' | 'diagnostics' | 'brainstorm'
          message_count?: number
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          patient_id?: string | null
          title?: string
          thread_id?: string | null
          conversation_type?: 'general' | 'lab_analysis' | 'diagnostics' | 'brainstorm'
          message_count?: number
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          metadata?: Json
          created_at?: string
        }
      }
      lab_results: {
        Row: {
          id: string
          patient_id: string
          user_id: string
          test_date: string
          source_file_url: string | null
          ominous_count: number
          ominous_markers_triggered: string[] | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          user_id: string
          test_date: string
          source_file_url?: string | null
          ominous_count?: number
          ominous_markers_triggered?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          user_id?: string
          test_date?: string
          source_file_url?: string | null
          ominous_count?: number
          ominous_markers_triggered?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      lab_values: {
        Row: {
          id: string
          lab_result_id: string
          marker_id: string
          value: number
          evaluation: string | null
          delta_from_target: number | null
          weakness_text: string | null
          is_ominous: boolean
          created_at: string
        }
        Insert: {
          id?: string
          lab_result_id: string
          marker_id: string
          value: number
          evaluation?: string | null
          delta_from_target?: number | null
          weakness_text?: string | null
          is_ominous?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          lab_result_id?: string
          marker_id?: string
          value?: number
          evaluation?: string | null
          delta_from_target?: number | null
          weakness_text?: string | null
          is_ominous?: boolean
          created_at?: string
        }
      }
      lab_markers: {
        Row: {
          id: string
          name: string
          display_name: string
          category: string
          unit: string | null
          description: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          category: string
          unit?: string | null
          description?: string | null
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          category?: string
          unit?: string | null
          description?: string | null
          display_order?: number
          created_at?: string
        }
      }
      target_ranges: {
        Row: {
          id: string
          marker_id: string
          gender: 'male' | 'female' | 'all' | null
          age_min: number | null
          age_max: number | null
          range_min: number | null
          range_max: number | null
          range_type: 'between' | 'less_than' | 'greater_than'
          display_range: string
          created_at: string
        }
        Insert: {
          id?: string
          marker_id: string
          gender?: 'male' | 'female' | 'all' | null
          age_min?: number | null
          age_max?: number | null
          range_min?: number | null
          range_max?: number | null
          range_type: 'between' | 'less_than' | 'greater_than'
          display_range: string
          created_at?: string
        }
        Update: {
          id?: string
          marker_id?: string
          gender?: 'male' | 'female' | 'all' | null
          age_min?: number | null
          age_max?: number | null
          range_min?: number | null
          range_max?: number | null
          range_type?: 'between' | 'less_than' | 'greater_than'
          display_range?: string
          created_at?: string
        }
      }
      evaluation_rules: {
        Row: {
          id: string
          marker_id: string
          evaluation: 'low' | 'normal' | 'moderate' | 'high'
          value_threshold: number | null
          comparison: 'lt' | 'lte' | 'gt' | 'gte' | 'between' | null
          value_min: number | null
          value_max: number | null
          gender: 'male' | 'female' | 'all' | null
          age_min: number | null
          age_max: number | null
          highlight: boolean
          weakness_text: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          marker_id: string
          evaluation: 'low' | 'normal' | 'moderate' | 'high'
          value_threshold?: number | null
          comparison?: 'lt' | 'lte' | 'gt' | 'gte' | 'between' | null
          value_min?: number | null
          value_max?: number | null
          gender?: 'male' | 'female' | 'all' | null
          age_min?: number | null
          age_max?: number | null
          highlight?: boolean
          weakness_text?: string | null
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          marker_id?: string
          evaluation?: 'low' | 'normal' | 'moderate' | 'high'
          value_threshold?: number | null
          comparison?: 'lt' | 'lte' | 'gt' | 'gte' | 'between' | null
          value_min?: number | null
          value_max?: number | null
          gender?: 'male' | 'female' | 'all' | null
          age_min?: number | null
          age_max?: number | null
          highlight?: boolean
          weakness_text?: string | null
          display_order?: number
          created_at?: string
        }
      }
      ominous_markers: {
        Row: {
          id: string
          name: string
          test_name: string
          threshold: number
          direction: 'above' | 'below'
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          test_name: string
          threshold: number
          direction: 'above' | 'below'
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          test_name?: string
          threshold?: number
          direction?: 'above' | 'below'
          description?: string | null
          created_at?: string
        }
      }
      diagnostic_uploads: {
        Row: {
          id: string
          user_id: string
          patient_id: string | null
          status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error'
          analysis_summary: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patient_id?: string | null
          status?: 'pending' | 'uploading' | 'processing' | 'complete' | 'error'
          analysis_summary?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          patient_id?: string | null
          status?: 'pending' | 'uploading' | 'processing' | 'complete' | 'error'
          analysis_summary?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      diagnostic_files: {
        Row: {
          id: string
          upload_id: string
          filename: string
          file_type: 'd_pulse' | 'hrv' | 'mold_toxicity' | 'blood_panel' | 'other'
          mime_type: string
          size_bytes: number
          storage_path: string
          status: 'pending' | 'uploaded' | 'processed' | 'error'
          created_at: string
        }
        Insert: {
          id?: string
          upload_id: string
          filename: string
          file_type: 'd_pulse' | 'hrv' | 'mold_toxicity' | 'blood_panel' | 'other'
          mime_type: string
          size_bytes: number
          storage_path: string
          status?: 'pending' | 'uploaded' | 'processed' | 'error'
          created_at?: string
        }
        Update: {
          id?: string
          upload_id?: string
          filename?: string
          file_type?: 'd_pulse' | 'hrv' | 'mold_toxicity' | 'blood_panel' | 'other'
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          status?: 'pending' | 'uploaded' | 'processed' | 'error'
          created_at?: string
        }
      }
      feedback: {
        Row: {
          id: string
          user_id: string
          message_id: string | null
          patient_id: string | null
          feedback_type: 'response_quality' | 'protocol_outcome' | 'general'
          rating: 'positive' | 'negative' | 'neutral'
          outcome: 'success' | 'partial' | 'no_improvement' | null
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message_id?: string | null
          patient_id?: string | null
          feedback_type: 'response_quality' | 'protocol_outcome' | 'general'
          rating: 'positive' | 'negative' | 'neutral'
          outcome?: 'success' | 'partial' | 'no_improvement' | null
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message_id?: string | null
          patient_id?: string | null
          feedback_type?: 'response_quality' | 'protocol_outcome' | 'general'
          rating?: 'positive' | 'negative' | 'neutral'
          outcome?: 'success' | 'partial' | 'no_improvement' | null
          comment?: string | null
          created_at?: string
        }
      }
      usage_events: {
        Row: {
          id: string
          user_id: string
          event_type: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_type: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: string
          metadata?: Json
          created_at?: string
        }
      }
      system_config: {
        Row: {
          id: string
          key: string
          value: Json
          description: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          key: string
          value: Json
          description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
      }
    }
  }
}
