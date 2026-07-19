/**
 * Priest Ridge / Sandpoint-area trail network (North Idaho).
 * Constraining the camera here prevents world-scale tile loads on mobile.
 */
export const PBR_CENTER: [number, number] = [-116.53, 48.155]

export const PBR_DEFAULT_ZOOM = 13.25

/** Prevent zooming out far enough to pull continental / world tiles. */
export const PBR_MIN_ZOOM = 11

export const PBR_MAX_ZOOM = 18

/**
 * North Idaho panhandle around the PBR network.
 * [SW, NE] as MapLibre LngLatBoundsLike.
 */
export const PBR_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-117.35, 47.55],
  [-115.85, 48.75],
]

export function isInsidePbrRegion(lng: number, lat: number): boolean {
  const [[west, south], [east, north]] = PBR_MAX_BOUNDS
  return lng >= west && lng <= east && lat >= south && lat <= north
}
