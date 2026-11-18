import { GENERATIONS, TYPE_COLORS, artworkUrl, displayName } from '../api/pokeapi.js'
import BlockPicker from './BlockPicker.jsx'
import { STARTERS } from './starters.js'
import { TypeIcon } from './typeIcons.jsx'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']

// Both pickers share these sizes, so they are exactly the same size (3 rows each,
// with the same narrow "All" column on the left). Two side by side fit the page width.
const SIZES = { width: '31.5rem', blockHeight: '2.6rem' }

/** The centred row that holds the pickers. */
export function PickerRow({ children }) {
  return <div className="picker-row">{children}</div>
}

// ---- generation picker ----

function Starters({ gen }) {
  return (
    <span className="gen-bg starters">
      {STARTERS[gen].map((id) => <img key={id} src={artworkUrl(id)} alt="" loading="lazy" />)}
    </span>
  )
}

// Fixed "random" numbers (same on every render), for a slightly messy, propped-up look.
const jitter = (i, salt) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x) // 0..1
}

/** All 27 starters piled together: one column per generation, grass / fire / water rows. */
function AllStarters() {
  return (
    <span className="gen-bg all-starters">
      {Object.entries(STARTERS).flatMap(([gen, ids]) =>
        ids.map((id, row) => {
          const i = (gen - 1) * 3 + row
          return (
            <img
              key={id}
              src={artworkUrl(id)}
              alt=""
              loading="lazy"
              style={{
                gridColumn: Number(gen),
                gridRow: row + 1,
                transform: `rotate(${(jitter(i, 1) - 0.5) * 24}deg) translate(${(jitter(i, 2) - 0.5) * 30}%, ${(jitter(i, 3) - 0.5) * 20}%)`,
              }}
            />
          )
        }),
      )}
    </span>
  )
}

/** Mix a #rrggbb colour with white: amount 0 = unchanged, 1 = white. Returns #rrggbb. */
function pastel(hex, amount = 0.35) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (v) => Math.round(v + (255 - v) * amount)
  const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)]
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// One stripe per type: a slightly darkened pastel stripe with the plain pastel symbol.
const STRIPES = Object.keys(TYPE_COLORS).map((t) => {
  const soft = pastel(TYPE_COLORS[t])
  return { t, soft, deep: `color-mix(in srgb, ${soft} 72%, black)` }
})

/** "All types" chosen: the 18 tilted type stripes (two rows of 9) slide slowly left to right.
    Three identical copies side by side, so the loop is seamless. */
function TypeStripes() {
  return (
    <span className="all-stripes" aria-hidden="true">
      <span className="stripes-track">
        {[0, 1, 2].map((copy) => (
          <span key={copy} className="stripes-set">
            {STRIPES.map(({ t, soft, deep }) => (
              <span key={t} className="stripe" style={{ background: deep, color: soft }}>
                <TypeIcon type={t} className="stripe-icon" />
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  )
}

const GEN_OPTIONS = GENERATIONS.filter((g) => g.id !== 'all').map((g) => {
  const [, region] = g.label.split(' · ')
  return { id: g.id, label: g.label, short: ROMAN[g.id], name: `Gen ${ROMAN[g.id]}`, region }
})

/** Generation picker: value 'all' or 1–9. allLabel/labelFor tweak the wording per page. */
export function GenerationPicker({ value, onChange, title = 'Generation', allLabel = 'All generations', labelFor }) {
  const options = labelFor ? GEN_OPTIONS.map((o) => ({ ...o, label: labelFor(o) })) : GEN_OPTIONS
  const all = { id: 'all', label: allLabel }

  const block = (o, { current }) => {
    if (o === all) {
      // Chosen "all" (big block): every starter piled together behind the text.
      if (current)
        return {
          className: 'gen-block all',
          children: (
            <>
              <AllStarters />
              <span className="gen-name">{allLabel}</span>
            </>
          ),
        }
      return { className: 'gen-block all', children: <span className="gen-name">All</span> }
    }
    return {
      className: 'gen-block',
      children: (
        <>
          <Starters gen={o.id} />
          <span className="gen-name">{o.name}</span>
          <span className="gen-region">{o.region}</span>
        </>
      ),
    }
  }

  return (
    <BlockPicker
      title={title}
      options={options}
      all={all}
      value={value}
      onChange={onChange}
      block={block}
      columns={3}
      narrowColumns={3}
      {...SIZES}
    />
  )
}

// ---- type picker ----

// Standard in-game type order (Normal, Fire, Water, …), like the familiar type chart.
const TYPE_OPTIONS = Object.keys(TYPE_COLORS).map((t) => ({ id: t, label: displayName(t) }))

/** Type picker: value '' (all types) or a type name like 'fire'. */
export function TypePicker({ value, onChange, title = 'Type' }) {
  const all = { id: '', label: 'All types' }

  const block = (o, { current }) => {
    if (o === all) {
      // Chosen "all" (big block): every type as a tilted stripe, slowly sliding right, label on top.
      if (current)
        return {
          className: 'all all-types-stripes',
          children: (
            <>
              <TypeStripes />
              <span className="all-label">All types</span>
            </>
          ),
        }
      return { className: 'all', children: 'All' }
    }
    // Options while choosing: name only. The chosen type (big block): symbol + name.
    if (current) {
      return {
        className: 'with-icon',
        style: { '--block': TYPE_COLORS[o.id] },
        children: (
          <>
            <TypeIcon type={o.id} />
            <span>{o.label}</span>
          </>
        ),
      }
    }
    return { className: 'type-opt', style: { '--block': TYPE_COLORS[o.id] }, children: o.label }
  }

  return (
    <BlockPicker
      title={title}
      options={TYPE_OPTIONS}
      all={all}
      value={value}
      onChange={onChange}
      block={block}
      columns={6}
      narrowColumns={3}
      {...SIZES}
    />
  )
}
