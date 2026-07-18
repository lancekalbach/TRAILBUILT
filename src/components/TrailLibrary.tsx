import type { LibrarySelection, TrailTrack } from '../types'

type TrailLibraryProps = {
  tracks: TrailTrack[]
  selection: LibrarySelection
  onSelect: (selection: NonNullable<LibrarySelection>) => void
  onFocusTrack: (id: string) => void
}

export function TrailLibrary({ tracks, selection, onSelect, onFocusTrack }: TrailLibraryProps) {
  if (tracks.length === 0) {
    return (
      <div className="overlay-panel empty">
        <p>No trails yet. Import a GPX from Trailforks or Strava to get started.</p>
      </div>
    )
  }

  const selectedId = selection?.id ?? null

  return (
    <div className="overlay-panel">
      <div className="overlay-list">
        {tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            className={`overlay-chip ${selectedId === track.id ? 'active' : ''}`}
            onClick={() => {
              onSelect({ kind: 'track', id: track.id })
              onFocusTrack(track.id)
            }}
          >
            <span className="chip-swatch" style={{ background: track.color }} />
            {track.name}
          </button>
        ))}
      </div>
    </div>
  )
}
