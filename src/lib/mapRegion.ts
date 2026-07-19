/**
 * Priest Ridge / Sandpoint-area trail network (North Idaho).
 * Constraining the camera here prevents world-scale tile loads on mobile.
 *
 * Coordinate constants use [lng, lat] (GeoJSON order).
 * Convert with `toLatLng` / `toLatLngBounds` at the Leaflet boundary ([lat, lng]).
 */
import L from 'leaflet'

export const PBR_CENTER: [number, number] = [-116.53, 48.155]

export const PBR_DEFAULT_ZOOM = 13.25

/** Prevent zooming out far enough to pull continental / world tiles. */
export const PBR_MIN_ZOOM = 11

export const PBR_MAX_ZOOM = 18

/**
 * North Idaho panhandle around the PBR network.
 * [SW, NE] as [lng, lat] pairs.
 */
export const PBR_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-117.35, 47.55],
  [-115.85, 48.75],
]

export function isInsidePbrRegion(lng: number, lat: number): boolean {
  const [[west, south], [east, north]] = PBR_MAX_BOUNDS
  return lng >= west && lng <= east && lat >= south && lat <= north
}

export function toLatLng(lngLat: [number, number]): L.LatLngExpression {
  return [lngLat[1], lngLat[0]]
}

/** Convert [[minLng, minLat], [maxLng, maxLat]] → Leaflet LatLngBounds. */
export function toLatLngBounds(bounds: [[number, number], [number, number]]): L.LatLngBounds {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds
  return L.latLngBounds([minLat, minLng], [maxLat, maxLng])
}
