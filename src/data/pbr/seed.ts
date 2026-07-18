import { parseGpx, colorForSkillLevel, trackBounds } from '../../lib/gpx'
import { deleteTrack, loadTracks, saveTrack } from '../../lib/storage'
import type { TrailLine, TrailTrack } from '../../types'

/** Bump when GPX files or trail metadata change so existing installs refresh. */
export const PBR_SEED_VERSION = 7
const SEED_VERSION_KEY = 'trailbuilt:pbr-seed-v'

const gpxFiles = import.meta.glob('./gpx/*.gpx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

type SeedGroup = {
  id: string
  name: string
  skillLevel: string
  /** Basenames under ./gpx/ (without path). First matching files win in order. */
  files: string[]
}

/** Merge Trailforks segment exports into one library entry per named trail. */
const SEED_GROUPS: SeedGroup[] = [
  {
    id: 'pbr:first-rodeo',
    name: 'First Rodeo',
    skillLevel: 'Green',
    files: ['first-rodeo-837925-2.gpx'],
  },
  {
    id: 'pbr:bar-dog',
    name: 'Bar Dog',
    skillLevel: 'Blue',
    files: ['bar-dog-upper.gpx', 'bar-dog-middle.gpx', 'bar-dog-lower.gpx'],
  },
  {
    id: 'pbr:darlin',
    name: "Darlin'",
    skillLevel: 'Blue',
    files: ['darlin.gpx'],
  },
  {
    id: 'pbr:snot-rocket',
    name: 'Snot Rocket',
    skillLevel: 'Blue',
    files: ['snot-rocket.gpx'],
  },
  {
    id: 'pbr:ramblin-man',
    name: "Ramblin' Man",
    skillLevel: 'Blue',
    files: ['ramblin--man-839575.gpx'],
  },
  {
    id: 'pbr:turn-n-burn',
    name: "Turn n' Burn",
    skillLevel: 'Black',
    files: ['turn-n--burn-837079-2.gpx', 'turn-n--burn-lower.gpx'],
  },
  {
    id: 'pbr:b90',
    name: 'B90',
    skillLevel: 'Black',
    files: ['b90.gpx'],
  },
  {
    id: 'pbr:hellbent',
    name: 'Hellbent',
    skillLevel: 'Black',
    files: ['hell-bent.gpx'],
  },
  {
    id: 'pbr:rank-ride',
    name: 'Rank Ride',
    skillLevel: 'Double Black',
    files: ['rank-ride.gpx'],
  },
  {
    id: 'pbr:rated-r',
    name: 'Rated R',
    skillLevel: 'Pro Line',
    files: ['rated-r-upper.gpx', 'rated-r-lower.gpx'],
  },
  {
    id: 'pbr:access-road',
    name: 'Access Road',
    skillLevel: 'Access',
    files: ['panhandle-bike-ranch-access-road-836446.gpx'],
  },
  {
    id: 'pbr:shuttle-road',
    name: 'Shuttle Road',
    skillLevel: 'Access',
    files: ['shuttle-road-835476.gpx'],
  },
]

function fileKey(basename: string): string | undefined {
  return Object.keys(gpxFiles).find((path) => path.endsWith(`/${basename}`))
}

function linesFromGpx(basename: string): TrailLine[] {
  const key = fileKey(basename)
  if (!key) {
    console.warn(`[pbr seed] missing GPX: ${basename}`)
    return []
  }
  const xml = gpxFiles[key]
  if (!xml) return []
  try {
    return parseGpx(xml, basename).lines
  } catch (err) {
    console.warn(`[pbr seed] failed to parse ${basename}`, err)
    return []
  }
}

export function buildPbrSeedTracks(): TrailTrack[] {
  const createdAt = Date.UTC(2025, 0, 1)
  const tracks: TrailTrack[] = []

  for (let i = 0; i < SEED_GROUPS.length; i++) {
    const group = SEED_GROUPS[i]!
    const lines: TrailLine[] = []
    for (const file of group.files) {
      lines.push(...linesFromGpx(file))
    }
    if (lines.length === 0) continue
    tracks.push({
      id: group.id,
      name: group.name,
      lines,
      color: colorForSkillLevel(group.skillLevel),
      opacity: 0.9,
      createdAt: createdAt + i,
      source: 'pbr-seed',
      skillLevel: group.skillLevel,
    })
  }

  return tracks
}

export function isPbrSeedTrack(track: TrailTrack): boolean {
  return track.source === 'pbr-seed' || track.id.startsWith('pbr:')
}

/** Ensure baked-in PBR trails exist in IndexedDB. Re-writes when seed version bumps. */
export async function ensurePbrSeedTracks(): Promise<TrailTrack[]> {
  const seeds = buildPbrSeedTracks()
  const seedIds = new Set(seeds.map((s) => s.id))
  const existing = await loadTracks()
  const byId = new Map(existing.map((t) => [t.id, t]))
  const storedVersion = localStorage.getItem(SEED_VERSION_KEY)
  const needsRefresh = storedVersion !== String(PBR_SEED_VERSION)

  for (const seed of seeds) {
    const prev = byId.get(seed.id)
    const missingMeta = Boolean(prev && !prev.skillLevel)
    if (!prev || needsRefresh || missingMeta) {
      // Keep any user opacity tweak when only patching metadata.
      const next =
        prev && !needsRefresh && missingMeta
          ? { ...seed, opacity: prev.opacity, createdAt: prev.createdAt }
          : seed
      await saveTrack(next)
      byId.set(seed.id, next)
    }
  }

  // Drop retired seed trails that are no longer in SEED_GROUPS.
  for (const track of [...byId.values()]) {
    if (!isPbrSeedTrack(track) || seedIds.has(track.id)) continue
    await deleteTrack(track.id)
    byId.delete(track.id)
  }

  if (needsRefresh || seeds.some((s) => !byId.get(s.id)?.skillLevel)) {
    localStorage.setItem(SEED_VERSION_KEY, String(PBR_SEED_VERSION))
  }

  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt)
}

export function pbrNetworkBounds(
  tracks: TrailTrack[],
): [[number, number], [number, number]] | null {
  const seeded = tracks.filter(isPbrSeedTrack)
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  let any = false

  for (const track of seeded.length ? seeded : tracks) {
    const b = trackBounds(track)
    if (!b) continue
    any = true
    minLng = Math.min(minLng, b[0][0])
    minLat = Math.min(minLat, b[0][1])
    maxLng = Math.max(maxLng, b[1][0])
    maxLat = Math.max(maxLat, b[1][1])
  }

  if (!any) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}
