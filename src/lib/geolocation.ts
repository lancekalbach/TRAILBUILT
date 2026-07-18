import type { GpsPosition } from '../types'

export type GeoWatchHandle = {
  clear: () => void
}

export function watchGps(
  onUpdate: (pos: GpsPosition) => void,
  onError: (message: string) => void,
): GeoWatchHandle {
  if (!('geolocation' in navigator)) {
    onError('Geolocation is not supported in this browser.')
    return { clear: () => undefined }
  }

  const id = navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        lng: position.coords.longitude,
        lat: position.coords.latitude,
        accuracy: position.coords.accuracy,
      })
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        onError('Location permission denied. You can still browse the map.')
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        onError('Location unavailable right now.')
      } else if (err.code === err.TIMEOUT) {
        onError('Location request timed out.')
      } else {
        onError(err.message || 'Could not get location.')
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    },
  )

  return {
    clear: () => navigator.geolocation.clearWatch(id),
  }
}
