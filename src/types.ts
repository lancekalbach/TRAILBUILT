export type LngLat = {
  lng: number
  lat: number
}

/** One continuous polyline from a GPX track/route segment */
export type TrailLine = {
  coordinates: Array<[number, number]> // [lng, lat]
}

export type TrailTrack = {
  id: string
  name: string
  lines: TrailLine[]
  color: string
  opacity: number
  createdAt: number
  source?: string
  /** e.g. "Green", "Blue", "Black", "Double Black", "Pro Line" */
  skillLevel?: string
}

export type GpsPosition = {
  lng: number
  lat: number
  accuracy: number | null
}

export type LibrarySelection = { kind: 'track'; id: string } | null

export type TrailMarkerKind =
  | 'hazard'
  | 'downed-tree'
  | 'puddle'
  | 'clogged-culvert'
  | 'washout'
  | 'maintenance'

export type TrailMarker = {
  id: string
  lng: number
  lat: number
  kind: TrailMarkerKind
  note?: string
  trackId?: string
  createdAt: number
}

export type MarkerPlacementMode = 'idle' | 'selecting'
