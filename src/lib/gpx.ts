import type { TrailLine, TrailTrack } from '../types'
import { simplifyLine } from './simplify'

const TRAIL_COLORS = ['#e85d04', '#219ebc', '#90be6d', '#9b5de5', '#f72585', '#ffb703']

export function nextTrailColor(existingCount: number): string {
  return TRAIL_COLORS[existingCount % TRAIL_COLORS.length]!
}

/** Map difficulty ratings to trail line colors. */
export function colorForSkillLevel(skillLevel: string | undefined): string {
  switch ((skillLevel ?? '').trim().toLowerCase()) {
    case 'green':
      return '#16a34a'
    case 'blue':
      return '#2563eb'
    case 'black':
      return '#171717'
    case 'double black':
      return '#dc2626'
    case 'pro line':
      return '#ea580c'
    case 'access':
      return '#94a3b8'
    default:
      return '#c4c4c4'
  }
}

/** Match elements regardless of GPX xmlns (Trailforks uses a default namespace). */
function byLocalName(root: ParentNode, localName: string): Element[] {
  return Array.from((root as Document | Element).getElementsByTagNameNS('*', localName))
}

function firstByLocalName(root: ParentNode, localName: string): Element | null {
  return byLocalName(root, localName)[0] ?? null
}

export function parseGpx(
  xmlText: string,
  fallbackName: string,
): Omit<TrailTrack, 'id' | 'color' | 'opacity' | 'createdAt'> {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid GPX file')
  }

  const metadataEl = firstByLocalName(doc, 'metadata')
  const metadataName = metadataEl ? textContent(firstByLocalName(metadataEl, 'name')) : ''
  const lines: TrailLine[] = []

  for (const trk of byLocalName(doc, 'trk')) {
    const segs = byLocalName(trk, 'trkseg')
    if (segs.length === 0) {
      const coordinates = readPoints(trk, 'trkpt')
      if (coordinates.length >= 2) lines.push({ coordinates })
      continue
    }
    for (const seg of segs) {
      const coordinates = readPoints(seg, 'trkpt')
      if (coordinates.length >= 2) lines.push({ coordinates })
    }
  }

  for (const rte of byLocalName(doc, 'rte')) {
    const coordinates = readPoints(rte, 'rtept')
    if (coordinates.length >= 2) lines.push({ coordinates })
  }

  if (lines.length === 0) {
    const coordinates = readPoints(doc.documentElement, 'wpt')
    if (coordinates.length >= 2) lines.push({ coordinates })
  }

  if (lines.length === 0) {
    throw new Error('No track points found in this GPX file')
  }

  const trk = firstByLocalName(doc, 'trk')
  const rte = firstByLocalName(doc, 'rte')
  const trkName = trk ? textContent(firstByLocalName(trk, 'name')) : ''
  const rteName = rte ? textContent(firstByLocalName(rte, 'name')) : ''
  const name = metadataName || trkName || rteName || fallbackName

  return {
    name,
    lines,
    source: 'gpx',
  }
}

function readPoints(parent: Element, tag: string): Array<[number, number]> {
  const coords: Array<[number, number]> = []
  for (const pt of byLocalName(parent, tag)) {
    const lat = Number(pt.getAttribute('lat'))
    const lon = Number(pt.getAttribute('lon'))
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      coords.push([lon, lat])
    }
  }
  return coords
}

function textContent(el: Element | null | undefined): string {
  return el?.textContent?.trim() ?? ''
}

export function trackBounds(track: TrailTrack): [[number, number], [number, number]] | null {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  let any = false

  for (const line of track.lines) {
    for (const [lng, lat] of line.coordinates) {
      any = true
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    }
  }

  if (!any) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

export type TracksToGeoJsonOptions = {
  /** Douglas–Peucker tolerance in degrees; omit to keep full geometry. */
  simplifyTolerance?: number
}

export function tracksToGeoJson(
  tracks: TrailTrack[],
  options: TracksToGeoJsonOptions = {},
): {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    properties: {
      id: string
      name: string
      color: string
      opacity: number
      lineIndex: number
      skillLevel: string
    }
    geometry: {
      type: 'LineString'
      coordinates: Array<[number, number]>
    }
  }>
} {
  const { simplifyTolerance } = options
  const features = []
  for (const track of tracks) {
    for (let i = 0; i < track.lines.length; i++) {
      const raw = track.lines[i]!.coordinates
      const coordinates =
        simplifyTolerance && simplifyTolerance > 0
          ? simplifyLine(raw, simplifyTolerance)
          : raw
      features.push({
        type: 'Feature' as const,
        properties: {
          id: track.id,
          name: track.name,
          color: track.color,
          opacity: track.opacity,
          lineIndex: i,
          skillLevel: track.skillLevel ?? '',
        },
        geometry: {
          type: 'LineString' as const,
          coordinates,
        },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}
