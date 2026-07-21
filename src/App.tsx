import { useCallback, useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { CrewPanel } from './components/CrewPanel'
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
  updateMarker,
} from './lib/storage'
import type {
  GpsPosition,
  LibrarySelection,
  MarkerPlacementMode,
  TrailMarker,
  TrailMarkerKind,
  TrailTrack,
} from './types'

type AppView = 'home' | 'map' | 'crew'

const LOCAL_MEMBER_ID = 'you'

/**
 * Landing fully unmounts on map open (keeps topo animations off the GPU).
 */
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
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([ensurePbrSeedTracks(), loadMarkers()])
      .then(([trackList, markerList]) => {
        if (cancelled) return
        setTracks(trackList)
        setMarkers(markerList)
        const initialTrack =
          trackList.find((track) => track.skillLevel?.toLowerCase() !== 'access') ?? trackList[0]
        if (initialTrack) setSelection({ kind: 'track', id: initialTrack.id })
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
    if (didInitialCamera.current || !map || loading || tracks.length === 0) return
    const bounds = pbrNetworkBounds(tracks)
    if (!bounds) return
    didInitialCamera.current = true
    map.fitBounds(bounds, { padding: 56, maxZoom: 14, animate: false })
  }, [map, tracks, loading])

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
      setSelectedMarkerId(null)
      setMap(null)
      setFollowGps(false)
      didInitialCamera.current = false
    }
  }, [view])

  function resetPlacement() {
    setPlacementMode('idle')
    setPendingLocation(null)
  }

  function setLocationFromCoords(lng: number, lat: number, clickedTrackId?: string | null) {
    if (clickedTrackId === null) {
      setGpsError('Tap directly on the trail you want to mark.')
      return
    }

    const targetTrackId = clickedTrackId ?? selection?.id
    const selectedTrack = tracks.find((track) => track.id === targetTrackId)
    if (!selectedTrack) {
      setGpsError('Select a trail before adding a marker.')
      setPlacementMode('idle')
      setMenuOpen(true)
      return
    }

    const snapped = nearestPointOnTrails(lng, lat, [selectedTrack])
    if (!snapped) {
      setGpsError('Could not place a marker on the selected trail.')
      setPlacementMode('idle')
      setMenuOpen(true)
      return
    }

    if (selection?.id !== selectedTrack.id) {
      setSelection({ kind: 'track', id: selectedTrack.id })
    }
    setPendingLocation({ lng: snapped.lng, lat: snapped.lat })
    setGpsError(null)
    setPlacementMode('idle')
    setMenuOpen(true)
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
    if (!flyToGps(map, gps)) {
      setGpsError('Location is outside the Priest Ridge map area.')
      return
    }
    setFollowGps(true)
  }

  function handleStartSelectLocation() {
    if (!selection) {
      setGpsError('Select a trail before adding a marker.')
      return
    }
    setGpsError(null)
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

  async function handleSaveMarker(kind: TrailMarkerKind, note: string) {
    const selectedTrack = tracks.find((track) => track.id === selection?.id)
    if (!pendingLocation || !selectedTrack) return

    const snapped = nearestPointOnTrails(pendingLocation.lng, pendingLocation.lat, [selectedTrack])
    const marker: TrailMarker = {
      id: crypto.randomUUID(),
      lng: snapped?.lng ?? pendingLocation.lng,
      lat: snapped?.lat ?? pendingLocation.lat,
      kind,
      note: note || undefined,
      trackId: selectedTrack.id,
      createdAt: Date.now(),
    }

    await saveMarker(marker)
    setMarkers((prev) => [marker, ...prev])
    resetPlacement()
  }

  async function handleDeleteMarker(id: string) {
    try {
      await deleteMarker(id)
      setMarkers((prev) => prev.filter((marker) => marker.id !== id))
      setSelectedMarkerId(null)
    } catch {
      setGpsError('Could not delete that marker.')
    }
  }

  async function handleAcceptTask(markerId: string) {
    const marker = markers.find((item) => item.id === markerId)
    if (!marker || marker.completedAt || marker.participantIds?.includes(LOCAL_MEMBER_ID)) return

    const updatedMarker: TrailMarker = {
      ...marker,
      participantIds: [...(marker.participantIds ?? []), LOCAL_MEMBER_ID],
    }
    await updateMarker(updatedMarker)
    setMarkers((prev) => prev.map((item) => (item.id === markerId ? updatedMarker : item)))
  }

  async function handleCompleteTask(markerId: string) {
    const marker = markers.find((item) => item.id === markerId)
    if (
      !marker ||
      marker.completedAt ||
      !marker.participantIds?.includes(LOCAL_MEMBER_ID)
    ) {
      return
    }

    const updatedMarker: TrailMarker = {
      ...marker,
      completedAt: Date.now(),
    }
    await updateMarker(updatedMarker)
    setMarkers((prev) => prev.map((item) => (item.id === markerId ? updatedMarker : item)))
    setSelectedMarkerId((current) => (current === markerId ? null : current))
  }

  const activeMarkers = markers.filter((marker) => !marker.completedAt)
  const selectedMarker = activeMarkers.find((marker) => marker.id === selectedMarkerId)

  if (view === 'home') {
    return (
      <div className="app-frame">
        <LandingPage onOpenMap={() => setView('map')} onOpenCrew={() => setView('crew')} />
      </div>
    )
  }

  if (view === 'crew') {
    return (
      <CrewPanel
        loading={loading}
        markers={markers}
        tracks={tracks}
        onAcceptTask={handleAcceptTask}
        onCompleteTask={handleCompleteTask}
        onGoHome={() => setView('home')}
        onOpenMap={() => setView('map')}
      />
    )
  }

  return (
    <div className={`map-page ${placementMode === 'selecting' ? 'is-placing' : ''}`}>
      <MapErrorBoundary>
        <MapView
          tracks={tracks}
          markers={activeMarkers}
          gps={gps}
          followGps={followGps}
          selectedTrackId={selection?.id}
          selectingLocation={placementMode === 'selecting'}
          onSelectLocation={
            placementMode === 'selecting' ? setLocationFromCoords : undefined
          }
          onOpenMarkerDetail={setSelectedMarkerId}
          onFollowChange={handleFollowChange}
          onMapReady={handleMapReady}
          focusTrackId={focusTrackId}
        />
      </MapErrorBoundary>

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
        markers={activeMarkers}
        selection={selection}
        placementMode={placementMode}
        pendingLocation={pendingLocation}
        onSelect={(nextSelection) => {
          setSelection(nextSelection)
          resetPlacement()
          setGpsError(null)
        }}
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

      {selectedMarker && (
        <MarkerDetailSheet
          marker={selectedMarker}
          tracks={tracks}
          onClose={() => setSelectedMarkerId(null)}
          onDelete={handleDeleteMarker}
        />
      )}

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
  )
}
