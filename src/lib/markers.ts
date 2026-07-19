import type { TrailMarker } from '../types'
import { markerKindMeta } from './markerKinds'

export { MARKER_KINDS, markerKindIconSvg, markerKindMeta } from './markerKinds'
export type { MarkerKindMeta } from './markerKinds'

/** @deprecated kept for any leftover callers — prefer raw TrailMarker[]. */
export function markersToGeoJson(markers: TrailMarker[]) {
  return {
    type: 'FeatureCollection' as const,
    features: markers.map((marker) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [marker.lng, marker.lat] as [number, number] },
      properties: {
        id: marker.id,
        kind: marker.kind,
        note: marker.note ?? '',
        trackId: marker.trackId ?? '',
        createdAt: marker.createdAt,
        label: markerKindMeta(marker.kind).label,
      },
    })),
  }
}
