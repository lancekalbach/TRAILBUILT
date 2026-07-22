import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GpsPosition, TrailMarker, TrailTrack } from '../types'
import { trackBounds, tracksToGeoJson } from '../lib/gpx'
import { markerKindIconSvg, markerKindMeta } from '../lib/markers'
import { trackLengthMeters } from '../lib/trailGeometry'
import { flyToLocation } from '../lib/mapCamera'
import {
  getTrailOpenStatus,
  TRAIL_STATUS_LABELS,
} from '../data/trailStatus'
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
const TRACKS_HIT = 'trail-tracks-hit'
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
      // Low tolerance keeps trails smooth; MapLibre default is 0.375.
      tolerance: mobile ? 0.25 : 0.1,
      buffer: mobile ? 32 : 64,
    })
  }

  if (!map.getLayer(TRACKS_HIT)) {
    map.addLayer({
      id: TRACKS_HIT,
      type: 'line',
      source: TRACKS_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': 'rgba(0, 0, 0, 0)',
        'line-width': mobile ? 24 : 18,
      },
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

function formatTrailLength(track: TrailTrack): string {
  const miles = trackLengthMeters(track) / 1609.344
  return `${miles < 1 ? miles.toFixed(2) : miles.toFixed(1)} miles`
}

function showTrailPopup(map: MapLibreMap, track: TrailTrack, lng: number, lat: number): Popup {
  const body = document.createElement('div')
  body.className = 'trail-popup-body'

  const name = document.createElement('h3')
  name.className = 'trail-popup-name'
  name.textContent = track.name

  const meta = document.createElement('div')
  meta.className = 'trail-popup-meta'

  const length = document.createElement('p')
  length.className = 'trail-popup-skill'
  length.textContent = formatTrailLength(track)
  meta.append(length)

  const status = getTrailOpenStatus(track.id)
  if (status) {
    const badge = document.createElement('span')
    badge.className = `trail-popup-status trail-popup-status--${status}`
    badge.textContent = TRAIL_STATUS_LABELS[status]
    meta.append(badge)
  }

  body.append(name, meta)

  return new maplibregl.Popup({
    className: 'trail-popup',
    closeButton: true,
    closeOnClick: true,
    offset: 8,
  })
    .setLngLat([lng, lat])
    .setDOMContent(body)
    .addTo(map)
}

function syncTrailMarkers(
  map: MapLibreMap,
  markers: TrailMarker[],
  markerInstances: Map<string, Marker>,
  onOpenMarkerDetail?: (id: string) => void,
) {
  for (const instance of markerInstances.values()) instance.remove()
  markerInstances.clear()

  for (const marker of markers) {
    const meta = markerKindMeta(marker.kind)
    const element = document.createElement('div')
    element.className = 'trail-marker-icon'
    element.title = meta.label
    element.tabIndex = 0
    element.setAttribute('role', 'button')
    element.setAttribute('aria-label', `View ${meta.label.toLowerCase()} details`)
    element.innerHTML = markerKindIconSvg(marker.kind, 22)
    const openDetails = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      onOpenMarkerDetail?.(marker.id)
    }
    element.addEventListener('click', openDetails)
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      openDetails(event)
    })

    const instance = new maplibregl.Marker({
      element,
      anchor: 'bottom',
      offset: [0, -7],
      pitchAlignment: 'map',
    })
      .setLngLat([marker.lng, marker.lat])
      .addTo(map)

    markerInstances.set(marker.id, instance)
  }
}

type MapViewProps = {
  tracks?: TrailTrack[]
  markers?: TrailMarker[]
  gps: GpsPosition | null
  followGps: boolean
  selectedTrackId?: string | null
  selectingLocation?: boolean
  onSelectLocation?: (lng: number, lat: number, trackId: string | null) => void
  onOpenMarkerDetail?: (id: string) => void
  onFollowChange?: (follow: boolean) => void
  onMapReady?: (map: MapLibreMap | null) => void
  focusTrackId?: string | null
  focusMarkerLocation?: { lng: number; lat: number } | null
  className?: string
}

export function MapView({
  tracks = [],
  markers = [],
  gps,
  followGps,
  selectedTrackId,
  selectingLocation = false,
  onSelectLocation,
  onOpenMarkerDetail,
  onFollowChange,
  onMapReady,
  focusTrackId,
  focusMarkerLocation,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const gpsMarkerRef = useRef<Marker | null>(null)
  const trailMarkerRefs = useRef(new Map<string, Marker>())
  const trailPopupRef = useRef<Popup | null>(null)
  const basemapRef = useRef<BasemapId>('streets')
  const mobileRef = useRef(false)
  const tracksRef = useRef(tracks)
  const markersRef = useRef(markers)
  const selectedTrackIdRef = useRef(selectedTrackId)
  const followGpsRef = useRef(followGps)
  const onMapReadyRef = useRef(onMapReady)
  const onFollowChangeRef = useRef(onFollowChange)
  const onSelectLocationRef = useRef(onSelectLocation)
  const onOpenMarkerDetailRef = useRef(onOpenMarkerDetail)

  tracksRef.current = tracks
  markersRef.current = markers
  selectedTrackIdRef.current = selectedTrackId
  followGpsRef.current = followGps
  onMapReadyRef.current = onMapReady
  onFollowChangeRef.current = onFollowChange
  onSelectLocationRef.current = onSelectLocation
  onOpenMarkerDetailRef.current = onOpenMarkerDetail

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
    map.on('click', (event) => {
      const selectLocation = onSelectLocationRef.current
      if (selectLocation) {
        trailPopupRef.current?.remove()
        trailPopupRef.current = null
        const features = map.queryRenderedFeatures(event.point, { layers: [TRACKS_HIT] })
        const selectedFeature = features.find(
          (feature) => feature.properties?.id === selectedTrackIdRef.current,
        )
        const clickedTrackId = selectedFeature?.properties?.id ?? features[0]?.properties?.id
        selectLocation(
          event.lngLat.lng,
          event.lngLat.lat,
          typeof clickedTrackId === 'string' ? clickedTrackId : null,
        )
        return
      }

      const feature = map.queryRenderedFeatures(event.point, { layers: [TRACKS_HIT] })[0]
      const trackId = feature?.properties?.id
      const track = tracksRef.current.find((item) => item.id === trackId)
      if (!track) return

      trailPopupRef.current?.remove()
      trailPopupRef.current = showTrailPopup(
        map,
        track,
        event.lngLat.lng,
        event.lngLat.lat,
      )
    })

    map.on('load', () => {
      ensureTrackLayers(map, mobile)
      const source = map.getSource(TRACKS_SOURCE) as GeoJSONSource
      source.setData(tracksToGeoJson(tracksRef.current))
      syncTrailMarkers(map, markersRef.current, trailMarkerRefs.current, (id) => {
        trailPopupRef.current?.remove()
        trailPopupRef.current = null
        onOpenMarkerDetailRef.current?.(id)
      })
      syncBasemapForZoom()
      onMapReadyRef.current?.(map)
    })
    map.on('zoomend', syncBasemapForZoom)

    mapRef.current = map

    return () => {
      gpsMarkerRef.current?.remove()
      gpsMarkerRef.current = null
      for (const marker of trailMarkerRefs.current.values()) marker.remove()
      trailMarkerRefs.current.clear()
      trailPopupRef.current?.remove()
      trailPopupRef.current = null
      onMapReadyRef.current?.(null)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getSource(TRACKS_SOURCE)) return
    const source = map.getSource(TRACKS_SOURCE) as GeoJSONSource
    source.setData(tracksToGeoJson(tracks))
  }, [tracks])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.loaded()) return
    syncTrailMarkers(map, markers, trailMarkerRefs.current, (id) => {
      trailPopupRef.current?.remove()
      trailPopupRef.current = null
      onOpenMarkerDetailRef.current?.(id)
    })
  }, [markers])

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
    if (!map || !focusMarkerLocation) return
    flyToLocation(map, focusMarkerLocation.lng, focusMarkerLocation.lat)
  }, [focusMarkerLocation])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = selectingLocation ? 'crosshair' : ''
    return () => {
      map.getCanvas().style.cursor = ''
    }
  }, [selectingLocation])

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
