import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { CrewPanel } from './components/CrewPanel'
import { LandingPage } from './components/LandingPage'
import { MapErrorBoundary } from './components/MapErrorBoundary'
import { MapMenu } from './components/MapMenu'
import { MapView } from './components/MapView'
import { MarkerDetailSheet } from './components/MarkerDetailSheet'
import { TrailStatusPage } from './components/TrailStatusPage'
import { ensurePbrSeedTracks, pbrNetworkBounds } from './data/pbr/seed'
import { useAuth } from './lib/auth'
import { nextTrailColor, parseGpx } from './lib/gpx'
import { watchGps } from './lib/geolocation'
import { flyToGps } from './lib/mapCamera'
import {
  acceptMarkerTask,
  completeMarkerTask,
  deleteMarker,
  loadMarkers,
  saveMarker,
  subscribeMarkers,
} from './lib/markersApi'
import { readFileAsText, saveTrack } from './lib/storage'
import {
  loadTrailStatuses,
  subscribeTrailStatuses,
  type TrailStatusMap,
} from './lib/trailStatusApi'
import { nearestPointOnTrails } from './lib/trailGeometry'
import type {
  GpsPosition,
  LibrarySelection,
  MarkerPlacementMode,
  TrailMarker,
  TrailMarkerKind,
  TrailTrack,
} from './types'

type AppView = 'home' | 'map' | 'crew' | 'status'

/**
 * Landing fully unmounts on map open (keeps topo animations off the GPU).
 */
export default function App() {
  const { session, profile, loading: authLoading, isCrew } = useAuth()
  const memberId = profile?.id ?? null

  const [view, setView] = useState<AppView>('home')
  const [tracks, setTracks] = useState<TrailTrack[]>([])
  const [markers, setMarkers] = useState<TrailMarker[]>([])
  const [trailStatuses, setTrailStatuses] = useState<TrailStatusMap>({})
  const [selection, setSelection] = useState<LibrarySelection>(null)
  const [gps, setGps] = useState<GpsPosition | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [followGps, setFollowGps] = useState(false)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [focusTrackId, setFocusTrackId] = useState<string | null>(null)
  const [focusMarkerId, setFocusMarkerId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('Working…')
  const [placementMode, setPlacementMode] = useState<MarkerPlacementMode>('idle')
  const [pendingLocation, setPendingLocation] = useState<{ lng: number; lat: number } | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [crewFocusMarkerId, setCrewFocusMarkerId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadTrailStatuses()
      .then((statuses) => {
        if (!cancelled) setTrailStatuses(statuses)
      })
      .catch(() => undefined)

    const unsubscribe = subscribeTrailStatuses((statuses) => {
      if (!cancelled) setTrailStatuses(statuses)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void Promise.all([
      ensurePbrSeedTracks(),
      loadMarkers().catch(() => {
        if (!cancelled) setGpsError('Could not load shared hazards.')
        return [] as TrailMarker[]
      }),
    ])
      .then(([trackList, markerList]) => {
        if (cancelled) return
        setTracks(trackList)
        setMarkers(markerList)
        const initialTrack =
          trackList.find((track) => track.skillLevel?.toLowerCase() !== 'access') ?? trackList[0]
        if (initialTrack) setSelection({ kind: 'track', id: initialTrack.id })
      })
      .catch(() => {
        if (!cancelled) setGpsError('Could not load trails.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const unsubscribe = subscribeMarkers((markerList) => {
      if (!cancelled) setMarkers(markerList)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session && view === 'crew') setView('home')
  }, [session, view])

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
    if (didInitialCamera.current || !map || loading || tracks.length === 0 || focusMarkerId) return
    const bounds = pbrNetworkBounds(tracks)
    if (!bounds) return
    didInitialCamera.current = true
    map.fitBounds(bounds, { padding: 56, maxZoom: 14, animate: false })
  }, [map, tracks, loading, focusMarkerId])

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
      setFocusMarkerId(null)
      setMap(null)
      setFollowGps(false)
      didInitialCamera.current = false
    }
  }, [view])

  function openCrew() {
    if (!isCrew) {
      setGpsError('Crew panel is limited to crew and admin accounts.')
      setView('home')
      return
    }
    setView('crew')
  }

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
    if (!memberId) {
      setGpsError('Sign in to report a hazard.')
      return
    }

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
      createdBy: memberId,
      participantIds: [],
    }

    try {
      const saved = await saveMarker(marker, memberId)
      setMarkers((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)])
      resetPlacement()
    } catch {
      setGpsError('Could not save that hazard. Check your connection and try again.')
    }
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
    if (!memberId || !isCrew) return
    const marker = markers.find((item) => item.id === markerId)
    if (!marker || marker.completedAt || marker.participantIds?.includes(memberId)) return

    const saved = await acceptMarkerTask(markerId)
    setMarkers((prev) => prev.map((item) => (item.id === markerId ? saved : item)))
  }

  async function handleCompleteTask(markerId: string) {
    if (!memberId || !isCrew) return
    const marker = markers.find((item) => item.id === markerId)
    if (!marker || marker.completedAt || !marker.participantIds?.includes(memberId)) {
      return
    }

    const saved = await completeMarkerTask(markerId)
    setMarkers((prev) => prev.map((item) => (item.id === markerId ? saved : item)))
    setSelectedMarkerId((current) => (current === markerId ? null : current))
  }

  function handleViewOnMap(markerId: string) {
    const marker = markers.find((item) => item.id === markerId)
    if (!marker) return

    setFollowGps(false)
    setFocusMarkerId(markerId)
    if (!marker.completedAt) {
      setSelectedMarkerId(markerId)
      if (marker.trackId) {
        setSelection({ kind: 'track', id: marker.trackId })
      }
    }
    setView('map')
  }

  const handleCrewFocusHandled = useCallback(() => {
    setCrewFocusMarkerId(null)
  }, [])

  const focusMarkerLocation = useMemo(() => {
    if (!focusMarkerId) return null
    const marker = markers.find((item) => item.id === focusMarkerId)
    return marker ? { lng: marker.lng, lat: marker.lat } : null
  }, [focusMarkerId, markers])

  const activeMarkers = markers.filter((marker) => !marker.completedAt)
  const selectedMarker = activeMarkers.find((marker) => marker.id === selectedMarkerId)
  const dataLoading = authLoading || loading

  if (view === 'home') {
    return (
      <div className="app-frame">
        <LandingPage
          onOpenMap={() => setView('map')}
          onOpenCrew={openCrew}
          onOpenTrailStatus={() => setView('status')}
        />
      </div>
    )
  }

  if (view === 'crew') {
    if (!isCrew || !memberId) {
      return (
        <div className="app-frame">
          <LandingPage
            onOpenMap={() => setView('map')}
            onOpenCrew={openCrew}
            onOpenTrailStatus={() => setView('status')}
          />
        </div>
      )
    }

    return (
      <CrewPanel
        loading={dataLoading}
        markers={markers}
        tracks={tracks}
        memberId={memberId}
        focusMarkerId={crewFocusMarkerId}
        onAcceptTask={handleAcceptTask}
        onCompleteTask={handleCompleteTask}
        onViewOnMap={handleViewOnMap}
        onGoHome={() => setView('home')}
        onOpenMap={() => setView('map')}
        onOpenTrailStatus={() => setView('status')}
        onFocusHandled={handleCrewFocusHandled}
      />
    )
  }

  if (view === 'status') {
    return (
      <TrailStatusPage
        onGoHome={() => setView('home')}
        onOpenMap={() => setView('map')}
        onOpenCrew={openCrew}
        onOpenTrailStatus={() => undefined}
        showCrew={isCrew}
        statuses={trailStatuses}
        onStatusesChange={setTrailStatuses}
      />
    )
  }

  return (
    <div className={`map-page ${placementMode === 'selecting' ? 'is-placing' : ''}`}>
      <MapErrorBoundary>
        <MapView
          tracks={tracks}
          markers={activeMarkers}
          trailStatuses={trailStatuses}
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
          focusMarkerLocation={focusMarkerLocation}
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
        loading={dataLoading}
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
        onOpenMap={() => setView('map')}
        onOpenCrew={openCrew}
        onOpenTrailStatus={() => setView('status')}
        showCrew={isCrew}
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
          onViewInCrew={
            isCrew
              ? (id) => {
                  setSelectedMarkerId(null)
                  setCrewFocusMarkerId(id)
                  setView('crew')
                }
              : undefined
          }
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
