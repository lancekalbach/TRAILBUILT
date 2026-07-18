import { useCallback, useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { LandingPage } from './components/LandingPage'
import { MapErrorBoundary } from './components/MapErrorBoundary'
import { MapMenu } from './components/MapMenu'
import { MapView } from './components/MapView'
import { MarkerDetailSheet } from './components/MarkerDetailSheet'
import { ensurePbrSeedTracks, pbrNetworkBounds } from './data/pbr/seed'
import { nextTrailColor, parseGpx } from './lib/gpx'
import { watchGps } from './lib/geolocation'
import { flyToGps } from './lib/mapCamera'
import { nearestPointOnTrails } from './lib/trailGeometry'
import {
  deleteMarker,
  loadMarkers,
  readFileAsText,
  saveMarker,
  saveTrack,
} from './lib/storage'
import type {
  GpsPosition,
  LibrarySelection,
  MarkerPlacementMode,
  TrailMarker,
  TrailMarkerKind,
  TrailTrack,
} from './types'

type AppView = 'home' | 'map'

export default function App() {
  const [view, setView] = useState<AppView>('home')
  const [tracks, setTracks] = useState<TrailTrack[]>([])
  const [markers, setMarkers] = useState<TrailMarker[]>([])
  const [selection, setSelection] = useState<LibrarySelection>(null)
  const [gps, setGps] = useState<GpsPosition | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [followGps, setFollowGps] = useState(false)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [focusTrackId, setFocusTrackId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('Working…')
  const [placementMode, setPlacementMode] = useState<MarkerPlacementMode>('idle')
  const [pendingLocation, setPendingLocation] = useState<{ lng: number; lat: number } | null>(null)
  const [detailMarkerId, setDetailMarkerId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([ensurePbrSeedTracks(), loadMarkers()])
      .then(([trackList, markerList]) => {
        if (cancelled) return
        setTracks(trackList)
        setMarkers(markerList)
        if (trackList[0]) setSelection({ kind: 'track', id: trackList[0].id })
      })
      .catch(() => {
        if (!cancelled) setGpsError('Could not load saved trails.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (view !== 'map') return

    const watch = watchGps(
      (pos) => {
        setGps(pos)
        setGpsError(null)
      },
      (message) => setGpsError(message),
    )
    return () => watch.clear()
  }, [view])

  const handleFollowChange = useCallback((follow: boolean) => {
    setFollowGps((prev) => (prev === follow ? prev : follow))
  }, [])

  const handleMapReady = useCallback((m: MapLibreMap | null) => {
    setMap(m)
  }, [])

  const didInitialCamera = useRef(false)
  useEffect(() => {
    if (didInitialCamera.current || !map || loading) return

    if (gps) {
      didInitialCamera.current = true
      flyToGps(map, gps, 11)
      return
    }

    const bounds = pbrNetworkBounds(tracks)
    if (!bounds) return

    const timer = window.setTimeout(() => {
      if (didInitialCamera.current) return
      didInitialCamera.current = true
      map.fitBounds(bounds, { padding: 64, duration: 900, maxZoom: 14 })
    }, 1500)

    return () => window.clearTimeout(timer)
  }, [map, gps, tracks, loading])

  useEffect(() => {
    if (view !== 'map' || !map) return
    const id = requestAnimationFrame(() => map.resize())
    return () => cancelAnimationFrame(id)
  }, [view, map, menuOpen])

  useEffect(() => {
    if (view !== 'map') {
      setMenuOpen(false)
      setPlacementMode('idle')
      setPendingLocation(null)
      setDetailMarkerId(null)
    }
  }, [view])

  function resetPlacement() {
    setPlacementMode('idle')
    setPendingLocation(null)
  }

  function setLocationFromCoords(lng: number, lat: number) {
    const snapped = nearestPointOnTrails(lng, lat, tracks)
    setPendingLocation({ lng: snapped?.lng ?? lng, lat: snapped?.lat ?? lat })
    setPlacementMode('idle')
  }

  async function importGpx(file: File) {
    setBusy(true)
    setBusyLabel('Importing GPX…')
    setGpsError(null)
    try {
      const text = await readFileAsText(file)
      const fallbackName = file.name.replace(/\.[^.]+$/, '') || 'Trail'
      const parsed = parseGpx(text, fallbackName)
      const track: TrailTrack = {
        id: crypto.randomUUID(),
        name: parsed.name,
        lines: parsed.lines,
        color: nextTrailColor(tracks.length),
        opacity: 0.95,
        createdAt: Date.now(),
        source: parsed.source,
      }
      await saveTrack(track)
      setTracks((prev) => [track, ...prev])
      setSelection({ kind: 'track', id: track.id })
      setFocusTrackId(null)
      requestAnimationFrame(() => setFocusTrackId(track.id))
      resetPlacement()
      setMenuOpen(false)
      setView('map')
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : 'Could not import that GPX file.')
      setView('map')
    } finally {
      setBusy(false)
    }
  }

  function handleLocate() {
    if (!map || !gps) {
      setGpsError((prev) => prev ?? 'Waiting for location permission…')
      return
    }
    setFollowGps(true)
    flyToGps(map, gps)
  }

  function handleStartSelectLocation() {
    setPlacementMode('selecting')
    setPendingLocation(null)
    setMenuOpen(false)
  }

  function handleMarkCurrentLocation() {
    if (!gps) {
      setGpsError((prev) => prev ?? 'Waiting for location permission…')
      return
    }
    setLocationFromCoords(gps.lng, gps.lat)
  }

  function handlePlaceLocation(lng: number, lat: number) {
    setLocationFromCoords(lng, lat)
    setMenuOpen(true)
  }

  async function handleSaveMarker(kind: TrailMarkerKind, note: string) {
    if (!pendingLocation) return

    const snapped = nearestPointOnTrails(pendingLocation.lng, pendingLocation.lat, tracks)
    const marker: TrailMarker = {
      id: crypto.randomUUID(),
      lng: snapped?.lng ?? pendingLocation.lng,
      lat: snapped?.lat ?? pendingLocation.lat,
      kind,
      note: note || undefined,
      trackId: snapped?.trackId,
      createdAt: Date.now(),
    }

    await saveMarker(marker)
    setMarkers((prev) => [marker, ...prev])
    resetPlacement()
  }

  async function handleDeleteMarker(id: string) {
    await deleteMarker(id)
    setMarkers((prev) => prev.filter((m) => m.id !== id))
    setDetailMarkerId(null)
  }

  const detailMarker = detailMarkerId
    ? markers.find((m) => m.id === detailMarkerId) ?? null
    : null

  return (
    <div className="app-frame">
      <div className="app-screens">
        <div className={`screen ${view === 'home' ? 'is-active' : ''}`} hidden={view !== 'home'}>
          <LandingPage onOpenMap={() => setView('map')} />
        </div>

        <div
          className={`screen screen-map ${view === 'map' ? 'is-active' : ''}`}
          hidden={view !== 'map'}
        >
          <div className={`map-page ${placementMode === 'selecting' ? 'is-placing' : ''}`}>
            <MapErrorBoundary>
              <MapView
                tracks={tracks}
                markers={markers}
                gps={gps}
                followGps={followGps}
                onFollowChange={handleFollowChange}
                onMapReady={handleMapReady}
                focusTrackId={focusTrackId}
                placementMode={placementMode}
                onPlaceLocation={handlePlaceLocation}
                onOpenMarkerDetail={(id) => {
                  setMenuOpen(false)
                  setDetailMarkerId(id)
                }}
              />
            </MapErrorBoundary>

            {detailMarker && (
              <MarkerDetailSheet
                marker={detailMarker}
                tracks={tracks}
                onClose={() => setDetailMarkerId(null)}
                onDelete={handleDeleteMarker}
              />
            )}

            {placementMode === 'selecting' && (
              <div className="placement-hint" role="status">
                Tap on the trail to set a marker location
              </div>
            )}

            <MapMenu
              open={menuOpen}
              onOpenChange={setMenuOpen}
              busy={busy}
              loading={loading}
              followGps={followGps}
              gps={gps}
              tracks={tracks}
              markers={markers}
              selection={selection}
              placementMode={placementMode}
              pendingLocation={pendingLocation}
              onSelect={setSelection}
              onImportGpx={importGpx}
              onLocate={handleLocate}
              onGoHome={() => setView('home')}
              onFocusTrack={(id) => {
                setFocusTrackId(null)
                requestAnimationFrame(() => setFocusTrackId(id))
              }}
              onStartSelectLocation={handleStartSelectLocation}
              onMarkCurrentLocation={handleMarkCurrentLocation}
              onCancelPlacement={resetPlacement}
              onSaveMarker={handleSaveMarker}
            />

            {busy && (
              <div className="toast" role="status">
                {busyLabel}
              </div>
            )}

            {gpsError && !busy && (
              <div className="toast" role="status">
                {gpsError}
                <button type="button" className="toast-dismiss" onClick={() => setGpsError(null)}>
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
