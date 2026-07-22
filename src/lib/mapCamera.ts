import type { Map as MapLibreMap } from 'maplibre-gl'
import type { GpsPosition } from '../types'
import { isInsidePbrRegion, PBR_MAX_ZOOM } from './mapRegion'

export function flyToGps(map: MapLibreMap, gps: GpsPosition, zoom = 15): boolean {
  return flyToLocation(map, gps.lng, gps.lat, zoom)
}

export function flyToLocation(
  map: MapLibreMap,
  lng: number,
  lat: number,
  zoom = 16,
): boolean {
  if (!isInsidePbrRegion(lng, lat)) return false

  map.easeTo({
    center: [lng, lat],
    zoom: Math.min(Math.max(map.getZoom(), zoom), PBR_MAX_ZOOM),
    duration: 700,
  })
  return true
}
