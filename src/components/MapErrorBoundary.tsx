import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  error: Error | null
}

/** Keeps the rest of the app alive if the map view fails. */
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Map view crashed', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="map-error" role="alert">
            <p>Trail view failed to load.</p>
            <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
