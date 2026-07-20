import { useState } from 'react'
import { LandingPage } from './components/LandingPage'
import { MapErrorBoundary } from './components/MapErrorBoundary'
import { MapView } from './components/MapView'

type AppView = 'home' | 'map'

/**
 * Landing unmounts when the map opens — keeps topo animations off the GPU
 * while pinching (that was the lag source).
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
