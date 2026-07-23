export type TrailOpenStatus = 'open' | 'partial' | 'closed'

export type TrailDifficulty =
  | 'Green'
  | 'Blue'
  | 'Black'
  | 'Double Black'
  | 'Pro Line'

export type TrailStatusEntry = {
  id: string
  name: string
  difficulty: TrailDifficulty
  status: TrailOpenStatus
}

export const TRAIL_STATUS_LABELS: Record<TrailOpenStatus, string> = {
  open: 'Open',
  partial: 'Partially open',
  closed: 'Closed',
}

export const TRAIL_OPEN_STATUSES: TrailOpenStatus[] = ['open', 'partial', 'closed']

/** Rideable trails only, easiest → hardest. Default status is open. */
export const TRAIL_STATUS_LIST: TrailStatusEntry[] = [
  { id: 'pbr:first-rodeo', name: 'First Rodeo', difficulty: 'Green', status: 'open' },
  { id: 'pbr:bar-dog', name: 'Bar Dog', difficulty: 'Blue', status: 'open' },
  { id: 'pbr:darlin', name: "Darlin'", difficulty: 'Blue', status: 'open' },
  { id: 'pbr:snot-rocket', name: 'Snot Rocket', difficulty: 'Blue', status: 'open' },
  { id: 'pbr:ramblin-man', name: "Ramblin' Man", difficulty: 'Blue', status: 'open' },
  { id: 'pbr:turn-n-burn', name: "Turn n' Burn", difficulty: 'Black', status: 'open' },
  { id: 'pbr:b90', name: 'B90', difficulty: 'Black', status: 'open' },
  { id: 'pbr:hellbent', name: 'Hellbent', difficulty: 'Black', status: 'open' },
  { id: 'pbr:rank-ride', name: 'Rank Ride', difficulty: 'Double Black', status: 'open' },
  { id: 'pbr:rated-r', name: 'Rated R', difficulty: 'Pro Line', status: 'open' },
]

export function withTrailStatuses(
  overrides: Partial<Record<string, TrailOpenStatus>>,
): TrailStatusEntry[] {
  return TRAIL_STATUS_LIST.map((trail) => ({
    ...trail,
    status: overrides[trail.id] ?? trail.status,
  }))
}

export function getTrailOpenStatus(
  trackId: string,
  overrides?: Partial<Record<string, TrailOpenStatus>>,
): TrailOpenStatus | null {
  if (overrides && trackId in overrides) {
    return overrides[trackId] ?? null
  }
  const fallback = TRAIL_STATUS_LIST.find((trail) => trail.id === trackId)
  return fallback?.status ?? null
}
