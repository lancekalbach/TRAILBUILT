import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GpsPosition, MarkerPlacementMode, TrailMarker, TrailTrack } from '../types'
import { trackBounds, tracksToGeoJson } from '../lib/gpx'
import { markersToGeoJson, markerKindIconSvg, markerKindMeta } from '../lib/markers'
import {
  isInsidePbrRegion,
  PBR_CENTER,
  PBR_DEFAULT_ZOOM,
  PBR_MAX_BOUNDS,
  PBR_MAX_ZOOM,
  PBR_MIN_ZOOM,
  toLatLngBounds,
} from '../lib/mapRegion'
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

const DESKTOP_SAT_ZOOM = 13.5
/** ~7 m near Priest Ridge — display-only; snap still uses full GPX. */
const MOBILE_SIMPLIFY_TOLERANCE = 0.00006
/** ~3.5 m — still cuts redraw cost on desktop retina canvases. */
const DESKTOP_SIMPLIFY_TOLERANCE = 0.00003
const TRAIL_TAP_METERS = 36

const TILE_PERF = {
  updateWhenZooming: false,
  updateWhenIdle: true,
  keepBuffer: 1,
  detectRetina: false,
} as const

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function createStreetsLayer() {
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: PBR_MAX_ZOOM,
    minZoom: PBR_MIN_ZOOM,
    ...TILE_PERF,
  })
}

function createSatelliteLayer() {
  return L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxZoom: PBR_MAX_ZOOM,
      minZoom: PBR_MIN_ZOOM,
      ...TILE_PERF,
    },
  )
}

function trailPopupHtml(name: string, skillLevel?: string) {
  const skill = (skillLevel || '').trim()
  const skillHtml = skill ? `<p class="trail-popup-skill">${escapeHtml(skill)}</p>` : ''
  return `<div class="trail-popup-body"><p class="trail-popup-name">${escapeHtml(name)}</p>${skillHtml}</div>`
}

/** Compact Sat/Map toggle matching prior UX. */
class BasemapToggleControl extends L.Control {
  private _button: HTMLButtonElement | null = null
  private _getMode: () => BasemapId
  private _onToggle: () => void

  constructor(getMode: () => BasemapId, onToggle: () => void, options?: L.ControlOptions) {
    super({ position: 'topright', ...options })
    this._getMode = getMode
    this._onToggle = onToggle
  }

  onAdd() {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-basemap-ctrl')
    const button = L.DomUtil.create('a', 'map-basemap-btn', container) as HTMLAnchorElement
    button.href = '#'
    button.role = 'button'
    this._button = button as unknown as HTMLButtonElement

    L.DomEvent.disableClickPropagation(container)
    L.DomEvent.on(button, 'click', (e) => {
      L.DomEvent.preventDefault(e)
      this._onToggle()
    })

    this.sync()
    return container
  }

  onRemove() {
    this._button = null
  }

  sync() {
    if (!this._button) return
    const sat = this._getMode() === 'satellite'
    this._button.textContent = sat ? 'Map' : 'Sat'
    this._button.setAttribute('aria-label', sat ? 'Show street map' : 'Show satellite')
    this._button.title = sat ? 'Street map' : 'Satellite'
    this._button.setAttribute('aria-pressed', sat ? 'true' : 'false')
  }
}

function warningIconHtml() {
  return `<span class="trail-marker-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="28" height="28">
      <path d="M12 2 L22 20 H2 Z" fill="#f59e0b" stroke="#1a1a1a" stroke-width="1.5" stroke-linejoin="round"/>
      <text x="12" y="17" text-anchor="middle" font-size="11" font-weight="700" fill="#1a1a1a" font-family="system-ui,sans-serif">!</text>
    </svg>
  </span>`
}

type MapViewProps = {
  tracks?: TrailTrack[]
  markers?: TrailMarker[]
  gps: GpsPosition | null
  followGps: boolean
  onFollowChange?: (follow: boolean) => void
  onMapReady?: (map: LeafletMap | null) => void
  interactive?: boolean
  className?: string
  focusTrackId?: string | null
  placementMode?: MarkerPlacementMode
  onPlaceLocation?: (lng: number, lat: number) => void
  onOpenMarkerDetail?: (id: string) => void
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
  const mapRef = useRef<LeafletMap | null>(null)
  const streetsLayerRef = useRef<L.TileLayer | null>(null)
  const satelliteLayerRef = useRef<L.TileLayer | null>(null)
  const tracksLayerRef = useRef<L.GeoJSON | null>(null)
  const markersLayerRef = useRef<L.GeoJSON | null>(null)
  const gpsMarkerRef = useRef<L.Marker | null>(null)
  const accuracyCircleRef = useRef<L.Circle | null>(null)
  const basemapRef = useRef<BasemapId>('streets')
  const basemapControlRef = useRef<BasemapToggleControl | null>(null)
  const mobileRef = useRef(false)
  const tracksRef = useRef(tracks)
  const markersRef = useRef(markers)
  const followGpsRef = useRef(followGps)
  const placementModeRef = useRef(placementMode)
  const onMapReadyRef = useRef(onMapReady)
  const onFollowChangeRef = useRef(onFollowChange)
  const onPlaceLocationRef = useRef(onPlaceLocation)
  const onOpenMarkerDetailRef = useRef(onOpenMarkerDetail)
  const retinaWasRef = useRef<boolean | null>(null)

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

    // 1× canvas on mobile: half/third the path pixels vs devicePixelRatio, much smoother pans.
    if (mobile) {
      const browser = L.Browser as { retina: boolean }
      retinaWasRef.current = browser.retina
      browser.retina = false
    }

    const streets = createStreetsLayer()
    streetsLayerRef.current = streets
    // Defer satellite until first Sat tap / desktop zoom swap.
    satelliteLayerRef.current = null

    const ensureSatellite = () => {
      if (!satelliteLayerRef.current) {
        satelliteLayerRef.current = createSatelliteLayer()
      }
      return satelliteLayerRef.current
    }

    const map = L.map(containerRef.current, {
      center: [PBR_CENTER[1], PBR_CENTER[0]],
      zoom: PBR_DEFAULT_ZOOM,
      minZoom: PBR_MIN_ZOOM,
      maxZoom: PBR_MAX_ZOOM,
      maxBounds: toLatLngBounds(PBR_MAX_BOUNDS),
      maxBoundsViscosity: 1,
      preferCanvas: true,
      // Larger padding = fewer full canvas redraws while panning.
      renderer: L.canvas({ padding: mobile ? 0.5 : 0.2 }),
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: false,
      markerZoomAnimation: false,
      bounceAtZoomLimits: false,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    })

    streets.addTo(map)

    if (interactive) {
      L.control.zoom({ position: 'topright' }).addTo(map)
    }

    const applyBasemap = (mode: BasemapId) => {
      basemapRef.current = mode
      if (mode === 'satellite') {
        const satellite = ensureSatellite()
        if (map.hasLayer(streets)) map.removeLayer(streets)
        if (!map.hasLayer(satellite)) satellite.addTo(map)
      } else {
        const satellite = satelliteLayerRef.current
        if (satellite && map.hasLayer(satellite)) map.removeLayer(satellite)
        if (!map.hasLayer(streets)) streets.addTo(map)
      }
      basemapControlRef.current?.sync()
    }

    if (mobile) {
      const control = new BasemapToggleControl(
        () => basemapRef.current,
        () => applyBasemap(basemapRef.current === 'satellite' ? 'streets' : 'satellite'),
      )
      basemapControlRef.current = control
      control.addTo(map)
    } else {
      const syncDesktopBasemap = () => {
        applyBasemap(map.getZoom() >= DESKTOP_SAT_ZOOM ? 'satellite' : 'streets')
      }
      map.on('zoomend', syncDesktopBasemap)
      syncDesktopBasemap()
    }

    // Trails are non-interactive: Canvas hit-tests every path on touch and tanks mobile pan.
    // Popups open via map click + nearest-trail (same snap helper as marker place).
    const tracksLayer = L.geoJSON(undefined, {
      style: (feature) => {
        const props = feature?.properties as { color?: string; opacity?: number } | undefined
        return {
          color: props?.color || '#c4c4c4',
          weight: mobile ? 3.25 : 3.5,
          opacity: props?.opacity ?? 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
          // Leaflet re-simplifies per zoom; higher = fewer segments drawn while moving.
          smoothFactor: mobile ? 2.75 : 1.75,
        }
      },
    }).addTo(map)
    tracksLayerRef.current = tracksLayer

    const markersLayer = L.geoJSON(undefined, {
      pointToLayer: (_feature, latlng) =>
        L.marker(latlng, {
          icon: L.divIcon({
            className: 'trail-marker-divicon',
            html: warningIconHtml(),
            iconSize: [28, 28],
            iconAnchor: [14, 28],
            popupAnchor: [0, -24],
          }),
        }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties as {
          id?: string
          kind?: string
          label?: string
          note?: string
        }
        if (!props?.id) return

        const kind = props.kind || 'hazard'
        const label = props.label || markerKindMeta(kind).label
        const note = (props.note || '').trim()
        const noteHtml = note ? `<p class="trail-popup-note">${escapeHtml(note)}</p>` : ''
        const iconHtml = markerKindIconSvg(kind, 18)
        const markerId = props.id

        layer.bindPopup(
          `<div class="trail-popup-body">
            <p class="trail-popup-name"><span class="marker-popup-icon">${iconHtml}</span> ${escapeHtml(label)}</p>
            ${noteHtml}
            <button type="button" class="trail-popup-more" data-marker-id="${escapeHtml(markerId)}">More</button>
          </div>`,
          { className: 'trail-popup marker-popup', maxWidth: 260, closeButton: true },
        )

        layer.on('popupopen', () => {
          if (placementModeRef.current === 'selecting') {
            map.closePopup()
            return
          }
          const el = (layer as L.Marker).getPopup()?.getElement()
          const moreBtn = el?.querySelector<HTMLButtonElement>('.trail-popup-more')
          if (!moreBtn) return
          moreBtn.onclick = (ev) => {
            ev.preventDefault()
            ev.stopPropagation()
            map.closePopup()
            onOpenMarkerDetailRef.current?.(markerId)
          }
        })
      },
    }).addTo(map)
    markersLayerRef.current = markersLayer

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (placementModeRef.current === 'selecting') {
        const snapped = nearestPointOnTrails(e.latlng.lng, e.latlng.lat, tracksRef.current)
        onPlaceLocationRef.current?.(snapped?.lng ?? e.latlng.lng, snapped?.lat ?? e.latlng.lat)
        return
      }

      const nearest = nearestPointOnTrails(
        e.latlng.lng,
        e.latlng.lat,
        tracksRef.current,
        TRAIL_TAP_METERS,
      )
      if (!nearest) return
      const track = tracksRef.current.find((t) => t.id === nearest.trackId)
      if (!track?.name) return

      L.popup({ className: 'trail-popup', maxWidth: 240, closeButton: true })
        .setLatLng([nearest.lat, nearest.lng])
        .setContent(trailPopupHtml(track.name, track.skillLevel))
        .openOn(map)
    })

    const breakFollow = () => {
      if (!followGpsRef.current) return
      onFollowChangeRef.current?.(false)
    }
    map.on('dragstart', breakFollow)
    map.on('zoomstart', breakFollow)

    mapRef.current = map
    onMapReadyRef.current?.(map)

    // Leaflet needs a size pass after the container becomes visible.
    requestAnimationFrame(() => map.invalidateSize())

    return () => {
      gpsMarkerRef.current = null
      accuracyCircleRef.current = null
      tracksLayerRef.current = null
      markersLayerRef.current = null
      streetsLayerRef.current = null
      satelliteLayerRef.current = null
      basemapControlRef.current = null
      onMapReadyRef.current?.(null)
      map.remove()
      mapRef.current = null
      if (retinaWasRef.current != null) {
        ;(L.Browser as { retina: boolean }).retina = retinaWasRef.current
        retinaWasRef.current = null
      }
    }
  }, [interactive])

  useEffect(() => {
    const layer = tracksLayerRef.current
    if (!layer) return
    const tolerance = mobileRef.current ? MOBILE_SIMPLIFY_TOLERANCE : DESKTOP_SIMPLIFY_TOLERANCE
    layer.clearLayers()
    layer.addData(tracksToGeoJson(tracks, { simplifyTolerance: tolerance }) as GeoJSON.GeoJsonObject)
  }, [tracks])

  useEffect(() => {
    const layer = markersLayerRef.current
    if (!layer) return
    layer.clearLayers()
    layer.addData(markersToGeoJson(markers) as GeoJSON.GeoJsonObject)
  }, [markers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getContainer().style.cursor = placementMode === 'selecting' ? 'crosshair' : ''
  }, [placementMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusTrackId) return
    const track = tracks.find((t) => t.id === focusTrackId)
    if (!track) return
    const bounds = trackBounds(track)
    if (!bounds) return
    map.fitBounds(toLatLngBounds(bounds), {
      padding: [56, 56],
      maxZoom: 16,
      animate: !prefersReducedMotion(),
      duration: 0.8,
    })
  }, [focusTrackId, tracks])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !gps) return

    const latlng: L.LatLngExpression = [gps.lat, gps.lng]

    if (!gpsMarkerRef.current) {
      gpsMarkerRef.current = L.marker(latlng, {
        icon: L.divIcon({
          className: 'gps-dot-divicon',
          html: '<div class="gps-dot"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(map)
    } else {
      gpsMarkerRef.current.setLatLng(latlng)
    }

    if (!mobileRef.current && gps.accuracy != null && gps.accuracy > 0) {
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle(latlng, {
          radius: gps.accuracy,
          color: '#2f80ed',
          weight: 1,
          fillColor: '#2f80ed',
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(map)
      } else {
        accuracyCircleRef.current.setLatLng(latlng)
        accuracyCircleRef.current.setRadius(gps.accuracy)
      }
    }

    if (followGpsRef.current && isInsidePbrRegion(gps.lng, gps.lat)) {
      map.panTo(latlng, { animate: false })
    }
  }, [gps])

  return <div ref={containerRef} className={className ?? 'map-root'} />
}
