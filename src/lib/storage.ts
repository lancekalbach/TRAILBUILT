import type { TrailMarker, TrailTrack } from '../types'

const DB_NAME = 'trailbuilt'
const DB_VERSION = 3
const TRACKS = 'tracks'
const MARKERS = 'markers'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(TRACKS)) {
        db.createObjectStore(TRACKS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(MARKERS)) {
        db.createObjectStore(MARKERS, { keyPath: 'id' })
      }
    }
  })
}

function getAll<T>(storeName: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req = store.getAll()
        req.onerror = () => reject(req.error ?? new Error(`Failed to load ${storeName}`))
        req.onsuccess = () => resolve(req.result as T[])
      }),
  )
}

function put<T>(storeName: string, value: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.put(value)
        req.onerror = () => reject(req.error ?? new Error(`Failed to save ${storeName}`))
        req.onsuccess = () => resolve()
      }),
  )
}

function remove(storeName: string, id: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.delete(id)
        req.onerror = () => reject(req.error ?? new Error(`Failed to delete from ${storeName}`))
        req.onsuccess = () => resolve()
      }),
  )
}

export async function loadTracks(): Promise<TrailTrack[]> {
  const list = await getAll<TrailTrack>(TRACKS)
  return list.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveTrack(track: TrailTrack): Promise<void> {
  await put(TRACKS, track)
}

export async function deleteTrack(id: string): Promise<void> {
  await remove(TRACKS, id)
}

export async function loadMarkers(): Promise<TrailMarker[]> {
  const list = await getAll<TrailMarker>(MARKERS)
  return list.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveMarker(marker: TrailMarker): Promise<void> {
  await put(MARKERS, marker)
}

export async function updateMarker(marker: TrailMarker): Promise<void> {
  await put(MARKERS, marker)
}

export async function deleteMarker(id: string): Promise<void> {
  await remove(MARKERS, id)
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsText(file)
  })
}
