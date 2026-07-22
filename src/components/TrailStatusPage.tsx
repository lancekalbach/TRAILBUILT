import { AppNav } from './AppNav'
import {
  TRAIL_STATUS_LABELS,
  TRAIL_STATUS_LIST,
  type TrailDifficulty,
  type TrailOpenStatus,
} from '../data/trailStatus'

type TrailStatusPageProps = {
  onGoHome: () => void
  onOpenMap: () => void
  onOpenCrew: () => void
  onOpenTrailStatus: () => void
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
}: TrailStatusPageProps) {
  return (
    <main className="trail-status-page">
      <header className="crew-header">
        <AppNav
          current="status"
          brandClassName="crew-brand"
          onGoHome={onGoHome}
          onOpenMap={onOpenMap}
          onOpenCrew={onOpenCrew}
          onOpenTrailStatus={onOpenTrailStatus}
        />
      </header>

      <div className="crew-shell trail-status-shell">
        <section className="crew-intro">
          <h1>Trail Status</h1>
        </section>

        <ul className="trail-status-list" aria-label="Trail open status">
          {TRAIL_STATUS_LIST.map((trail) => (
            <li key={trail.id} className="trail-status-row">
              <DifficultyMark difficulty={trail.difficulty} />
              <span className="trail-status-name">{trail.name}</span>
              <StatusBadge status={trail.status} />
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
