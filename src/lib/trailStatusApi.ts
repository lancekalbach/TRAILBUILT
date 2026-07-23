import type { TrailOpenStatus } from '../data/trailStatus'
import { isSupabaseConfigured, supabase } from './supabase'

export type TrailStatusMap = Record<string, TrailOpenStatus>

function isTrailOpenStatus(value: string): value is TrailOpenStatus {
  return value === 'open' || value === 'partial' || value === 'closed'
}

export async function loadTrailStatuses(): Promise<TrailStatusMap> {
  if (!isSupabaseConfigured) return {}

  const { data, error } = await supabase.from('trail_statuses').select('id, status')
  if (error) throw error

  const map: TrailStatusMap = {}
  for (const row of data ?? []) {
    if (isTrailOpenStatus(row.status)) map[row.id] = row.status
  }
  return map
}

export async function updateTrailStatus(
  id: string,
  status: TrailOpenStatus,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('trail_statuses').upsert({
    id,
    status,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  })
  if (error) throw error
}

export function subscribeTrailStatuses(onChange: (statuses: TrailStatusMap) => void): () => void {
  if (!isSupabaseConfigured) return () => undefined

  const channel = supabase
    .channel('trail-statuses')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trail_statuses' }, () => {
      void loadTrailStatuses()
        .then(onChange)
        .catch(() => undefined)
    })
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
