import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  role: UserRole
  created_at: string
}

export type MarkerRow = {
  id: string
  lng: number
  lat: number
  kind: string
  note: string | null
  track_id: string | null
  created_at: string
  created_by: string | null
  participant_ids: string[] | null
  completed_at: string | null
}

export type TrailStatusRow = {
  id: string
  status: string
  updated_at: string
  updated_by: string | null
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: {
          id: string
          email?: string | null
          display_name?: string | null
          role?: UserRole
          created_at?: string
        }
        Update: {
          email?: string | null
          display_name?: string | null
          role?: UserRole
        }
        Relationships: []
      }
      markers: {
        Row: MarkerRow
        Insert: {
          id?: string
          lng: number
          lat: number
          kind: string
          note?: string | null
          track_id?: string | null
          created_at?: string
          created_by?: string | null
          participant_ids?: string[]
          completed_at?: string | null
        }
        Update: {
          lng?: number
          lat?: number
          kind?: string
          note?: string | null
          track_id?: string | null
          created_by?: string | null
          participant_ids?: string[]
          completed_at?: string | null
        }
        Relationships: []
      }
      trail_statuses: {
        Row: TrailStatusRow
        Insert: {
          id: string
          status: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      accept_marker_task: {
        Args: { marker_id: string }
        Returns: MarkerRow
      }
      complete_marker_task: {
        Args: { marker_id: string }
        Returns: MarkerRow
      }
    }
    Enums: {
      user_role: UserRole
    }
    CompositeTypes: Record<string, never>
  }
}

function createSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Placeholder client so imports don't crash before env is configured.
    return createClient<Database>('https://placeholder.supabase.co', 'public-anon-key')
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

export const supabase = createSupabaseClient()
