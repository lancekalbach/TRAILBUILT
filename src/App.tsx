import { useState } from 'react'
import { LandingPage } from './components/LandingPage'
import { MapErrorBoundary } from './components/MapErrorBoundary'
import { MapView } from './components/MapView'

type AppView = 'home' | 'map'

/**
 * Map screen is the official MapLibre demo, mounted alone (no shell / no landing).
 * Landing was staying in the DOM with infinite GPU animations under opacity:0 —
 * that can make pinch-zoom feel laggy even with a stock map.
 */
export default function App() {
  const [view, setView] = useState<AppView>('home')

  if (view === 'map') {
    return (
      <MapErrorBoundary>
        <MapView />
      </MapErrorBoundary>
    )
  }

  return (
    <div className="app-frame">
      <LandingPage onOpenMap={() => setView('map')} />
    </div>
  )
}
