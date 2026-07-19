/** Squared distance from point p to segment a→b (lng/lat as cartesian for display simplify). */
function distToSegmentSq(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const [px, py] = p
  const [ax, ay] = a
  const [bx, by] = b
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) {
    const ex = px - ax
    const ey = py - ay
    return ex * ex + ey * ey
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  const ex = px - (ax + t * dx)
  const ey = py - (ay + t * dy)
  return ex * ex + ey * ey
}

/**
 * Douglas–Peucker polyline simplify in lng/lat degrees.
 * Keeps endpoints; tolerance ~0.00005 ≈ 5–6 m near Priest Ridge.
 */
export function simplifyLine(
  coords: Array<[number, number]>,
  toleranceDegrees: number,
): Array<[number, number]> {
  if (coords.length <= 2 || toleranceDegrees <= 0) return coords

  const tolSq = toleranceDegrees * toleranceDegrees
  const keep = new Uint8Array(coords.length)
  keep[0] = 1
  keep[coords.length - 1] = 1

  const stack: Array<[number, number]> = [[0, coords.length - 1]]

  while (stack.length > 0) {
    const [start, end] = stack.pop()!
    const a = coords[start]!
    const b = coords[end]!
    let maxDist = 0
    let maxIdx = -1

    for (let i = start + 1; i < end; i++) {
      const d = distToSegmentSq(coords[i]!, a, b)
      if (d > maxDist) {
        maxDist = d
        maxIdx = i
      }
    }

    if (maxIdx >= 0 && maxDist > tolSq) {
      keep[maxIdx] = 1
      if (maxIdx - start > 1) stack.push([start, maxIdx])
      if (end - maxIdx > 1) stack.push([maxIdx, end])
    }
  }

  const out: Array<[number, number]> = []
  for (let i = 0; i < coords.length; i++) {
    if (keep[i]) out.push(coords[i]!)
  }
  return out.length >= 2 ? out : coords
}
