import type { TrailTrack } from '../types'

const EARTH_RADIUS_M = 6_371_000

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function haversineMeters(a: [number, number], b: [number, number]) {
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Total distance across every line segment in a trail. */
export function trackLengthMeters(track: TrailTrack): number {
  let total = 0
  for (const line of track.lines) {
    for (let i = 0; i < line.coordinates.length - 1; i++) {
      total += haversineMeters(line.coordinates[i]!, line.coordinates[i + 1]!)
    }
  }
  return total
}

function nearestOnSegment(
  point: [number, number],
  a: [number, number],
  b: [number, number],
): { point: [number, number]; distance: number } {
  const [px, py] = point
  const [ax, ay] = a
  const [bx, by] = b
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    return { point: a, distance: haversineMeters(point, a) }
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  const snapped: [number, number] = [ax + t * dx, ay + t * dy]
  return { point: snapped, distance: haversineMeters(point, snapped) }
}

export type NearestTrailPoint = {
  lng: number
  lat: number
  trackId: string
  distance: number
}

/** Snap a lng/lat to the nearest point on any trail line within maxDistanceMeters. */
export function nearestPointOnTrails(
  lng: number,
  lat: number,
  tracks: TrailTrack[],
  maxDistanceMeters = 80,
): NearestTrailPoint | null {
  const query: [number, number] = [lng, lat]
  let best: NearestTrailPoint | null = null

  for (const track of tracks) {
    for (const line of track.lines) {
      const coords = line.coordinates
      for (let i = 0; i < coords.length - 1; i++) {
        const { point, distance } = nearestOnSegment(query, coords[i]!, coords[i + 1]!)
        if (distance > maxDistanceMeters) continue
        if (!best || distance < best.distance) {
          best = { lng: point[0], lat: point[1], trackId: track.id, distance }
        }
      }
    }
  }

  return best
}
