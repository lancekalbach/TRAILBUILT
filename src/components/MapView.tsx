import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  PBR_CENTER,
  PBR_DEFAULT_ZOOM,
  PBR_MAX_BOUNDS,
  PBR_MAX_ZOOM,
  PBR_MIN_ZOOM,
} from '../lib/mapRegion'

type BasemapId = 'streets' | 'satellite'

const OSM_LAYER = 'osm'
const SATELLITE_SOURCE = 'satellite'
const SATELLITE_LAYER = 'satellite'
/** Auto-swap to satellite at this zoom. */
const SAT_ZOOM = 13.5

function isMobileMapDevice(): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 900px)').matches
  )
}

/** Streets-only initially — satellite is added lazily when zoom crosses SAT_ZOOM. */
function buildMapStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        minzoom: Math.max(0, PBR_MIN_ZOOM - 1),
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: OSM_LAYER,
        type: 'raster',
        source: 'osm',
        layout: { visibility: 'visible' },
      },
    ],
  }
}

function ensureSatelliteLayer(map: MapLibreMap) {
  if (!map.getSource(SATELLITE_SOURCE)) {
    map.addSource(SATELLITE_SOURCE, {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      minzoom: Math.max(0, PBR_MIN_ZOOM - 1),
      maxzoom: 19,
      attribution:
        'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    })
  }

  if (!map.getLayer(SATELLITE_LAYER)) {
    map.addLayer({
      id: SATELLITE_LAYER,
      type: 'raster',
      source: SATELLITE_SOURCE,
      layout: { visibility: 'none' },
    })
  }
}

function unloadSatelliteLayer(map: MapLibreMap) {
  if (map.getLayer(SATELLITE_LAYER)) map.removeLayer(SATELLITE_LAYER)
  if (map.getSource(SATELLITE_SOURCE)) map.removeSource(SATELLITE_SOURCE)
}

function applyBasemap(map: MapLibreMap, mode: BasemapId) {
  if (mode === 'satellite') {
    ensureSatelliteLayer(map)
    if (map.getLayer(OSM_LAYER)) {
      map.setLayoutProperty(OSM_LAYER, 'visibility', 'none')
    }
    if (map.getLayer(SATELLITE_LAYER)) {
      map.setLayoutProperty(SATELLITE_LAYER, 'visibility', 'visible')
    }
    return
  }

  if (map.getLayer(OSM_LAYER)) {
    map.setLayoutProperty(OSM_LAYER, 'visibility', 'visible')
  }
  unloadSatelliteLayer(map)
}

type MapViewProps = {
  onMapReady?: (map: MapLibreMap | null) => void
  className?: string
}

export function MapView({ onMapReady, className }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const basemapRef = useRef<BasemapId>('streets')
  const onMapReadyRef = useRef(onMapReady)
  onMapReadyRef.current = onMapReady

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const mobile = isMobileMapDevice()
    basemapRef.current = 'streets'

    let map: MapLibreMap
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: buildMapStyle(),
        center: PBR_CENTER,
        zoom: PBR_DEFAULT_ZOOM,
        minZoom: PBR_MIN_ZOOM,
        maxZoom: PBR_MAX_ZOOM,
        maxBounds: PBR_MAX_BOUNDS,
        attributionControl: false,
        pixelRatio: mobile ? 1 : undefined,
        fadeDuration: 0,
        maxTileCacheSize: mobile ? 24 : 80,
        maxTileCacheZoomLevels: mobile ? 2 : 5,
        cancelPendingTileRequestsWhileZooming: true,
        refreshExpiredTiles: false,
        renderWorldCopies: false,
        dragRotate: !mobile,
        pitchWithRotate: false,
        touchPitch: !mobile,
        trackResize: true,
      })
    } catch (err) {
      console.error('Failed to create map', err)
      return
    }

    map.addControl(new maplibregl.AttributionControl({ compact: true }))

    const syncBasemapForZoom = () => {
      const next: BasemapId = map.getZoom() >= SAT_ZOOM ? 'satellite' : 'streets'
      if (next === basemapRef.current && (next === 'streets' || map.getLayer(SATELLITE_LAYER))) {
        return
      }
      basemapRef.current = next
      applyBasemap(map, next)
    }

    map.on('load', () => {
      syncBasemapForZoom()
      onMapReadyRef.current?.(map)
    })
    map.on('zoomend', syncBasemapForZoom)

    mapRef.current = map

    return () => {
      onMapReadyRef.current?.(null)
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className={className ?? 'map-root'} />
}
