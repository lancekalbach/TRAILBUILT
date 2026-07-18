import { useEffect } from 'react'
import { MarkerKindIcon } from './MarkerKindIcon'
import { markerKindMeta } from '../lib/markers'
import type { TrailMarker, TrailTrack } from '../types'

type MarkerDetailSheetProps = {
  marker: TrailMarker
  tracks: TrailTrack[]
  onClose: () => void
  onDelete: (id: string) => void
}

function formatMarkedAt(createdAt: number) {
  try {
    return new Date(createdAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return ''
  }
}

export function MarkerDetailSheet({ marker, tracks, onClose, onDelete }: MarkerDetailSheetProps) {
  const meta = markerKindMeta(marker.kind)
  const trailName = marker.trackId
    ? tracks.find((t) => t.id === marker.trackId)?.name
    : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="marker-detail">
      <button
        type="button"
        className="marker-detail-backdrop"
        aria-label="Close hazard details"
        onClick={onClose}
      />
      <div
        className="marker-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${meta.label} details`}
      >
        <div className="marker-detail-header">
          <div className="marker-detail-title-row">
            <span className="marker-detail-icon" aria-hidden>
              <MarkerKindIcon kind={marker.kind} size={24} />
            </span>
            <h2 className="marker-detail-title">{meta.label}</h2>
          </div>
          <button type="button" className="marker-detail-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="marker-detail-body">
          {marker.note ? (
            <p className="marker-detail-note">{marker.note}</p>
          ) : (
            <p className="marker-detail-note muted">No notes added.</p>
          )}

          <dl className="marker-detail-meta">
            {trailName && (
              <div>
                <dt>Trail</dt>
                <dd>{trailName}</dd>
              </div>
            )}
            <div>
              <dt>Marked</dt>
              <dd>{formatMarkedAt(marker.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="marker-detail-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (!confirm(`Delete this ${meta.label.toLowerCase()} marker?`)) return
              onDelete(marker.id)
            }}
          >
            Delete marker
          </button>
        </div>
      </div>
    </div>
  )
}
