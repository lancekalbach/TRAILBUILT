import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './lib/auth'
import './styles/app.css'

// StrictMode double-mounts in dev (creates/destroys the map twice). Off for map perf testing.
createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
)
