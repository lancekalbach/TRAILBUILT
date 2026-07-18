import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, Marker, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GpsPosition, MarkerPlacementMode, TrailMarker, TrailTrack } from '../types'
import { trackBounds, tracksToGeoJson } from '../lib/gpx'
import { markersToGeoJson, markerKindIconSvg, markerKindMeta } from '../lib/markers'
import { nearestPointOnTrails } from '../lib/trailGeometry'

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
const SATELLITE_LAYER = 'satellite'
const DESKTOP_SAT_ZOOM = 13.5

/**
 * Exclusive basemap style — never composite OSM + satellite.
 * Opacity crossfades still load/decode both tile stacks; visibility swaps do not.
 */
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
        attribution: '© OpenStreetMap contributors',
      },
      satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      },
    },
    layers: [
      {
        id: OSM_LAYER,
        type: 'raster',
        source: 'osm',
        minzoom: 0,
        maxzoom: 19,
        layout: { visibility: 'visible' },
      },
      {
        id: SATELLITE_LAYER,
        type: 'raster',
        source: 'satellite',
        minzoom: 0,
        maxzoom: 22,
        layout: { visibility: 'none' },
      },
    ],
  }
}

function setBasemap(map: MapLibreMap, mode: BasemapId) {
  if (map.getLayer(OSM_LAYER)) {
    map.setLayoutProperty(OSM_LAYER, 'visibility', mode === 'streets' ? 'visible' : 'none')
  }
  if (map.getLayer(SATELLITE_LAYER)) {
    map.setLayoutProperty(SATELLITE_LAYER, 'visibility', mode === 'satellite' ? 'visible' : 'none')
  }
}

function queryHitFeatures(
  map: MapLibreMap,
  point: maplibregl.PointLike,
  layerIds: string[],
  pad: number,
) {
  const existing = layerIds.filter((id) => map.getLayer(id))
  if (existing.length === 0) return []

  if (pad <= 0) {
    return map.queryRenderedFeatures(point, { layers: existing })
  }

  const p = point as { x: number; y: number }
  return map.queryRenderedFeatures(
    [
      [p.x - pad, p.y - pad],
      [p.x + pad, p.y + pad],
    ],
    { layers: existing },
  )
}

/** Compact MapLibre control to toggle satellite without dual-basemap cost. */
class BasemapToggleControl implements maplibregl.IControl {
  private _container!: HTMLDivElement
  private _button!: HTMLButtonElement
  private _getMode: () => BasemapId
  private _onToggle: () => void

  constructor(getMode: () => BasemapId, onToggle: () => void) {
    this._getMode = getMode
    this._onToggle = onToggle
  }

  onAdd(_map: MapLibreMap) {
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group map-basemap-ctrl'
    this._button = document.createElement('button')
    this._button.type = 'button'
    this._button.className = 'map-basemap-btn'
    this._button.addEventListener('click', this._onToggle)
    this._container.appendChild(this._button)
    this.sync()
    return this._container
  }

  onRemove() {
    this._button.removeEventListener('click', this._onToggle)
    this._container.remove()
  }

  sync() {
    const sat = this._getMode() === 'satellite'
    this._button.textContent = sat ? 'Map' : 'Sat'
    this._button.setAttribute('aria-label', sat ? 'Show street map' : 'Show satellite')
    this._button.title = sat ? 'Street map' : 'Satellite'
    this._button.setAttribute('aria-pressed', sat ? 'true' : 'false')
  }
}

const TRACKS_SOURCE = 'trail-tracks'
const TRACKS_CASING = 'trail-tracks-casing'
const TRACKS_LINE = 'trail-tracks-line'
const TRACKS_HIT = 'trail-tracks-hit'

const MARKERS_SOURCE = 'trail-markers'
const MARKERS_LAYER = 'trail-markers-symbol'
const MARKERS_HIT = 'trail-markers-hit'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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

const MARKER_ICON_SIZE: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  12,
  0.525,
  14,
  0.6375,
  16,
  0.7875,
  18,
  0.9375,
  19,
  1.05,
]

const MARKER_HIT_RADIUS: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  12,
  12,
  16,
  16.5,
  18,
  19.5,
  19,
  22.5,
]

function ensureMarkerLayers(map: MapLibreMap, mobile: boolean) {
  if (!map.getSource(MARKERS_SOURCE)) {
    map.addSource(MARKERS_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      buffer: mobile ? 0 : 32,
    })
  }

  if (!map.hasImage('trail-warning-icon')) {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const cx = size / 2
      const top = 10
      const bottom = size - 14
      const left = 14
      const right = size - 14

      ctx.beginPath()
      ctx.moveTo(cx, top)
      ctx.lineTo(right, bottom)
      ctx.lineTo(left, bottom)
      ctx.closePath()
      ctx.fillStyle = '#f59e0b'
      ctx.fill()
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 6
      ctx.stroke()

      ctx.fillStyle = '#1a1a1a'
      ctx.font = 'bold 64px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('!', cx, bottom - 36)
    }
    const imageData = ctx?.getImageData(0, 0, size, size)
    if (imageData) {
      // pixelRatio 2 → 64 CSS px at icon-size 1; high-zoom sizes scale well above that
      map.addImage('trail-warning-icon', imageData, { pixelRatio: 2 })
    }
  }

  if (!map.getLayer(MARKERS_LAYER)) {
    map.addLayer({
      id: MARKERS_LAYER,
      type: 'symbol',
      source: MARKERS_SOURCE,
      layout: {
        'icon-image': 'trail-warning-icon',
        'icon-size': MARKER_ICON_SIZE,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'bottom',
      },
    })
  } else {
    map.setLayoutProperty(MARKERS_LAYER, 'icon-size', MARKER_ICON_SIZE)
  }

  // Invisible hit circles are expensive fill; on mobile we pad queryRenderedFeatures instead.
  if (!mobile && !map.getLayer(MARKERS_HIT)) {
    map.addLayer({
      id: MARKERS_HIT,
      type: 'circle',
      source: MARKERS_SOURCE,
      paint: {
        'circle-radius': MARKER_HIT_RADIUS,
        'circle-opacity': 0.01,
      },
    })
  } else if (!mobile && map.getLayer(MARKERS_HIT)) {
    map.setPaintProperty(MARKERS_HIT, 'circle-radius', MARKER_HIT_RADIUS)
  }
}

function ensureTrackLayers(map: MapLibreMap, mobile: boolean) {
  if (!map.getSource(TRACKS_SOURCE)) {
    map.addSource(TRACKS_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      // Higher tolerance = cheaper geometry at low zoom (mobile GPUs benefit most).
      tolerance: mobile ? 2 : 0.5,
      buffer: mobile ? 0 : 64,
    })
  }
  if (!map.getLayer(TRACKS_CASING) && !mobile) {
    map.addLayer({
      id: TRACKS_CASING,
      type: 'line',
      source: TRACKS_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#f5f5f0',
        'line-width': 6.5,
        'line-opacity': 0.75,
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
        'line-opacity': ['get', 'opacity'],
      },
    })
  }
  if (!mobile && !map.getLayer(TRACKS_HIT)) {
    map.addLayer({
      id: TRACKS_HIT,
      type: 'line',
      source: TRACKS_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#000000',
        'line-width': 18,
        'line-opacity': 0.01,
      },
    })
  }
}

export function MapView({
  tracks = [],
  markers = [],
  gps,
  followGps,
  onFollowChange,
  onMapReady,
  interactive = true,
  className,
  focusTrackId,
  placementMode = 'idle',
  onPlaceLocation,
  onOpenMarkerDetail,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const gpsMarkerRef = useRef<Marker | null>(null)
  const accuracyElRef = useRef<HTMLDivElement | null>(null)
  const accuracyMarkerRef = useRef<Marker | null>(null)
  const accuracyZoomBoundRef = useRef(false)
  const gpsAccuracyRef = useRef<number | null>(null)
  const gpsLatRef = useRef(0)
  const trailPopupRef = useRef<Popup | null>(null)
  const markerPopupRef = useRef<Popup | null>(null)
  const tracksRef = useRef(tracks)
  const markersRef = useRef(markers)
  const followGpsRef = useRef(followGps)
  const placementModeRef = useRef(placementMode)
  const mobileRef = useRef(false)
  const basemapRef = useRef<BasemapId>('streets')
  const basemapControlRef = useRef<BasemapToggleControl | null>(null)
  const onMapReadyRef = useRef(onMapReady)
  const onFollowChangeRef = useRef(onFollowChange)
  const onPlaceLocationRef = useRef(onPlaceLocation)
  const onOpenMarkerDetailRef = useRef(onOpenMarkerDetail)

  tracksRef.current = tracks
  markersRef.current = markers
  followGpsRef.current = followGps
  placementModeRef.current = placementMode
  onMapReadyRef.current = onMapReady
  onFollowChangeRef.current = onFollowChange
  onPlaceLocationRef.current = onPlaceLocation
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
        center: [-98.5795, 39.8283],
        zoom: 3.5,
        interactive,
        attributionControl: false,
        // 1× canvas on phones — retina fill-rate is a top pan/zoom cost.
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

    if (interactive) {
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right')
    }

    const applyBasemap = (mode: BasemapId) => {
      basemapRef.current = mode
      setBasemap(map, mode)
      basemapControlRef.current?.sync()
    }

    if (mobile) {
      const basemapControl = new BasemapToggleControl(
        () => basemapRef.current,
        () => applyBasemap(basemapRef.current === 'satellite' ? 'streets' : 'satellite'),
      )
      basemapControlRef.current = basemapControl
      map.addControl(basemapControl, 'top-right')
    } else {
      // Desktop: hard-swap by zoom — never composite both tile stacks.
      const syncDesktopBasemap = () => {
        applyBasemap(map.getZoom() >= DESKTOP_SAT_ZOOM ? 'satellite' : 'streets')
      }
      map.on('load', syncDesktopBasemap)
      map.on('zoomend', syncDesktopBasemap)
    }

    const hitPad = mobile ? 18 : 0

    const showMarkerPopup = (e: MapMouseEvent) => {
      const layers = mobile ? [MARKERS_LAYER] : [MARKERS_HIT, MARKERS_LAYER]
      const features = queryHitFeatures(map, e.point, layers, hitPad)
      const props = features[0]?.properties as
        | { id?: string; kind?: string; label?: string; note?: string }
        | undefined
      if (!props?.id) return false

      const marker = markersRef.current.find((m) => m.id === props.id)
      const markerId = props.id
      const kind = marker?.kind || props.kind || 'hazard'
      const label = props.label || markerKindMeta(kind).label
      const note = (marker?.note || props.note || '').trim()
      const noteHtml = note ? `<p class="trail-popup-note">${escapeHtml(note)}</p>` : ''
      const iconHtml = markerKindIconSvg(kind, 18)

      if (!markerPopupRef.current) {
        markerPopupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 18,
          className: 'trail-popup marker-popup',
          maxWidth: '260px',
        })
      }

      trailPopupRef.current?.remove()

      markerPopupRef.current
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="trail-popup-body">
            <p class="trail-popup-name"><span class="marker-popup-icon">${iconHtml}</span> ${escapeHtml(label)}</p>
            ${noteHtml}
            <button type="button" class="trail-popup-more" data-marker-id="${escapeHtml(markerId)}">More</button>
          </div>`,
        )
        .addTo(map)

      const moreBtn = markerPopupRef.current
        .getElement()
        ?.querySelector<HTMLButtonElement>('.trail-popup-more')
      if (moreBtn) {
        moreBtn.onclick = (ev) => {
          ev.preventDefault()
          ev.stopPropagation()
          markerPopupRef.current?.remove()
          onOpenMarkerDetailRef.current?.(markerId)
        }
      }

      return true
    }

    const showTrailPopup = (e: MapMouseEvent) => {
      if (placementModeRef.current === 'selecting') return

      if (showMarkerPopup(e)) return

      const layers = mobile ? [TRACKS_LINE] : [TRACKS_HIT, TRACKS_LINE]
      const features = queryHitFeatures(map, e.point, layers, hitPad)
      const props = features[0]?.properties as
        | { id?: string; name?: string; skillLevel?: string }
        | undefined
      if (!props) {
        trailPopupRef.current?.remove()
        return
      }

      const track = props.id ? tracksRef.current.find((t) => t.id === props.id) : undefined
      const name = track?.name || props.name
      if (!name) return

      const skill = (track?.skillLevel || props.skillLevel || '').trim()
      const skillHtml = skill ? `<p class="trail-popup-skill">${escapeHtml(skill)}</p>` : ''

      if (!trailPopupRef.current) {
        trailPopupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 14,
          className: 'trail-popup',
          maxWidth: '240px',
        })
      }

      trailPopupRef.current
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="trail-popup-body"><p class="trail-popup-name">${escapeHtml(name)}</p>${skillHtml}</div>`,
        )
        .addTo(map)
    }

    const handleMapClick = (e: MapMouseEvent) => {
      if (placementModeRef.current === 'selecting') {
        const snapped = nearestPointOnTrails(e.lngLat.lng, e.lngLat.lat, tracksRef.current)
        const lng = snapped?.lng ?? e.lngLat.lng
        const lat = snapped?.lat ?? e.lngLat.lat
        onPlaceLocationRef.current?.(lng, lat)
        return
      }

      showTrailPopup(e)
    }

    map.on('click', handleMapClick)

    // Hover cursor queries are desktop-only; touch devices don't need per-move hit tests.
    const finePointer = window.matchMedia('(pointer: fine)').matches
    if (finePointer) {
      map.on('mousemove', (e) => {
        if (placementModeRef.current === 'selecting') {
          map.getCanvas().style.cursor = 'crosshair'
          return
        }

        const onMarker =
          queryHitFeatures(map, e.point, [MARKERS_HIT, MARKERS_LAYER], 0).length > 0
        if (onMarker) {
          map.getCanvas().style.cursor = 'pointer'
          return
        }

        const hovering =
          queryHitFeatures(map, e.point, [TRACKS_HIT, TRACKS_LINE], 0).length > 0
        map.getCanvas().style.cursor = hovering ? 'pointer' : ''
      })
    }

    const breakFollow = () => {
      if (!followGpsRef.current) return
      onFollowChangeRef.current?.(false)
    }
    map.on('dragstart', breakFollow)
    map.on('wheel', breakFollow)
    map.on('rotatestart', breakFollow)
    map.on('pitchstart', breakFollow)

    mapRef.current = map
    onMapReadyRef.current?.(map)

    return () => {
      gpsMarkerRef.current?.remove()
      accuracyMarkerRef.current?.remove()
      trailPopupRef.current?.remove()
      trailPopupRef.current = null
      markerPopupRef.current?.remove()
      markerPopupRef.current = null
      accuracyZoomBoundRef.current = false
      basemapControlRef.current = null
      onMapReadyRef.current?.(null)
      map.remove()
      mapRef.current = null
    }
  }, [interactive])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      ensureTrackLayers(map, mobileRef.current)
      const source = map.getSource(TRACKS_SOURCE) as GeoJSONSource | undefined
      source?.setData(tracksToGeoJson(tracks))
    }

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
    }
  }, [tracks])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      ensureMarkerLayers(map, mobileRef.current)
      const source = map.getSource(MARKERS_SOURCE) as GeoJSONSource | undefined
      source?.setData(markersToGeoJson(markers))
    }

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
    }
  }, [markers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = placementMode === 'selecting' ? 'crosshair' : ''
  }, [placementMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusTrackId) return
    const track = tracks.find((t) => t.id === focusTrackId)
    if (!track) return
    const bounds = trackBounds(track)
    if (!bounds) return
    map.fitBounds(bounds, {
      padding: 56,
      duration: prefersReducedMotion() ? 0 : 800,
      maxZoom: 16,
    })
  }, [focusTrackId, tracks])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !gps) return

    gpsLatRef.current = gps.lat
    gpsAccuracyRef.current = gps.accuracy ?? null

    if (!gpsMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'gps-dot'
      gpsMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([gps.lng, gps.lat])
        .addTo(map)
    } else {
      gpsMarkerRef.current.setLngLat([gps.lng, gps.lat])
    }

    // Accuracy ring is a DOM marker resized on every zoom — skip on mobile.
    if (!mobileRef.current && gps.accuracy != null && gps.accuracy > 0) {
      const updateAccuracySize = () => {
        const el = accuracyElRef.current
        const accuracy = gpsAccuracyRef.current
        if (!el || accuracy == null || accuracy <= 0) return
        const metersPerPx =
          (40075016.686 * Math.abs(Math.cos((gpsLatRef.current * Math.PI) / 180))) /
          Math.pow(2, map.getZoom() + 8)
        const px = Math.max(12, (accuracy / metersPerPx) * 2)
        el.style.width = `${px}px`
        el.style.height = `${px}px`
      }

      if (!accuracyMarkerRef.current) {
        const node = document.createElement('div')
        node.className = 'gps-accuracy'
        accuracyElRef.current = node
        accuracyMarkerRef.current = new maplibregl.Marker({
          element: node,
          anchor: 'center',
        })
          .setLngLat([gps.lng, gps.lat])
          .addTo(map)
      } else {
        accuracyMarkerRef.current.setLngLat([gps.lng, gps.lat])
      }

      updateAccuracySize()

      if (!accuracyZoomBoundRef.current) {
        map.on('zoom', updateAccuracySize)
        accuracyZoomBoundRef.current = true
      }
    }

    if (followGpsRef.current) {
      // jumpTo avoids stacking easeTo animations on every GPS tick.
      map.jumpTo({ center: [gps.lng, gps.lat] })
    }
  }, [gps])

  return <div ref={containerRef} className={className ?? 'map-root'} />
}
