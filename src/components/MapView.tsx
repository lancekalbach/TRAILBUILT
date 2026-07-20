import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GpsPosition, TrailTrack } from '../types'
import { trackBounds, tracksToGeoJson } from '../lib/gpx'
import {
  isInsidePbrRegion,
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

const TRACKS_SOURCE = 'trail-tracks'
const TRACKS_LINE = 'trail-tracks-line'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

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
    const beforeId = map.getLayer(TRACKS_LINE) ? TRACKS_LINE : undefined
    map.addLayer(
      {
        id: SATELLITE_LAYER,
        type: 'raster',
        source: SATELLITE_SOURCE,
        layout: { visibility: 'none' },
      },
      beforeId,
    )
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

function ensureTrackLayers(map: MapLibreMap, mobile: boolean) {
  if (!map.getSource(TRACKS_SOURCE)) {
    map.addSource(TRACKS_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      tolerance: mobile ? 2 : 0.5,
      buffer: mobile ? 0 : 64,
    })
  }

  if (!map.getLayer(TRACKS_LINE)) {
    map.addLayer({
      id: TRACKS_LINE,
      type: 'line',
      source: TRACKS_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': mobile ? 4 : 3.5,
        'line-opacity': ['coalesce', ['get', 'opacity'], 0.95],
      },
    })
  }
}

type MapViewProps = {
  tracks?: TrailTrack[]
  gps: GpsPosition | null
  followGps: boolean
  onFollowChange?: (follow: boolean) => void
  onMapReady?: (map: MapLibreMap | null) => void
  focusTrackId?: string | null
  className?: string
}

export function MapView({
  tracks = [],
  gps,
  followGps,
  onFollowChange,
  onMapReady,
  focusTrackId,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const gpsMarkerRef = useRef<Marker | null>(null)
  const basemapRef = useRef<BasemapId>('streets')
  const mobileRef = useRef(false)
  const tracksRef = useRef(tracks)
  const followGpsRef = useRef(followGps)
  const onMapReadyRef = useRef(onMapReady)
  const onFollowChangeRef = useRef(onFollowChange)

  tracksRef.current = tracks
  followGpsRef.current = followGps
  onMapReadyRef.current = onMapReady
  onFollowChangeRef.current = onFollowChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const mobile = isMobileMapDevice()
    mobileRef.current = mobile
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

    const breakFollow = () => {
      if (!followGpsRef.current) return
      onFollowChangeRef.current?.(false)
    }
    map.on('dragstart', breakFollow)
    map.on('zoomstart', breakFollow)

    map.on('load', () => {
      ensureTrackLayers(map, mobile)
      const source = map.getSource(TRACKS_SOURCE) as GeoJSONSource
      source.setData(
        tracksToGeoJson(tracksRef.current, {
          simplifyTolerance: mobile ? 0.00006 : 0.00003,
        }),
      )
      syncBasemapForZoom()
      onMapReadyRef.current?.(map)
    })
    map.on('zoomend', syncBasemapForZoom)

    mapRef.current = map

    return () => {
      gpsMarkerRef.current?.remove()
      gpsMarkerRef.current = null
      onMapReadyRef.current?.(null)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getSource(TRACKS_SOURCE)) return
    const source = map.getSource(TRACKS_SOURCE) as GeoJSONSource
    const mobile = mobileRef.current
    source.setData(
      tracksToGeoJson(tracks, {
        simplifyTolerance: mobile ? 0.00006 : 0.00003,
      }),
    )
  }, [tracks])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusTrackId) return
    const track = tracks.find((t) => t.id === focusTrackId)
    if (!track) return
    const bounds = trackBounds(track)
    if (!bounds) return
    map.fitBounds(bounds, {
      padding: 56,
      maxZoom: 16,
      animate: !prefersReducedMotion(),
      duration: 800,
    })
  }, [focusTrackId, tracks])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !gps) return

    const lngLat: [number, number] = [gps.lng, gps.lat]

    if (!gpsMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'gps-dot'
      gpsMarkerRef.current = new maplibregl.Marker({ element: el, pitchAlignment: 'map' })
        .setLngLat(lngLat)
        .addTo(map)
    } else {
      gpsMarkerRef.current.setLngLat(lngLat)
    }

    if (followGpsRef.current && isInsidePbrRegion(gps.lng, gps.lat)) {
      map.jumpTo({ center: lngLat })
    }
  }, [gps])

  return <div ref={containerRef} className={className ?? 'map-root'} />
}
