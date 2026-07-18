import type { TrailMarkerKind } from '../types'

export type MarkerKindMeta = {
  kind: TrailMarkerKind
  label: string
  shortLabel: string
}

export const MARKER_KINDS: MarkerKindMeta[] = [
  { kind: 'hazard', label: 'Hazard', shortLabel: 'Hazard' },
  { kind: 'downed-tree', label: 'Downed Tree', shortLabel: 'Downed Tree' },
  { kind: 'puddle', label: 'Puddle', shortLabel: 'Puddle' },
  { kind: 'clogged-culvert', label: 'Clogged Culvert', shortLabel: 'Culvert' },
  { kind: 'washout', label: 'Washout', shortLabel: 'Washout' },
  { kind: 'maintenance', label: 'Maintenance Needed', shortLabel: 'Maintenance' },
]

export function markerKindMeta(kind: string): MarkerKindMeta {
  return MARKER_KINDS.find((m) => m.kind === kind) ?? MARKER_KINDS[0]!
}

export const MARKER_ICON_PATHS: Record<TrailMarkerKind, string> = {
  hazard: `
    <path d="M12 3.5 L21 19.5 H3 L12 3.5Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
    <path d="M12 10 V14.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    <circle cx="12" cy="17" r="1" fill="currentColor"/>
  `,
  'downed-tree': `
    <path d="M4 17 H20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M6 17 L10 8 L13 14 L16 10 L19 17" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M10 8 L9 5.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
  `,
  puddle: `
    <ellipse cx="12" cy="15" rx="7.5" ry="3.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
    <path d="M7 14.5 C8.5 13 10 12.5 12 12.5 C14 12.5 15.5 13 17 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M9 10 C10 8.5 11 8 12 8 C13 8 14 8.5 15 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  `,
  'clogged-culvert': `
    <path d="M3 10 H9 V16 H3 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
    <path d="M15 10 H21 V16 H15 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
    <path d="M9 11.5 H15 M9 14.5 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="12" cy="13" r="2.2" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M11 12 L13 14 M13 12 L11 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  `,
  washout: `
    <path d="M3 18 H21" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M4 18 L8 10 L11 15 L14 8 L17 13 L20 18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M9 18 V15 M15 18 V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  maintenance: `
    <path d="M14.5 5.5 A4.2 4.2 0 0 0 9.8 10.2 L4.5 15.5 L6.5 17.5 L11.8 12.2 A4.2 4.2 0 0 0 16.5 7.5 L14.5 5.5Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
    <path d="M15.2 6.2 L17.8 8.8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    <circle cx="15.8" cy="7.5" r="0.9" fill="currentColor"/>
  `,
}

/** Inline SVG markup for map popups (non-React). */
export function markerKindIconSvg(kind: string, size = 18): string {
  const resolved = markerKindMeta(kind).kind
  const paths = MARKER_ICON_PATHS[resolved] ?? MARKER_ICON_PATHS.hazard
  return `<svg class="marker-kind-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${paths}</svg>`
}
