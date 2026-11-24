// Test: "my box", styled like the in-game PC. Only one player's Pokémon, as small box icons in 6×5 boxes.
// Pointing at one shows it in the side panel; clicking it reveals the linked partner (hidden until then).
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

/** Party (team), then Box 1, Box 2… (PC and waiting), then the Graveyard: like switching boxes in game. */
function makeBoxes(rows, me) {
  const mine = rows.filter((r) => r[`${me}_pokemon_id`])
  const pc = mine.filter((r) => r.status === 'box' || r.status === 'pending')
  const boxes = [{ name: 'Party', slots: 6, rows: mine.filter((r) => r.status === 'team') }]
  for (let i = 0; i === 0 || i < pc.length; i += BOX_SIZE) boxes.push({ name: `Box ${i / BOX_SIZE + 1}`, slots: BOX_SIZE, rows: pc.slice(i, i + BOX_SIZE) })
  const fallen = mine.filter((r) => r.status === 'dead' || r.status === 'failed')
  boxes.push({ name: 'Graveyard', slots: Math.max(BOX_SIZE, fallen.length), rows: fallen, grave: true })
  return boxes
}

export default function PcBox({ run, rows, rosterById, names, chart, onSave }) {
  const [me, setMeState] = useState(() => { try { return localStorage.getItem('test-box-player') ?? 'p1' } catch { return 'p1' } })
  const setMe = (p) => { setMeState(p); setPicked(null); try { localStorage.setItem('test-box-player', p) } catch { /* not remembered */ } }
  const partner = me === 'p1' ? 'p2' : 'p1'
  const [boxAt, setBoxAt] = useState(0)
  const [hover, setHover] = useState(null) // area
  const [picked, setPicked] = useState(null) // area: clicked, so the partner shows
  const [cards, setCards] = useState(false)

  const boxes = makeBoxes(rows, me)
  const box = boxes[Math.min(boxAt, boxes.length - 1)]
  const go = (step) => { setBoxAt((boxAt + step + boxes.length) % boxes.length); setHover(null) }
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
          {!shown ? <p className="pc-hint">Point at a Pokémon to see it. Click it to see who it’s linked to.</p> : (
            <>
              <PanelSprite id={shown[`${me}_pokemon_id`]} />
              <strong className="pc-name">{nameOf(shown, me)}</strong>
              {shown[`${me}_nickname`] && <span className="pc-species">{speciesOf(shown, me)}</span>}
              <span className="types">{typesOf(shown, me).map((t) => <TypeBadge key={t} type={t} small />)}</span>
              <span className="pc-meta">{shown.area} · {STATUS_TEXT[shown.status] ?? shown.status}</span>
              {shown.area === picked && (
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
                  <button type="button" className="chip-button" onClick={() => setCards((c) => !c)}>{cards ? 'Hide cards' : 'Show both cards'}</button>
                </div>
              )}
            </>
          )}
        </aside>

        <div className={box.grave ? 'pc-box-game grave' : 'pc-box-game'}>
          <div className="pc-head">
            <button type="button" onClick={() => go(-1)} aria-label="Previous box">◀</button>
            <strong>{box.name}</strong>
            <span className="pc-count">{box.rows.length}/{box.slots}</span>
            <button type="button" onClick={() => go(1)} aria-label="Next box">▶</button>
          </div>
          <ul className={box.slots === 6 ? 'pc-grid party' : 'pc-grid'}>
            {Array.from({ length: box.slots }, (_, i) => {
              const r = box.rows[i]
              if (!r) return <li key={`empty-${i}`} className="pc-slot empty" />
              return (
                <li key={r.area} className={`pc-slot s-${r.status}${picked === r.area ? ' picked' : ''}`}>
                  <button type="button" onMouseEnter={() => setHover(r.area)} onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(r.area)} onBlur={() => setHover(null)}
                    onClick={() => { setPicked(picked === r.area ? null : r.area); setCards(false) }}
                    aria-pressed={picked === r.area} title={`${nameOf(r, me)} · ${r.area}`}>
                    <BoxIcon id={r[`${me}_pokemon_id`]} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {sel && cards && (
        <div className="pair-cards">
          {[me, partner].map((p) => (
            <MonCard key={p} run={run} chart={chart} row={sel} player={p} names={names} rosterById={rosterById} onSave={onSave} picked={p === me} />
          ))}
        </div>
      )}
    </>
  )
}
