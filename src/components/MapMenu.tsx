import { useEffect, useState, type ReactNode } from 'react'
import { FileUploader } from './FileUploader'
import { TrailLibrary } from './TrailLibrary'
import { TrailMarkerForm } from './TrailMarkerForm'
import type {
  GpsPosition,
  LibrarySelection,
  MarkerPlacementMode,
  TrailMarker,
  TrailMarkerKind,
  TrailTrack,
} from '../types'

type MapMenuProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  loading: boolean
  followGps: boolean
  gps: GpsPosition | null
  tracks: TrailTrack[]
  markers: TrailMarker[]
  selection: LibrarySelection
  placementMode: MarkerPlacementMode
  pendingLocation: { lng: number; lat: number } | null
  onSelect: (selection: NonNullable<LibrarySelection>) => void
  onImportGpx: (file: File) => void
  onLocate: () => void
  onGoHome: () => void
  onFocusTrack: (id: string) => void
  onStartSelectLocation: () => void
  onMarkCurrentLocation: () => void
  onCancelPlacement: () => void
  onSaveMarker: (kind: TrailMarkerKind, note: string) => void
}

function useIsDesktop(query = '(min-width: 900px)') {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

function MenuBody({
  busy,
  loading,
  followGps,
  gps,
  tracks,
  markers,
  selection,
  placementMode,
  pendingLocation,
  onSelect,
  onImportGpx,
  onLocate,
  onOpenChange,
  onFocusTrack,
  onStartSelectLocation,
  onMarkCurrentLocation,
  onCancelPlacement,
  onSaveMarker,
}: Omit<MapMenuProps, 'open' | 'onGoHome'>) {
  return (
    <>
      <div className="map-menu-actions">
        <FileUploader
          label="Import GPX"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          disabled={busy || loading}
          onFileSelected={onImportGpx}
        />
        <button
          type="button"
          className={`btn btn-ghost ${followGps ? 'active-locate' : ''}`}
          onClick={onLocate}
        >
          My location
        </button>
      </div>

      <div className="map-menu-divider" />

      <TrailMarkerForm
        placementMode={placementMode}
        pendingLocation={pendingLocation}
        gps={gps}
        onStartSelectLocation={onStartSelectLocation}
        onMarkCurrentLocation={onMarkCurrentLocation}
        onCancelPlacement={onCancelPlacement}
        onSaveMarker={(kind, note) => {
          onSaveMarker(kind, note)
          onOpenChange(false)
        }}
        recentMarkers={markers}
      />

      <div className="map-menu-divider" />

      <TrailLibrary
        tracks={tracks}
        selection={selection}
        onSelect={onSelect}
        onFocusTrack={(id) => {
          onFocusTrack(id)
          onOpenChange(false)
        }}
      />
    </>
  )
}

function MenuShell({
  open,
  onOpenChange,
  onGoHome,
  desktop,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGoHome: () => void
  desktop: boolean
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  if (desktop) {
    return (
      <div className={`map-dropdown ${open ? 'is-open' : ''}`}>
        <div className="map-top-row">
          <button
            type="button"
            className="map-brand"
            onClick={() => {
              onGoHome()
              onOpenChange(false)
            }}
          >
            TrailBuilt
          </button>
          <button
            type="button"
            className="map-dropdown-trigger"
            aria-expanded={open}
            aria-controls="map-menu-panel"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => onOpenChange(!open)}
          >
            Menu
            <span className="map-dropdown-caret" aria-hidden>
              <svg viewBox="0 0 48 16" width="20" height="8" fill="none">
                <path
                  d="M4 4 L24 12 L44 4"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>

        {open && (
          <>
            <button
              type="button"
              className="map-dropdown-backdrop"
              aria-label="Close menu"
              onClick={() => onOpenChange(false)}
            />
            <div
              id="map-menu-panel"
              className="map-dropdown-panel"
              role="dialog"
              aria-label="Map menu"
            >
              {children}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        className="map-brand map-brand-mobile"
        onClick={() => {
          onGoHome()
          onOpenChange(false)
        }}
      >
        TrailBuilt
      </button>

      <div className={`map-drawer ${open ? 'is-open' : ''}`}>
        {open && (
          <button
            type="button"
            className="map-drawer-backdrop"
            aria-label="Close menu"
            onClick={() => onOpenChange(false)}
          />
        )}

        <div
          className="map-drawer-sheet"
          id="map-menu-panel"
          role="dialog"
          aria-label="Map menu"
          aria-modal={open}
        >
          <button
            type="button"
            className="map-drawer-handle"
            aria-expanded={open}
            aria-controls="map-drawer-body"
            aria-label={open ? 'Collapse menu' : 'Open menu'}
            onClick={() => onOpenChange(!open)}
          >
            <span className="map-drawer-chevron" aria-hidden>
              <svg viewBox="0 0 48 16" width="34" height="12" fill="none">
                <path
                  d="M4 12 L24 4 L44 12"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>

          <div id="map-drawer-body" className="map-drawer-body">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}

export function MapMenu(props: MapMenuProps) {
  const isDesktop = useIsDesktop()
  const { open, onOpenChange, onGoHome, ...bodyProps } = props

  return (
    <MenuShell open={open} onOpenChange={onOpenChange} onGoHome={onGoHome} desktop={isDesktop}>
      <MenuBody {...bodyProps} onOpenChange={onOpenChange} />
    </MenuShell>
  )
}
