import type { Map as LeafletMap } from 'leaflet'
import type { GpsPosition } from '../types'
import { isInsidePbrRegion, PBR_MAX_ZOOM } from './mapRegion'

export function flyToGps(map: LeafletMap, gps: GpsPosition, zoom = 15): boolean {
  if (!isInsidePbrRegion(gps.lng, gps.lat)) return false

  map.flyTo([gps.lat, gps.lng], Math.min(Math.max(map.getZoom(), zoom), PBR_MAX_ZOOM), {
    duration: 0.7,
  })
  return true
}
