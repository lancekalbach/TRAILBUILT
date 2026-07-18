import type { Map as MapLibreMap } from 'maplibre-gl'
import type { GpsPosition } from '../types'
import { isInsidePbrRegion, PBR_MAX_ZOOM } from './mapRegion'

export function flyToGps(map: MapLibreMap, gps: GpsPosition, zoom = 15) {
  if (!isInsidePbrRegion(gps.lng, gps.lat)) return false

  map.easeTo({
    center: [gps.lng, gps.lat],
    zoom: Math.min(Math.max(map.getZoom(), zoom), PBR_MAX_ZOOM),
    duration: 700,
  })
  return true
}
