import type { GpsPosition } from '../types'

export type GeoWatchHandle = {
  clear: () => void
}

/** Min time between React-facing GPS updates (ms). */
const MIN_UPDATE_INTERVAL_MS = 1000

/** Ignore fixes closer than this to the last published position (meters). */
const MIN_MOVE_METERS = 4

function haversineMeters(a: GpsPosition, b: GpsPosition): number {
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLng = (b.lng - a.lng) * toRad
  const lat1 = a.lat * toRad
  const lat2 = b.lat * toRad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function watchGps(
  onUpdate: (pos: GpsPosition) => void,
  onError: (message: string) => void,
): GeoWatchHandle {
  if (!('geolocation' in navigator)) {
    onError('Geolocation is not supported in this browser.')
    return { clear: () => undefined }
  }

  let lastPublished: GpsPosition | null = null
  let lastPublishedAt = 0
  let pending: GpsPosition | null = null
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  const publish = (pos: GpsPosition) => {
    lastPublished = pos
    lastPublishedAt = Date.now()
    pending = null
    onUpdate(pos)
  }

  const scheduleFlush = () => {
    if (flushTimer != null || !pending) return
    const wait = Math.max(0, MIN_UPDATE_INTERVAL_MS - (Date.now() - lastPublishedAt))
    flushTimer = setTimeout(() => {
      flushTimer = null
      if (pending) publish(pending)
    }, wait)
  }

  const id = navigator.geolocation.watchPosition(
    (position) => {
      const next: GpsPosition = {
        lng: position.coords.longitude,
        lat: position.coords.latitude,
        accuracy: position.coords.accuracy,
      }

      if (lastPublished) {
        const moved = haversineMeters(lastPublished, next)
        const accuracyDelta = Math.abs((next.accuracy ?? 0) - (lastPublished.accuracy ?? 0))
        if (moved < MIN_MOVE_METERS && accuracyDelta < 10) return
      }

      const now = Date.now()
      if (!lastPublished || now - lastPublishedAt >= MIN_UPDATE_INTERVAL_MS) {
        publish(next)
        return
      }

      pending = next
      scheduleFlush()
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
    clear: () => {
      if (flushTimer != null) clearTimeout(flushTimer)
      navigator.geolocation.clearWatch(id)
    },
  }
}
