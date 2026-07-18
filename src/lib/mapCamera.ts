import type { Map as MapLibreMap } from 'maplibre-gl'
import type { GpsPosition } from '../types'

export function flyToGps(map: MapLibreMap, gps: GpsPosition, zoom = 15) {
  map.easeTo({
    center: [gps.lng, gps.lat],
    zoom: Math.max(map.getZoom(), zoom),
    duration: 700,
  })
}
