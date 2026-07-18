import { MARKER_ICON_PATHS, markerKindMeta } from '../lib/markerKinds'

type MarkerKindIconProps = {
  kind: string
  size?: number
  className?: string
}

export function MarkerKindIcon({ kind, size = 20, className }: MarkerKindIconProps) {
  const resolved = markerKindMeta(kind).kind
  return (
    <svg
      className={className ?? 'marker-kind-svg'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: MARKER_ICON_PATHS[resolved] ?? MARKER_ICON_PATHS.hazard,
      }}
    />
  )
}
