// Test: "my box", styled like the in-game PC. Only one player's Pokémon, as small box icons in 6×5 boxes.
// Pointing at one shows it and its linked partner in the side panel; clicking it opens both full cards.
import { useState } from 'react'
import { spriteUrl } from '../../api/pokeapi.js'
import { rosterTypesInGeneration } from '../../api/pokeapiGraphql.js'
import { PLAYERS } from '../../soullink/rules.js'
import MonCard from './MonCard.jsx'
import TypeBadge from './TypeBadge.jsx'

const VERSIONS = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions'
const BOX_SIZE = 30
const STATUS_TEXT = { team: 'In the party', box: 'In the PC', dead: 'Fainted', failed: 'Failed', pending: 'Waiting for partner' }

/** Small Gen 7 box icon (40×30, up to #809 and Alolan forms); falls back to the normal sprite. */
function BoxIcon({ id }) {
  return <img className="box-icon" src={`${VERSIONS}/generation-vii/icons/${id}.png`} alt="" width="40" height="30" loading="lazy"
    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = spriteUrl(id); e.currentTarget.className = 'box-icon fallback' }} />
}
/** Black/White pixel sprite for the side panel; falls back to the normal sprite. */
function PanelSprite({ id, small }) {
  return <img className={small ? 'panel-sprite small' : 'panel-sprite'} src={`${VERSIONS}/generation-v/black-white/${id}.png`} alt="" width="96" height="96"
    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = spriteUrl(id) }} />
}

/** 30 per box: "Box 1, Box 2…" (or "Graveyard 1, 2…"), always at least one. */
const pages = (list, name, extra) => {
  const out = []
  for (let i = 0; i === 0 || i < list.length; i += BOX_SIZE) out.push({ name: list.length > BOX_SIZE || name === 'Box' ? `${name} ${i / BOX_SIZE + 1}` : name, slots: BOX_SIZE, rows: list.slice(i, i + BOX_SIZE), ...extra })
  return out
}
/** The three views: the PC boxes (PC and waiting), the party (team) and the graveyard (dead and failed). */
function makeViews(rows, me) {
  const mine = rows.filter((r) => r[`${me}_pokemon_id`])
  return {
    box: pages(mine.filter((r) => r.status === 'box' || r.status === 'pending'), 'Box'),
    party: [{ name: 'Party', slots: 6, rows: mine.filter((r) => r.status === 'team') }],
    grave: pages(mine.filter((r) => r.status === 'dead' || r.status === 'failed'), 'Graveyard', { grave: true }),
  }
}

const Pokeball = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <circle cx="12" cy="12" r="10.5" fill="#fff" stroke="#1c2335" strokeWidth="1.8" />
    <path d="M1.5 12a10.5 10.5 0 0 1 21 0z" fill="#e03131" stroke="#1c2335" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3.2" fill="#fff" stroke="#1c2335" strokeWidth="1.8" />
  </svg>
)
const Grave = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M6 21V9a6 6 0 0 1 12 0v12z" fill="#ced4da" stroke="#1c2335" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9v6M9.5 11.5h5" stroke="#1c2335" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M3 21h18" stroke="#1c2335" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

export default function PcBox({ run, rows, rosterById, names, chart, onSave }) {
  const [me, setMeState] = useState(() => { try { return localStorage.getItem('test-box-player') ?? 'p1' } catch { return 'p1' } })
  const setMe = (p) => { setMeState(p); setPicked(null); try { localStorage.setItem('test-box-player', p) } catch { /* not remembered */ } }
  const partner = me === 'p1' ? 'p2' : 'p1'
  const [view, setView] = useState('box') // box | party | grave
  const [boxAt, setBoxAt] = useState(0)
  const [hover, setHover] = useState(null) // area
  const [picked, setPicked] = useState(null) // area: clicked, its two cards are open below

  const boxes = makeViews(rows, me)[view]
  const box = boxes[Math.min(boxAt, boxes.length - 1)]
  const go = (step) => { setBoxAt((boxAt + step + boxes.length) % boxes.length); setHover(null) }
  // The Pokéball and grave buttons switch to that view; pressing it again goes back to the boxes.
  const show = (v) => { setView(view === v ? 'box' : v); setBoxAt(0); setHover(null) }
  const shown = rows.find((r) => r.area === (hover ?? picked))
  const sel = rows.find((r) => r.area === picked)
  const nameOf = (r, p) => r[`${p}_nickname`] || rosterById[r[`${p}_pokemon_id`]]?.label || '—'
  const speciesOf = (r, p) => rosterById[r[`${p}_pokemon_id`]]?.label ?? ''
  const typesOf = (r, p) => { const e = rosterById[r[`${p}_pokemon_id`]]; return e ? rosterTypesInGeneration(e, run.generation) : [] }

  return (
    <>
      <div className="tabs" role="group" aria-label="Whose box">
        {PLAYERS.map((p) => <button key={p} type="button" aria-pressed={me === p} onClick={() => setMe(p)}>{names[p]}’s box</button>)}
      </div>

      <div className="pc">
        <aside className="pc-panel" aria-live="polite">
          {!shown ? <p className="pc-hint">Point at a Pokémon to see it and its partner. Click it for both full cards.</p> : (
            <>
              <PanelSprite id={shown[`${me}_pokemon_id`]} />
              <strong className="pc-name">{nameOf(shown, me)}</strong>
              {shown[`${me}_nickname`] && <span className="pc-species">{speciesOf(shown, me)}</span>}
              <span className="types">{typesOf(shown, me).map((t) => <TypeBadge key={t} type={t} small />)}</span>
              <span className="pc-meta">{shown.area} · {STATUS_TEXT[shown.status] ?? shown.status}</span>
              {(
                <div className="pc-link">
                  <span className="pc-link-label">Soul linked with {names[partner]}’s</span>
                  {shown[`${partner}_pokemon_id`] ? (
                    <div className="pc-partner">
                      <PanelSprite id={shown[`${partner}_pokemon_id`]} small />
                      <div>
                        <strong>{nameOf(shown, partner)}</strong>
                        <span className="types">{typesOf(shown, partner).map((t) => <TypeBadge key={t} type={t} small />)}</span>
                      </div>
                    </div>
                  ) : <span className="pc-hint">Nothing caught yet.</span>}
                </div>
              )}
            </>
          )}
        </aside>

        <div className={box.grave ? 'pc-box-game grave' : 'pc-box-game'}>
          <div className="pc-top">
            <div className="pc-head">
              <button type="button" onClick={() => go(-1)} disabled={boxes.length < 2} aria-label="Previous box">◀</button>
              <strong>{box.name}</strong>
              <span className="pc-count">{box.rows.length}/{box.slots}</span>
              <button type="button" onClick={() => go(1)} disabled={boxes.length < 2} aria-label="Next box">▶</button>
            </div>
            <button type="button" className="pc-view" aria-pressed={view === 'party'} onClick={() => show('party')} title="Current team">
              <Pokeball />
            </button>
            <button type="button" className="pc-view" aria-pressed={view === 'grave'} onClick={() => show('grave')} title="Graveyard: dead and failed">
              <Grave />
            </button>
          </div>
          <ul className={box.slots === 6 ? 'pc-grid party' : 'pc-grid'}>{/* every box has the same size */}
            {Array.from({ length: box.slots }, (_, i) => {
              const r = box.rows[i]
              if (!r) return <li key={`empty-${i}`} className="pc-slot empty" />
              return (
                <li key={r.area} className={`pc-slot s-${r.status}${picked === r.area ? ' picked' : ''}`}>
                  <button type="button" onMouseEnter={() => setHover(r.area)} onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(r.area)} onBlur={() => setHover(null)}
                    onClick={() => setPicked(picked === r.area ? null : r.area)}
                    aria-pressed={picked === r.area} title={`${nameOf(r, me)} · ${r.area}`}>
                    <BoxIcon id={r[`${me}_pokemon_id`]} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {sel && (
        <div className="pair-cards">
          {[me, partner].map((p) => (
            <MonCard key={p} run={run} chart={chart} row={sel} player={p} names={names} rosterById={rosterById} onSave={onSave} picked={p === me} />
          ))}
        </div>
      )}
    </>
  )
}
