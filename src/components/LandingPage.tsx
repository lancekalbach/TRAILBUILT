import { TopoBackground } from './TopoBackground'

type LandingPageProps = {
  onOpenMap: () => void
  onOpenCrew: () => void
}

export function LandingPage({ onOpenMap, onOpenCrew }: LandingPageProps) {
  return (
    <section className="landing">
      <TopoBackground />
      <div className="landing-content">
        <h1 className="landing-brand">TrailBuilt</h1>
        <p className="landing-tagline">The solution to trail maintenance efficiency</p>
        <div className="landing-actions">
          <button type="button" className="landing-cta" onClick={onOpenMap}>
            <span className="landing-cta-bg" aria-hidden="true" />
            <span className="landing-cta-folds" aria-hidden="true" />
            <span className="landing-cta-corner" aria-hidden="true" />
            <span className="landing-cta-label">Open map</span>
          </button>
          <button type="button" className="landing-cta" onClick={onOpenCrew}>
            <span className="landing-cta-bg" aria-hidden="true" />
            <span className="landing-cta-folds" aria-hidden="true" />
            <span className="landing-cta-corner" aria-hidden="true" />
            <span className="landing-cta-label">Crew Panel</span>
          </button>
        </div>
      </div>
    </section>
  )
}
