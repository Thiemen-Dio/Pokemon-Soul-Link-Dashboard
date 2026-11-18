// Simple, original symbols for the 18 types (24×24, drawn in the current text colour).
// Used in the type picker's "B" variant.

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

const ICONS = {
  // a plain ring
  normal: <circle cx="12" cy="12" r="7" {...S} strokeWidth="3" />,
  // a flame
  fire: <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" fill="currentColor" />,
  // a drop
  water: <path d="M12 2c3 5 7 9 7 13a7 7 0 0 1-14 0c0-4 4-8 7-13z" fill="currentColor" />,
  // a lightning bolt
  electric: <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" />,
  // a leaf with a vein
  grass: (
    <>
      <path d="M5 19C4 10 10 4 20 4c0 10-6 16-15 15z" fill="currentColor" />
      <path d="M5 19 14 10" {...S} stroke="rgb(0 0 0 / .35)" />
    </>
  ),
  // a snowflake
  ice: (
    <g {...S}>
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" />
      <path d="M9 4l3 2 3-2M9 20l3-2 3 2" />
    </g>
  ),
  // a fist
  fighting: (
    <path
      d="M6 11V8.5a1.5 1.5 0 0 1 3 0V8a1.5 1.5 0 0 1 3 0v.5a1.5 1.5 0 0 1 3 0V9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a5 5 0 0 1-5-5v-2a2 2 0 0 1 2-2h3"
      {...S}
      strokeWidth="2.2"
    />
  ),
  // bubbles
  poison: (
    <>
      <circle cx="9" cy="14" r="5" fill="currentColor" />
      <circle cx="16.5" cy="8" r="3.5" fill="currentColor" />
      <circle cx="17" cy="17" r="2" fill="currentColor" />
    </>
  ),
  // layered ground with a hill
  ground: (
    <>
      <path d="M2 15 8 7l4 5 3-3 7 6z" fill="currentColor" />
      <path d="M3 18h18M5 21h14" {...S} />
    </>
  ),
  // a wing
  flying: <path d="M3 18C6 8 13 4 21 4c-2 3-4 4-6 4.5 2 .5 3 1 4 2-3 1-5 1.5-7 1.5 1 1 2 1.5 3 2-4 2-8 3-12 4z" fill="currentColor" />,
  // an eye
  psychic: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" {...S} />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </>
  ),
  // a beetle
  bug: (
    <>
      <ellipse cx="12" cy="14" rx="5.5" ry="7" fill="currentColor" />
      <path d="M12 8v13M9 4l2 3M15 4l-2 3M5 12l2 1M19 12l-2 1M5 18l2-1M19 18l-2-1" {...S} />
    </>
  ),
  // a boulder
  rock: <path d="M4 17 6 8l6-4 7 3 2 8-5 5H8z" fill="currentColor" />,
  // a ghost
  ghost: (
    <>
      <path d="M5 21V11a7 7 0 0 1 14 0v10l-2.5-2-2.3 2-2.2-2-2.3 2-2.2-2z" fill="currentColor" />
      <circle cx="9.5" cy="11" r="1.4" fill="rgb(0 0 0 / .45)" />
      <circle cx="14.5" cy="11" r="1.4" fill="rgb(0 0 0 / .45)" />
    </>
  ),
  // a fang / claw
  dragon: <path d="M4 4c8 0 15 5 16 16-3-4-6-6-9-6 1 2 1 4 0 6-2-5-5-8-7-10 2 0 3-1 4-2-2-2-3-3-4-4z" fill="currentColor" />,
  // a crescent moon
  dark: <path d="M15 3a9 9 0 1 0 6 15A7 7 0 0 1 15 3z" fill="currentColor" />,
  // a hex nut
  steel: (
    <>
      <path d="M12 2 21 7v10l-9 5-9-5V7z" fill="currentColor" />
      <circle cx="12" cy="12" r="3.5" fill="rgb(0 0 0 / .4)" />
    </>
  ),
  // a sparkle
  fairy: <path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z" fill="currentColor" />,
}

export function TypeIcon({ type, className = 'type-icon' }) {
  const icon = ICONS[type]
  if (!icon) return null
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {icon}
    </svg>
  )
}

export const TYPE_ICON_NAMES = Object.keys(ICONS)
