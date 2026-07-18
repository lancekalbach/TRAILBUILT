import type { Feature, FeatureCollection, Point } from 'geojson'
import type { TrailMarker } from '../types'
import { markerKindMeta } from './markerKinds'

export { MARKER_KINDS, markerKindIconSvg, markerKindMeta } from './markerKinds'
export type { MarkerKindMeta } from './markerKinds'

export function markersToGeoJson(markers: TrailMarker[]): FeatureCollection<Point> {
  const features: Feature<Point>[] = markers.map((marker) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [marker.lng, marker.lat] },
    properties: {
      id: marker.id,
      kind: marker.kind,
      note: marker.note ?? '',
      trackId: marker.trackId ?? '',
      createdAt: marker.createdAt,
      label: markerKindMeta(marker.kind).label,
    },
  }))
  return { type: 'FeatureCollection', features }
}
