// Test Pokédex: always-open chip pickers for generation and type, with a multi-pick switch.
// Generations: region colour (from that region's games) + the three starters as crisp sprites.
// Types: type colour + symbol. Double-tap a type to make it the primary (must be the first type).
import { TYPE_COLORS, displayName, spriteUrl } from '../../../api/pokeapi.js'
import { STARTERS } from '../../../components/starters.js'
import { TypeIcon } from '../../../components/typeIcons.jsx'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']

// One colour per region, taken from its games (Red, Gold, Emerald, Diamond, Black, X, Sun, Sword, Scarlet).
const GENS = [
  { id: 1, region: 'Kanto', color: '#d9412b' },
  { id: 2, region: 'Johto', color: '#b8901c' },
  { id: 3, region: 'Hoenn', color: '#1f9e6e' },
  { id: 4, region: 'Sinnoh', color: '#5b6fc0' },
  { id: 5, region: 'Unova', color: '#3b3f47' },
  { id: 6, region: 'Kalos', color: '#2b6cc4' },
  { id: 7, region: 'Alola', color: '#e8801f' },
  { id: 8, region: 'Galar', color: '#1f9cc9' },
  { id: 9, region: 'Paldea', color: '#c8323b' },
]

/** Next selection after a click: single mode picks only this one (or clears it), multi toggles it. */
function toggle(list, id, multi) {
  if (multi) return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  return list.length === 1 && list[0] === id ? [] : [id]
}

function MultiSwitch({ on, onChange, what }) {
  return (
    <label className="multi-switch" title={`Pick more than one ${what}`}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      Multi-pick
    </label>
  )
}

/** value: [] (all) or [1, 3, …]. */
export function GenerationChips({ value, onChange, multi, onMulti }) {
  return (
    <div className="chip-picker">
      <span className="chip-title">Generation</span>
      <div className="chip-grid gen-chips" role="group" aria-label="Generation">
        <button type="button" className="chip all" aria-pressed={value.length === 0} onClick={() => onChange([])}>All</button>
        {GENS.map((g) => (
          <button key={g.id} type="button" className="chip gen-chip" style={{ '--chip': g.color }}
            aria-pressed={value.includes(g.id)} onClick={() => onChange(toggle(value, g.id, multi))}>
            <span className="gen-sprites">
              {STARTERS[g.id].map((id) => <img key={id} src={spriteUrl(id)} alt="" width="40" height="40" loading="lazy" />)}
            </span>
            <span className="gen-text"><strong>Gen {ROMAN[g.id]}</strong><small>{g.region}</small></span>
          </button>
        ))}
      </div>
      <MultiSwitch on={multi} onChange={onMulti} what="generation" />
    </div>
  )
}

/** value: { types: [] (all) or ['fire', …], primary: 'flying' | null }. */
export function TypeChips({ value, onChange, multi, onMulti }) {
  const { types, primary } = value
  const click = (t) => {
    const next = toggle(types, t, multi)
    onChange({ types: next, primary: next.includes(primary) ? primary : null })
  }
  // Double-tap: this type becomes the primary and the only pick (double-tap again: back to a normal pick).
  const doubleTap = (t) => onChange({ types: [t], primary: primary === t ? null : t })
  return (
    <div className="chip-picker">
      <span className="chip-title">Type</span>
      <div className="chip-grid type-chips" role="group" aria-label="Type">
        <button type="button" className="chip all" aria-pressed={types.length === 0} onClick={() => onChange({ types: [], primary: null })}>All</button>
        {Object.keys(TYPE_COLORS).map((t) => (
          <button key={t} type="button" style={{ '--chip': TYPE_COLORS[t] }}
            className={primary === t ? 'chip type-chip primary' : 'chip type-chip'}
            aria-pressed={types.includes(t)} onClick={() => click(t)} onDoubleClick={() => doubleTap(t)}
            title={primary === t ? `${displayName(t)} is the primary: it must be the first type. Double-tap to undo.` : 'Double-tap: must be the first type'}>
            <TypeIcon type={t} className="chip-icon" />
            {displayName(t)}
            {primary === t && <span className="primary-tag">1st</span>}
          </button>
        ))}
      </div>
      <MultiSwitch on={multi} onChange={onMulti} what="type" />
    </div>
  )
}

/** Does a Pokémon with these types (in slot order) pass the type filter? */
export function typeFilterMatches(pTypes = [], { types, primary }) {
  if (primary && pTypes[0] !== primary) return false
  const others = types.filter((t) => t !== primary)
  return others.length === 0 || pTypes.some((t) => others.includes(t))
}
