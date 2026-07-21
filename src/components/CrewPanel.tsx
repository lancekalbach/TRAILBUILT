import { useMemo, useState } from 'react'
import { markerKindMeta } from '../lib/markerKinds'
import type { TrailMarker, TrailTrack } from '../types'

const LOCAL_MEMBER_ID = 'you'

type CrewPanelProps = {
  loading: boolean
  markers: TrailMarker[]
  tracks: TrailTrack[]
  onAcceptTask: (markerId: string) => Promise<void>
  onCompleteTask: (markerId: string) => Promise<void>
  onGoHome: () => void
  onOpenMap: () => void
}

type CrewTab = 'feed' | 'tasks' | 'completed'

function formatReportedAt(timestamp: number): string {
  const elapsed = Date.now() - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (elapsed < minute) return 'Just now'
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}m ago`
  if (elapsed < day) return `${Math.floor(elapsed / hour)}h ago`
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}d ago`

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: timestamp < new Date().setFullYear(new Date().getFullYear() - 1) ? 'numeric' : undefined,
  }).format(timestamp)
}

export function CrewPanel({
  loading,
  markers,
  tracks,
  onAcceptTask,
  onCompleteTask,
  onGoHome,
  onOpenMap,
}: CrewPanelProps) {
  const [tab, setTab] = useState<CrewTab>('feed')
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trackNames = useMemo(
    () => new Map(tracks.map((track) => [track.id, track.name])),
    [tracks],
  )
  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => b.createdAt - a.createdAt),
    [markers],
  )
  const activeHazards = sortedMarkers.filter((marker) => !marker.completedAt)
  const myTasks = activeHazards.filter((marker) =>
    marker.participantIds?.includes(LOCAL_MEMBER_ID),
  )
  const completedTasks = sortedMarkers
    .filter((marker) => marker.completedAt)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  const visibleMarkers =
    tab === 'feed' ? activeHazards : tab === 'tasks' ? myTasks : completedTasks

  async function acceptTask(markerId: string) {
    setJoiningId(markerId)
    setError(null)
    try {
      await onAcceptTask(markerId)
    } catch {
      setError('Could not accept this task. Please try again.')
    } finally {
      setJoiningId(null)
    }
  }

  async function completeTask(markerId: string) {
    setCompletingId(markerId)
    setError(null)
    try {
      await onCompleteTask(markerId)
    } catch {
      setError('Could not complete this task. Please try again.')
    } finally {
      setCompletingId(null)
    }
  }

  return (
    <main className="crew-page">
      <header className="crew-header">
        <button type="button" className="crew-brand" onClick={onGoHome}>
          TrailBuilt
        </button>
        <button type="button" className="crew-map-link" onClick={onOpenMap}>
          Open map
        </button>
      </header>

      <div className="crew-shell">
        <section className="crew-intro">
          <h1>Crew Panel</h1>
        </section>

        <nav className="crew-tabs" aria-label="Crew panel sections">
          <button
            type="button"
            className={tab === 'feed' ? 'is-active' : ''}
            aria-pressed={tab === 'feed'}
            onClick={() => setTab('feed')}
          >
            Hazard feed
            <span>{activeHazards.length}</span>
          </button>
          <button
            type="button"
            className={tab === 'tasks' ? 'is-active' : ''}
            aria-pressed={tab === 'tasks'}
            onClick={() => setTab('tasks')}
          >
            My tasks
            <span>{myTasks.length}</span>
          </button>
          <button
            type="button"
            className={tab === 'completed' ? 'is-active' : ''}
            aria-pressed={tab === 'completed'}
            onClick={() => setTab('completed')}
          >
            Completed tasks
            <span>{completedTasks.length}</span>
          </button>
        </nav>

        {error && (
          <div className="crew-error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="crew-empty" role="status">
            <p className="crew-empty-label">Loading field reports…</p>
          </div>
        ) : visibleMarkers.length === 0 ? (
          <div className="crew-empty">
            <p className="crew-empty-eyebrow">
              {tab === 'feed' ? 'All clear' : tab === 'tasks' ? 'No assignments' : 'No completed work'}
            </p>
            <h2>
              {tab === 'feed'
                ? 'No hazards reported yet'
                : tab === 'tasks'
                  ? 'You have not joined a task yet'
                  : 'No tasks have been completed yet'}
            </h2>
            <p>
              {tab === 'feed'
                ? 'Add a trail hazard from the map and it will appear here.'
                : tab === 'tasks'
                  ? 'Choose a hazard from the feed to add it to your task list.'
                  : 'Completed crew tasks will be archived here.'}
            </p>
            <button
              type="button"
              className="crew-empty-action"
              onClick={tab === 'feed' ? onOpenMap : () => setTab(tab === 'completed' ? 'tasks' : 'feed')}
            >
              {tab === 'feed' ? 'Open map' : tab === 'tasks' ? 'Browse hazards' : 'Browse tasks'}
            </button>
          </div>
        ) : (
          <section
            className="crew-feed"
            aria-label={
              tab === 'feed' ? 'Hazard feed' : tab === 'tasks' ? 'My tasks' : 'Completed tasks'
            }
          >
            {visibleMarkers.map((marker) => {
              const meta = markerKindMeta(marker.kind)
              const joined = marker.participantIds?.includes(LOCAL_MEMBER_ID) ?? false
              const completed = Boolean(marker.completedAt)
              const participantCount = marker.participantIds?.length ?? 0
              const trackName = marker.trackId ? trackNames.get(marker.trackId) : undefined

              return (
                <article className={completed ? 'crew-card is-completed' : 'crew-card'} key={marker.id}>
                  <div className="crew-card-mark" aria-hidden="true">
                    {completed ? '✓' : '!'}
                  </div>
                  <div className="crew-card-body">
                    <div className="crew-card-meta">
                      <span>{meta.label}</span>
                      <time dateTime={new Date(marker.createdAt).toISOString()}>
                        {formatReportedAt(marker.createdAt)}
                      </time>
                    </div>
                    <h2>{marker.note || `${meta.label} reported`}</h2>
                    <p className="crew-card-location">
                      {trackName ?? 'Trail location'} · {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
                    </p>
                    <div className="crew-card-footer">
                      <p>
                        {completed && marker.completedAt
                          ? `Completed ${formatReportedAt(marker.completedAt)}`
                          : participantCount === 0
                          ? 'No crew assigned'
                          : `${participantCount} crew member${participantCount === 1 ? '' : 's'} joined`}
                      </p>
                      {completed ? (
                        <button type="button" className="crew-task-button is-completed" disabled>
                          Completed
                        </button>
                      ) : tab === 'tasks' && joined ? (
                        <button
                          type="button"
                          className="crew-task-button is-complete-action"
                          disabled={completingId === marker.id}
                          onClick={() => void completeTask(marker.id)}
                        >
                          {completingId === marker.id ? 'Completing…' : 'Mark completed'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={joined ? 'crew-task-button is-joined' : 'crew-task-button'}
                          disabled={joined || joiningId === marker.id}
                          onClick={() => void acceptTask(marker.id)}
                        >
                          {joiningId === marker.id ? 'Joining…' : joined ? 'Joined' : 'Accept task'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}
