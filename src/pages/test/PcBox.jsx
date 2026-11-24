// Test copy of the PC box: every caught pair as linked sprites; click a Pokémon for both partners' cards.
import { useState } from 'react'
import { spriteUrl } from '../../api/pokeapi.js'
import { PLAYERS } from '../../soullink/rules.js'
import MonCard from './MonCard.jsx'


const BOX_FILTERS = { all: ['All', null], alive: ['Alive', ['team', 'box']], team: ['Team', ['team']], box: ['PC', ['box']], dead: ['Dead', ['dead', 'failed']] }

/** Every caught pair as linked sprites, like a PC box. Click a pair for both Pokémon's cards. */
export default function PcBox({ run, rows, rosterById, names, chart, onSave }) {
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null) // { area, player }
  const pairs = rows.filter((r) => (r.p1_pokemon_id || r.p2_pokemon_id) && (!BOX_FILTERS[filter][1] || BOX_FILTERS[filter][1].includes(r.status)))
  const sel = rows.find((r) => r.area === open?.area)
  const label = (r, p) => r[`${p}_nickname`] || rosterById[r[`${p}_pokemon_id`]]?.label || '—'
  return (
    <>
      <div className="tabs encounter-filter" role="group" aria-label="Show pairs">
        {Object.entries(BOX_FILTERS).map(([k, [text]]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{text}</button>)}
      </div>
      {pairs.length === 0 ? <p className="status">Nothing here yet.</p> : (
        <ul className="pc-box">
          {pairs.map((r) => (
            <li key={r.area} className={`s-${r.status}`}>
              <div className={open?.area === r.area ? 'pc-pair open' : 'pc-pair'}>
                {PLAYERS.map((p) => (
                  <button key={p} type="button" onClick={() => setOpen(open?.area === r.area && open.player === p ? null : { area: r.area, player: p })} title={`${label(r, p)} (${names[p]}) · ${r.area}`} aria-pressed={open?.area === r.area && open.player === p}>
                    {r[`${p}_pokemon_id`] ? <img className="pixel" src={spriteUrl(r[`${p}_pokemon_id`])} alt={label(r, p)} width="64" height="64" loading="lazy" /> : <span className="pc-empty">?</span>}
                  </button>
                ))}
              </div>
              <span className="small-print pc-area">{r.area}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="status small-print">Each tile is one linked pair ({names.p1} left, {names.p2} right). Green team, blue PC, red dead, grey failed.</p>
      {sel && (
        <div className="pair-cards">
          {(open.player === 'p1' ? PLAYERS : [...PLAYERS].reverse()).map((p) => (
            <MonCard key={p} run={run} chart={chart} row={sel} player={p} names={names} rosterById={rosterById} onSave={onSave} picked={p === open.player} />
          ))}
        </div>
      )}
    </>
  )
}

