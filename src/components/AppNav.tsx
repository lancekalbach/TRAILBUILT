import { useEffect, useId, useRef, useState } from 'react'

export type AppNavView = 'home' | 'map' | 'crew' | 'status'

type AppNavProps = {
  current: AppNavView
  onGoHome: () => void
  onOpenMap: () => void
  onOpenCrew: () => void
  onOpenTrailStatus: () => void
  brandClassName?: string
  className?: string
}

export function AppNav({
  current,
  onGoHome,
  onOpenMap,
  onOpenCrew,
  onOpenTrailStatus,
  brandClassName = 'map-brand',
  className,
}: AppNavProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      setOpen(false)
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('touchstart', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('touchstart', onPointer)
    }
  }, [open])

  function go(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div className={`app-nav ${className ?? ''}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={brandClassName}
        onClick={() => go(onGoHome)}
      >
        TrailBuilt
      </button>

      <div className={`app-nav-menu ${open ? 'is-open' : ''}`}>
        <button
          type="button"
          className="app-nav-trigger"
          aria-expanded={open}
          aria-controls={menuId}
          aria-haspopup="menu"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="app-nav-caret" aria-hidden>
            <svg viewBox="0 0 48 16" width="18" height="7" fill="none">
              <path
                d="M4 4 L24 12 L44 4"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        <div
          id={menuId}
          className="app-nav-panel"
          role="menu"
          aria-label="Site navigation"
        >
          <button
            type="button"
            role="menuitem"
            className={`app-nav-item ${current === 'home' ? 'is-current' : ''}`}
            onClick={() => go(onGoHome)}
          >
            Home
          </button>
          <button
            type="button"
            role="menuitem"
            className={`app-nav-item ${current === 'map' ? 'is-current' : ''}`}
            onClick={() => go(onOpenMap)}
          >
            Map
          </button>
          <button
            type="button"
            role="menuitem"
            className={`app-nav-item ${current === 'crew' ? 'is-current' : ''}`}
            onClick={() => go(onOpenCrew)}
          >
            Crew Panel
          </button>
          <button
            type="button"
            role="menuitem"
            className={`app-nav-item ${current === 'status' ? 'is-current' : ''}`}
            onClick={() => go(onOpenTrailStatus)}
          >
            Trail Status
          </button>
        </div>
      </div>
    </div>
  )
}
