/**
 * The complete icon inventory is docs/03-design.md §3.1. Icons are inline SVG only:
 * no icon library, no icon font, no runtime fetch. Each icon that a shipped screen
 * uses is added here with the designer's path data, verbatim.
 */

export type IconName =
  | 'mountains'
  | 'beach'
  | 'party'
  | 'honeymoon'
  | 'peace'
  | 'culture-food'
  | 'check'
  | 'alert-triangle'
  | 'chevron-right'
  | 'plane'
  | 'bed'
  | 'star'
  | 'copy'

const PATHS: Readonly<Record<IconName, readonly string[]>> = {
  mountains: ['M2 19h20', 'M2.5 19 9 8l4.2 6.8', 'M11 19l5.2-8.4L21.5 19'],
  beach: [
    'M17 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
    'M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
    'M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
  ],
  party: [
    'M3.5 21l4.8-12.6 7.8 7.8L3.5 21z',
    'M9 15l-4.2 1.4',
    'M16 3v2.5',
    'M19.5 6.5H22',
    'M18.2 3.8l1.8-1.8',
  ],
  honeymoon: [
    'M12 20.2S4.8 15.6 4.8 10.6A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.2 2.6c0 5-7.2 9.6-7.2 9.6z',
  ],
  peace: ['M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6 8.6 8.6 0 1 0 20.4 14.6z'],
  'culture-food': ['M3 12h18a9 9 0 0 1-18 0z', 'M4 21h16', 'M9 3c0 2 2 2 2 4', 'M14 3c0 2 2 2 2 4'],
  check: ['M4.5 12.5l5 5 10-11'],
  'alert-triangle': ['M12 3.5 22 20H2L12 3.5z', 'M12 10v4.5', 'M12 17.2v.1'],
  'chevron-right': ['M9 5l7 7-7 7'],
  plane: ['M2.5 13.5l19-7-7 19-3-8.5-9-3.5z'],
  bed: ['M3 18v-9', 'M3 12h18v6', 'M21 18v-3', 'M6.5 9.5h3'],
  star: [
    'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z',
  ],
  copy: ['M9 9h11v11H9z', 'M15 5H4v11h3'],
}

export interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 24, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
