// Small original icons for a move's category: physical (an impact burst), special (rings), status (a half-filled circle).
const ICONS = {
  physical: { bg: '#e2662b', d: <path d="M8 2.5l1.3 3 3.2-1-1.6 2.9 2.6 1.8-3.2.5.3 3.3L8 12.3l-2.6 2.2.3-3.3-3.2-.5L5.1 7.4 3.5 4.5l3.2 1z" fill="#fff" /> },
  special: { bg: '#5d6ad1', d: <g fill="none" stroke="#fff" strokeWidth="1.6"><circle cx="8" cy="8" r="2" /><circle cx="8" cy="8" r="5" /></g> },
  status: { bg: '#8c8f99', d: <><circle cx="8" cy="8" r="5" fill="none" stroke="#fff" strokeWidth="1.6" /><path d="M8 3a5 5 0 0 1 0 10z" fill="#fff" /></> },
}

export default function CategoryIcon({ category, size = 18 }) {
  const icon = ICONS[category]
  if (!icon) return null
  return (
    <svg className="cat-icon" width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={category}>
      <title>{category}</title>
      <rect width="16" height="16" rx="4" fill={icon.bg} />
      {icon.d}
    </svg>
  )
}
