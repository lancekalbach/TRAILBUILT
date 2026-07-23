import type { UserProfile } from '../types'
import { isSupabaseConfigured, supabase, type ProfileRow } from './supabase'

function rowToProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  }
}

export async function loadProfilesByIds(ids: string[]): Promise<Map<string, UserProfile>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const map = new Map<string, UserProfile>()
  if (!isSupabaseConfigured || unique.length === 0) return map

  const { data, error } = await supabase.from('profiles').select('*').in('id', unique)
  if (error) throw error

  for (const row of data ?? []) {
    map.set(row.id, rowToProfile(row))
  }
  return map
}

export function formatProfileName(
  profile: UserProfile | undefined,
  options?: { selfId?: string | null; fallback?: string },
): string {
  if (options?.selfId && profile?.id === options.selfId) return 'You'
  return profile?.displayName || profile?.email || options?.fallback || 'Crew member'
}
