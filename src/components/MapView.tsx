/**
 * Official MapLibre "Display a map" demo, ported to React.
 * @see https://maplibre.org/maplibre-gl-js/docs/examples/display-a-map/
 */
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current, // container id
      style: 'https://demotiles.maplibre.org/style.json', // style URL
      center: [0, 0], // starting position [lng, lat]
      zoom: 1, // starting zoom
      maplibreLogo: true,
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Match demo: html, body, #map { height: 100%; }
  return (
    <div
      ref={containerRef}
      id="map"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
