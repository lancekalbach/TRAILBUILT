import { useState } from 'react'
import { LandingPage } from './components/LandingPage'
import { MapErrorBoundary } from './components/MapErrorBoundary'
import { MapView } from './components/MapView'

type AppView = 'home' | 'map'

/**
 * Map screen is the official MapLibre "Display a map" demo (React port).
 * @see https://maplibre.org/maplibre-gl-js/docs/examples/display-a-map/
 */
export default function App() {
  const [view, setView] = useState<AppView>('home')

  return (
    <div className="app-frame">
      <div className="app-screens">
        <div className={`screen ${view === 'home' ? 'is-active' : ''}`} hidden={view !== 'home'}>
          <LandingPage onOpenMap={() => setView('map')} />
        </div>

        <div
          className={`screen screen-map ${view === 'map' ? 'is-active' : ''}`}
          hidden={view !== 'map'}
        >
          <div className="map-page">
            <MapErrorBoundary>
              {view === 'map' && <MapView />}
            </MapErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}
