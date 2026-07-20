import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GpsPosition, MarkerPlacementMode, TrailMarker, TrailTrack } from '../types'
// PERF: overlays disabled
// import type { GeoJSONSource, MapMouseEvent, Marker, Popup } from 'maplibre-gl'
// import { markersToGeoJson, markerKindIconSvg, markerKindMeta } from '../lib/markers'
// import { isInsidePbrRegion } from '../lib/mapRegion'
// import { nearestPointOnTrails } from '../lib/trailGeometry'
import {
  PBR_CENTER,
  PBR_DEFAULT_ZOOM,
  PBR_MAX_BOUNDS,
  PBR_MAX_ZOOM,
  PBR_MIN_ZOOM,
} from '../lib/mapRegion'
import { firstRodeoTrail } from '../data/pbr/vector/firstRodeo'

type LineFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    properties: Record<string, unknown>
    geometry: {
      type: 'LineString'
      coordinates: Array<[number, number]>
    }
  }>
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isMobileMapDevice(): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 900px)').matches
  )
}

type BasemapId = 'streets' | 'satellite'

const OSM_LAYER = 'osm'
const SATELLITE_SOURCE = 'satellite'
const SATELLITE_LAYER = 'satellite'
/** Auto-swap to satellite at this zoom (mobile + desktop). */
const SAT_ZOOM = 13.5

const PERF_TRAIL_SOURCE = 'perf-trail'
const PERF_TRAIL_LINE = 'perf-trail-line'

// PERF: marker overlay disabled
// const MARKERS_SOURCE = 'trail-markers'
// const MARKERS_LAYER = 'trail-markers-symbol'

/** Official MapLibre demo style (vector demotiles). */
function buildMapStyle(): string {
  return 'https://demotiles.maplibre.org/style.json'
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
    const beforeId = map.getLayer(PERF_TRAIL_LINE) ? PERF_TRAIL_LINE : undefined
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

/** Drop satellite source/layer so Esri tiles unload when zoomed back out. */
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

function geoJsonBounds(
  data: LineFeatureCollection,
): [[number, number], [number, number]] | null {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  let any = false

  for (const feature of data.features) {
    const geom = feature.geometry
    if (!geom || geom.type !== 'LineString') continue
    for (const [lng, lat] of geom.coordinates) {
      any = true
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    }
  }

  if (!any) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

// PERF: popups disabled
// function escapeHtml(value: string) { ... }

type MapViewProps = {
  tracks?: TrailTrack[]
  markers?: TrailMarker[]
  gps: GpsPosition | null
  followGps: boolean
  onFollowChange?: (follow: boolean) => void
  onMapReady?: (map: MapLibreMap | null) => void
  interactive?: boolean
  className?: string
  focusTrackId?: string | null
  placementMode?: MarkerPlacementMode
  onPlaceLocation?: (lng: number, lat: number) => void
  onOpenMarkerDetail?: (id: string) => void
}

function ensurePerfTrail(map: MapLibreMap, mobile: boolean) {
  if (!map.getSource(PERF_TRAIL_SOURCE)) {
    map.addSource(PERF_TRAIL_SOURCE, {
      type: 'geojson',
      data: firstRodeoTrail as unknown as LineFeatureCollection,
      tolerance: mobile ? 2 : 0.5,
      buffer: mobile ? 0 : 64,
    })
  }

  if (!map.getLayer(PERF_TRAIL_LINE)) {
    map.addLayer({
      id: PERF_TRAIL_LINE,
      type: 'line',
      source: PERF_TRAIL_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': mobile ? 4 : 3.5,
        'line-opacity': ['coalesce', ['get', 'opacity'], 0.95],
      },
    })
  }
}

/*
PERF: marker layer + warning image disabled
function ensureMarkerLayers(map: MapLibreMap) { ... }
*/

export function MapView({
  // tracks = [],
  // markers = [],
  // gps,
  // followGps,
  // onFollowChange,
  onMapReady,
  interactive = true,
  className,
  // focusTrackId: _focusTrackId,
  // placementMode = 'idle',
  // onPlaceLocation,
  // onOpenMarkerDetail,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  // PERF: overlay refs disabled
  // const gpsMarkerRef = useRef<Marker | null>(null)
  // const trailPopupRef = useRef<Popup | null>(null)
  // const markerPopupRef = useRef<Popup | null>(null)
  // const tracksRef = useRef(tracks)
  // const markersRef = useRef(markers)
  // const followGpsRef = useRef(followGps)
  // const placementModeRef = useRef(placementMode)
  const mobileRef = useRef(false)
  const basemapRef = useRef<BasemapId>('streets')
  const onMapReadyRef = useRef(onMapReady)
  // const onFollowChangeRef = useRef(onFollowChange)
  // const onPlaceLocationRef = useRef(onPlaceLocation)
  // const onOpenMarkerDetailRef = useRef(onOpenMarkerDetail)

  // tracksRef.current = tracks
  // markersRef.current = markers
  // followGpsRef.current = followGps
  // placementModeRef.current = placementMode
  onMapReadyRef.current = onMapReady
  // onFollowChangeRef.current = onFollowChange
  // onPlaceLocationRef.current = onPlaceLocation
  // onOpenMarkerDetailRef.current = onOpenMarkerDetail

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
        interactive,
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

    // PERF: controls disabled
    // map.addControl(new maplibregl.AttributionControl({ compact: true }))
    // if (interactive) {
    //   map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right')
    // }

    const syncBasemapForZoom = () => {
      const next: BasemapId = map.getZoom() >= SAT_ZOOM ? 'satellite' : 'streets'
      if (next === basemapRef.current && (next === 'streets' || map.getLayer(SATELLITE_LAYER))) {
        return
      }
      basemapRef.current = next
      applyBasemap(map, next)
    }

    map.on('load', syncBasemapForZoom)
    map.on('zoomend', syncBasemapForZoom)

    /*
    PERF: click handlers + popups disabled
    const showMarkerPopup = (e: MapMouseEvent) => { ... }
    const onClick = (e: MapMouseEvent) => { ... }
    map.on('click', onClick)
    */

    /*
    PERF: follow-GPS break handlers disabled
    const breakFollow = () => {
      if (!followGpsRef.current) return
      onFollowChangeRef.current?.(false)
    }
    map.on('dragstart', breakFollow)
    map.on('zoomstart', breakFollow)
    */

    map.on('load', () => {
      ensurePerfTrail(map, mobile)
      // PERF: marker layer disabled
      // ensureMarkerLayers(map)

      const bounds = geoJsonBounds(firstRodeoTrail as unknown as LineFeatureCollection)
      if (bounds) {
        map.fitBounds(bounds, {
          padding: 56,
          maxZoom: 16,
          animate: !prefersReducedMotion(),
          duration: 0,
        })
      }

      onMapReadyRef.current?.(map)
    })

    mapRef.current = map

    return () => {
      // trailPopupRef.current?.remove()
      // markerPopupRef.current?.remove()
      // gpsMarkerRef.current?.remove()
      // gpsMarkerRef.current = null
      onMapReadyRef.current?.(null)
      map.remove()
      mapRef.current = null
    }
  }, [interactive])

  /*
  PERF: marker data sync disabled
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getSource(MARKERS_SOURCE)) return
    const source = map.getSource(MARKERS_SOURCE) as GeoJSONSource
    source.setData(markersToGeoJson(markers))
  }, [markers])
  */

  /*
  PERF: placement cursor disabled
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = placementMode === 'selecting' ? 'crosshair' : ''
  }, [placementMode])
  */

  /*
  PERF: GPS marker + follow-GPS camera disabled
  useEffect(() => {
    const map = mapRef.current
    if (!map || !gps) return
    ...
  }, [gps])
  */

  return <div ref={containerRef} className={className ?? 'map-root'} />
}
