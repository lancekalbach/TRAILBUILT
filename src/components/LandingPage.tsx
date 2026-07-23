import { useEffect, useState } from 'react'
import { AuthPanel } from './AuthPanel'
import { TopoBackground } from './TopoBackground'
import { useAuth } from '../lib/auth'

type LandingPageProps = {
  onOpenMap: () => void
  onOpenCrew: () => void
  onOpenTrailStatus: () => void
}

export function LandingPage({ onOpenMap, onOpenCrew, onOpenTrailStatus }: LandingPageProps) {
  const { configured, session, profile, loading, isCrew, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    if (session) setAuthOpen(false)
  }, [session])

  useEffect(() => {
    if (!authOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAuthOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [authOpen])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <section className="landing">
      <TopoBackground />

      <div className="landing-auth-corner">
        {!configured ? (
          <span className="landing-auth-muted">Setup needed</span>
        ) : loading ? (
          <span className="landing-auth-muted" role="status">
            Checking…
          </span>
        ) : session ? (
          <div className="landing-session">
            <p className="landing-session-label">
              <strong>{profile?.displayName || profile?.email || 'rider'}</strong>
              {profile?.role ? <span className="landing-role">{profile.role}</span> : null}
            </p>
            <button
              type="button"
              className="landing-signout"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        ) : (
          <button type="button" className="landing-signin-trigger" onClick={() => setAuthOpen(true)}>
            Sign in
          </button>
        )}
      </div>

      <div className="landing-content">
        <h1 className="landing-brand">TrailBuilt</h1>
        <p className="landing-tagline">The solution to trail maintenance efficiency</p>

        {!configured ? (
          <div className="landing-setup" role="status">
            <p className="landing-setup-title">Connect Supabase to continue</p>
            <ol className="landing-setup-steps">
              <li>Create a Supabase project</li>
              <li>
                Run <code>supabase/schema.sql</code> in the SQL Editor
              </li>
              <li>
                Copy <code>.env.example</code> to <code>.env.local</code> and add your URL + anon key
              </li>
              <li>Restart <code>npm run dev</code></li>
            </ol>
          </div>
        ) : (
          <div className="landing-actions">
            <button type="button" className="landing-cta" onClick={onOpenMap}>
              <span className="landing-cta-bg" aria-hidden="true" />
              <span className="landing-cta-folds" aria-hidden="true" />
              <span className="landing-cta-corner" aria-hidden="true" />
              <span className="landing-cta-label">Open map</span>
            </button>
            {isCrew ? (
              <button type="button" className="landing-cta" onClick={onOpenCrew}>
                <span className="landing-cta-bg" aria-hidden="true" />
                <span className="landing-cta-folds" aria-hidden="true" />
                <span className="landing-cta-corner" aria-hidden="true" />
                <span className="landing-cta-label">Crew Panel</span>
              </button>
            ) : (
              <button type="button" className="landing-cta" onClick={onOpenTrailStatus}>
                <span className="landing-cta-bg" aria-hidden="true" />
                <span className="landing-cta-folds" aria-hidden="true" />
                <span className="landing-cta-corner" aria-hidden="true" />
                <span className="landing-cta-label">Trail Status</span>
              </button>
            )}
          </div>
        )}
      </div>

      {authOpen && configured && !session ? (
        <div className="auth-modal">
          <button
            type="button"
            className="auth-modal-backdrop"
            aria-label="Close sign in"
            onClick={() => setAuthOpen(false)}
          />
          <div
            className="auth-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in or create account"
          >
            <div className="auth-modal-header">
              <button
                type="button"
                className="auth-modal-close"
                aria-label="Close"
                onClick={() => setAuthOpen(false)}
              >
                ×
              </button>
            </div>
            <AuthPanel onSuccess={() => setAuthOpen(false)} />
          </div>
        </div>
      ) : null}
    </section>
  )
}
