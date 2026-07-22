import { useState } from 'react'
import { MarkerKindIcon } from './MarkerKindIcon'
import { MARKER_KINDS } from '../lib/markers'
import type { GpsPosition, TrailMarker, TrailMarkerKind } from '../types'

type TrailMarkerFormProps = {
  selectedTrailName: string | null
  placementMode: 'idle' | 'selecting'
  pendingLocation: { lng: number; lat: number } | null
  gps: GpsPosition | null
  onStartSelectLocation: () => void
  onMarkCurrentLocation: () => void
  onCancelPlacement: () => void
  onSaveMarker: (kind: TrailMarkerKind, note: string) => void
  recentMarkers: TrailMarker[]
}

export function TrailMarkerForm({
  selectedTrailName,
  placementMode,
  pendingLocation,
  gps,
  onStartSelectLocation,
  onMarkCurrentLocation,
  onCancelPlacement,
  onSaveMarker,
  recentMarkers,
}: TrailMarkerFormProps) {
  const [selectedKind, setSelectedKind] = useState<TrailMarkerKind | null>(null)
  const [note, setNote] = useState('')

  const hasLocation = pendingLocation != null
  const selecting = placementMode === 'selecting'

  function handleSave() {
    if (!selectedKind || !hasLocation) return
    onSaveMarker(selectedKind, note.trim())
    setSelectedKind(null)
    setNote('')
  }

  function handleCancel() {
    setSelectedKind(null)
    setNote('')
    onCancelPlacement()
  }

  function handleChangeLocation() {
    onStartSelectLocation()
  }

  return (
    <div className="marker-form">
      <div className="marker-form-header">
        <h3 className="marker-form-title">Add marker</h3>
      </div>

      {!hasLocation && (
        <div className="marker-location-actions">
          <button
            type="button"
            className={`btn btn-primary ${selecting ? 'active-locate' : ''}`}
            disabled={!selectedTrailName}
            onClick={onStartSelectLocation}
          >
            Select location
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!gps || !selectedTrailName}
            onClick={onMarkCurrentLocation}
          >
            Mark current location
          </button>
        </div>
      )}

      {hasLocation && (
        <>
          <div className="marker-location-set">
            <span className="marker-location-label">Location set</span>
            <span className="marker-location-coords">
              {pendingLocation.lat.toFixed(5)}, {pendingLocation.lng.toFixed(5)}
            </span>
            <button type="button" className="btn btn-tiny" onClick={handleChangeLocation}>
              Change
            </button>
          </div>

          <div className="marker-kind-grid">
            {MARKER_KINDS.map((meta) => (
              <button
                key={meta.kind}
                type="button"
                className={`marker-kind-chip ${selectedKind === meta.kind ? 'active' : ''}`}
                onClick={() => setSelectedKind(meta.kind)}
              >
                <span className="marker-kind-icon" aria-hidden>
                  <MarkerKindIcon kind={meta.kind} size={22} />
                </span>
                {meta.shortLabel}
              </button>
            ))}
          </div>

          <label className="field">
            <span>Notes (optional)</span>
            <input
              type="text"
              placeholder="e.g. Large rock in the middle of the trail"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <div className="marker-form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedKind}
              onClick={handleSave}
            >
              Save marker
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </>
      )}

      {recentMarkers.length > 0 && (
        <div className="marker-recent">
          <span className="marker-recent-label">Recent markers</span>
          <ul className="marker-recent-list">
            {recentMarkers.slice(0, 5).map((marker) => {
              const meta = MARKER_KINDS.find((m) => m.kind === marker.kind)
              return (
                <li key={marker.id} className="marker-recent-item">
                  <span className="marker-kind-icon" aria-hidden>
                    <MarkerKindIcon kind={marker.kind} size={16} />
                  </span>
                  <span className="marker-recent-text">
                    {meta?.label ?? 'Marker'}
                    {marker.note ? ` — ${marker.note}` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
