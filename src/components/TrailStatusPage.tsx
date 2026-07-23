import { useEffect, useMemo, useState } from 'react'
import { AppNav } from './AppNav'
import { useAuth } from '../lib/auth'
import {
  TRAIL_OPEN_STATUSES,
  TRAIL_STATUS_LABELS,
  withTrailStatuses,
  type TrailDifficulty,
  type TrailOpenStatus,
} from '../data/trailStatus'
import {
  loadTrailStatuses,
  subscribeTrailStatuses,
  updateTrailStatus,
  type TrailStatusMap,
} from '../lib/trailStatusApi'

type TrailStatusPageProps = {
  onGoHome: () => void
  onOpenMap: () => void
  onOpenCrew: () => void
  onOpenTrailStatus: () => void
  showCrew?: boolean
  statuses?: TrailStatusMap
  onStatusesChange?: (statuses: TrailStatusMap) => void
}

function DifficultyMark({ difficulty }: { difficulty: TrailDifficulty }) {
  const label =
    difficulty === 'Double Black'
      ? 'Double black'
      : difficulty === 'Pro Line'
        ? 'Pro line'
        : difficulty

  return (
    <span
      className={`trail-status-diff trail-status-diff--${slug(difficulty)}`}
      title={difficulty}
      aria-label={`Difficulty ${label}`}
    >
      <span className="trail-status-diff-glyph" aria-hidden>
        {difficulty === 'Double Black' || difficulty === 'Pro Line' ? (
          <>
            <span className="trail-status-diff-shape" />
            <span className="trail-status-diff-shape" />
          </>
        ) : (
          <span className="trail-status-diff-shape" />
        )}
      </span>
      <span className="trail-status-diff-label">{difficulty}</span>
    </span>
  )
}

function StatusBadge({ status }: { status: TrailOpenStatus }) {
  return (
    <span className={`trail-status-badge trail-status-badge--${status}`}>
      {TRAIL_STATUS_LABELS[status]}
    </span>
  )
}

function slug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-')
}

export function TrailStatusPage({
  onGoHome,
  onOpenMap,
  onOpenCrew,
  onOpenTrailStatus,
  showCrew = false,
  statuses: statusesProp,
  onStatusesChange,
}: TrailStatusPageProps) {
  const { profile, isAdmin } = useAuth()
  const [localStatuses, setLocalStatuses] = useState<TrailStatusMap>(statusesProp ?? {})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const statuses = statusesProp ?? localStatuses

  useEffect(() => {
    if (statusesProp) {
      setLocalStatuses(statusesProp)
      return
    }

    let cancelled = false
    void loadTrailStatuses()
      .then((next) => {
        if (!cancelled) setLocalStatuses(next)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load trail status.')
      })

    const unsubscribe = subscribeTrailStatuses((next) => {
      if (!cancelled) setLocalStatuses(next)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [statusesProp])

  const trails = useMemo(() => withTrailStatuses(statuses), [statuses])

  async function handleStatusChange(trailId: string, status: TrailOpenStatus) {
    if (!isAdmin || !profile?.id) return
    setSavingId(trailId)
    setError(null)
    const previous = statuses
    const optimistic = { ...statuses, [trailId]: status }
    setLocalStatuses(optimistic)
    onStatusesChange?.(optimistic)

    try {
      await updateTrailStatus(trailId, status, profile.id)
    } catch {
      setLocalStatuses(previous)
      onStatusesChange?.(previous)
      setError('Could not update trail status. Only admins can change it.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <main className="trail-status-page">
      <header className="crew-header">
        <AppNav
          current="status"
          brandClassName="crew-brand"
          showCrew={showCrew}
          onGoHome={onGoHome}
          onOpenMap={onOpenMap}
          onOpenCrew={onOpenCrew}
          onOpenTrailStatus={onOpenTrailStatus}
        />
      </header>

      <div className="crew-shell trail-status-shell">
        <section className="crew-intro">
          <h1>Trail Status</h1>
          {isAdmin ? (
            <p className="trail-status-admin-hint">Admin: change a trail’s open status below.</p>
          ) : null}
        </section>

        {error ? (
          <div className="crew-error" role="alert">
            {error}
          </div>
        ) : null}

        <ul className="trail-status-list" aria-label="Trail open status">
          {trails.map((trail) => (
            <li key={trail.id} className="trail-status-row">
              <DifficultyMark difficulty={trail.difficulty} />
              <span className="trail-status-name">{trail.name}</span>
              {isAdmin ? (
                <label className="trail-status-select-wrap">
                  <span className="sr-only">Status for {trail.name}</span>
                  <select
                    className={`trail-status-select trail-status-select--${trail.status}`}
                    value={trail.status}
                    disabled={savingId === trail.id}
                    onChange={(event) =>
                      void handleStatusChange(trail.id, event.target.value as TrailOpenStatus)
                    }
                  >
                    {TRAIL_OPEN_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {TRAIL_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <StatusBadge status={trail.status} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
