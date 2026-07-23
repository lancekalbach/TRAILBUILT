import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'

type Mode = 'signin' | 'signup'

type AuthPanelProps = {
  onSuccess?: () => void
}

export function AuthPanel({ onSuccess }: AuthPanelProps) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
        onSuccess?.()
      } else {
        const message = await signUp(email.trim(), password, displayName)
        if (message) {
          setInfo(message)
        } else {
          onSuccess?.()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  return (
    <div className="auth-panel">
      <div className="auth-tabs" role="tablist" aria-label="Account">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={mode === 'signin' ? 'is-active' : ''}
          onClick={() => switchMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={mode === 'signup' ? 'is-active' : ''}
          onClick={() => switchMode('signup')}
        >
          Create account
        </button>
      </div>

      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="auth-fields">
          {mode === 'signup' ? (
            <label className="field">
              <span>Display name</span>
              <input
                type="text"
                name="displayName"
                autoComplete="nickname"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Example"
              />
            </label>
          ) : null}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          {error ? (
            <p className="auth-message is-error" role="alert">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="auth-message" role="status">
              {info}
            </p>
          ) : null}
        </div>

        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
