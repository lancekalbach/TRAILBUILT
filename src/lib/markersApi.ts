import type { TrailMarker, TrailMarkerKind } from '../types'
import { isSupabaseConfigured, supabase, type MarkerRow } from './supabase'

function rowToMarker(row: MarkerRow): TrailMarker {
  return {
    id: row.id,
    lng: row.lng,
    lat: row.lat,
    kind: row.kind as TrailMarkerKind,
    note: row.note ?? undefined,
    trackId: row.track_id ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    createdBy: row.created_by ?? undefined,
    participantIds: row.participant_ids ?? [],
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
  }
}

export async function loadMarkers(): Promise<TrailMarker[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('markers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(rowToMarker)
}

export async function saveMarker(marker: TrailMarker, userId: string): Promise<TrailMarker> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('markers')
    .insert({
      id: marker.id,
      lng: marker.lng,
      lat: marker.lat,
      kind: marker.kind,
      note: marker.note ?? null,
      track_id: marker.trackId ?? null,
      created_at: new Date(marker.createdAt).toISOString(),
      created_by: userId,
      participant_ids: marker.participantIds ?? [],
      completed_at: marker.completedAt ? new Date(marker.completedAt).toISOString() : null,
    })
    .select('*')
    .single()

  if (error) throw error
  return rowToMarker(data)
}

export async function acceptMarkerTask(markerId: string): Promise<TrailMarker> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase.rpc('accept_marker_task', {
    marker_id: markerId,
  })

  if (error) throw error
  return rowToMarker(data as MarkerRow)
}

export async function completeMarkerTask(markerId: string): Promise<TrailMarker> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase.rpc('complete_marker_task', {
    marker_id: markerId,
  })

  if (error) throw error
  return rowToMarker(data as MarkerRow)
}

export async function deleteMarker(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

  const { error } = await supabase.from('markers').delete().eq('id', id)
  if (error) throw error
}

export function subscribeMarkers(onChange: (markers: TrailMarker[]) => void): () => void {
  if (!isSupabaseConfigured) return () => undefined

  const channel = supabase
    .channel('markers-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'markers' }, () => {
      void loadMarkers()
        .then(onChange)
        .catch(() => undefined)
    })
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
