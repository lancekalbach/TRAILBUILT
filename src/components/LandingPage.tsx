import { TopoBackground } from './TopoBackground'

type LandingPageProps = {
  onOpenMap: () => void
}

export function LandingPage({ onOpenMap }: LandingPageProps) {
  return (
    <section className="landing">
      <TopoBackground />
      <div className="landing-content">
        <p className="landing-kicker">Trail navigation</p>
        <h1 className="landing-brand">TrailBuilt</h1>
        <p className="landing-tagline">The solution to trail maintenance efficiency</p>
        <button type="button" className="landing-cta" onClick={onOpenMap}>
          <span className="landing-cta-bg" aria-hidden="true" />
          <span className="landing-cta-folds" aria-hidden="true" />
          <span className="landing-cta-corner" aria-hidden="true" />
          <span className="landing-cta-label">Open map</span>
        </button>
      </div>
    </section>
  )
}
