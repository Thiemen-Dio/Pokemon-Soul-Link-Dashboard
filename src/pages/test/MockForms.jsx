// Mock-up forms for the Test tab. Nothing here is saved.
import { useEffect, useMemo, useState } from 'react'
import { spriteUrl } from '../../api/pokeapi.js'
import { getGames } from '../../api/pokeapiGraphql.js'
import { gameLabel } from '../../api/games.js'
import { PLAYERS } from '../../soullink/rules.js'

const Mon = ({ id }) => (id ? <img className="pixel" src={spriteUrl(id)} alt="" width="48" height="48" loading="lazy" /> : null)

// ---- Death report ----

const CAUSES = ['Boss fight', 'Trainer battle', 'Wild Pokémon', 'Critical hit', 'Poison / burn', 'Self-destruct / recoil', 'Misplay', 'Other']

export function DeathReport({ rows, rosterById, names, gen }) {
  const alive = rows.filter((r) => (r.status === 'team' || r.status === 'box') && r.p1_pokemon_id)
  const options = useMemo(() => Object.values(rosterById).filter((e) => e.generation <= gen), [rosterById, gen])
  const [form, setForm] = useState({ area: alive[0]?.area ?? '', cause: CAUSES[0], killer: '', level: '', where: '', note: '' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  // Run data can arrive after the first render, so fall back to the first living pair.
  const area = form.area || alive[0]?.area
  const row = alive.find((r) => r.area === area)
  if (alive.length === 0) return <p className="status">No living pairs to report on.</p>
  const label = (id) => rosterById[id]?.label ?? `#${id}`
  const pairName = row ? PLAYERS.map((p) => row[`${p}_nickname`] || label(row[`${p}_pokemon_id`])).join(' & ') : ''
  return (
    <div className="mock-form">
      <div className="form-grid">
        <label>Pair<select value={area} onChange={set('area')}>{alive.map((r) => <option key={r.area} value={r.area}>{r.area}</option>)}</select></label>
        <label>Cause<select value={form.cause} onChange={set('cause')}>{CAUSES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Killed by<input list="death-mons" value={form.killer} onChange={set('killer')} placeholder="e.g. Nosepass" /></label>
        <label>Level<input type="number" min="1" max="100" value={form.level} onChange={set('level')} /></label>
        <label>Where<input value={form.where} onChange={set('where')} placeholder="e.g. Rustboro Gym" /></label>
        <label className="wide">Last words<input value={form.note} onChange={set('note')} placeholder="A line for the graveyard" /></label>
      </div>
      <datalist id="death-mons">{options.map((e) => <option key={e.id} value={e.label} />)}</datalist>
      <ul className="graves preview">
        <li>
          <span className="grave-mons">{row && <><Mon id={row.p1_pokemon_id} /><Mon id={row.p2_pokemon_id} /></>}</span>
          <strong>{pairName}</strong>
          <span className="status small-print">{form.cause}{form.killer && ` · ${form.killer}`}{form.level && ` · Lv ${form.level}`}</span>
          <span className="status small-print">{form.where || row?.area}</span>
          {form.note && <em className="small-print">“{form.note}”</em>}
          <span className="status small-print">{names.p1} & {names.p2}</span>
        </li>
      </ul>
      <p className="status small-print">Mock-up: nothing is saved. Saving would need new columns (cause, killer, level) next to the existing died_at.</p>
    </div>
  )
}

// ---- New run setup ----

export function RunSetup() {
  const [games, setGames] = useState([])
  useEffect(() => { getGames().then(setGames).catch(() => setGames([])) }, [])
  const [f, setF] = useState({ name: '', game: 'black-white', randomized: false, p1: 'Thiemen', p2: 'Finn', typeRule: 'primary', dupes: true, shiny: true, caps: 'hard', gifts: 'count' })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const game = games.find((g) => g.name === f.game)
  const rules = { no_shared_types: f.typeRule, dupes_clause: f.dupes, shiny_clause: f.shiny, level_caps: f.caps, gifts: f.gifts }
  const preview = { name: f.name || '(name)', base_game: f.game, generation: game?.generation ?? '?', randomized: f.randomized, player1_name: f.p1, player2_name: f.p2, rules }
  return (
    <div className="mock-form">
      <div className="form-grid">
        <label>Run name<input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Platinum Hardcore" /></label>
        <label>Base game<select value={f.game} onChange={(e) => set('game', e.target.value)}>{games.map((g) => <option key={g.id} value={g.name}>{gameLabel(g.name)}</option>)}</select></label>
        <label>Player 1<input value={f.p1} onChange={(e) => set('p1', e.target.value)} /></label>
        <label>Player 2<input value={f.p2} onChange={(e) => set('p2', e.target.value)} /></label>
        <label>Shared types rule<select value={f.typeRule} onChange={(e) => set('typeRule', e.target.value)}>
          <option value="primary">No shared primary types</option>
          <option value="any">No shared types at all</option>
          <option value="off">Off</option>
        </select></label>
        <label>Level caps<select value={f.caps} onChange={(e) => set('caps', e.target.value)}>
          <option value="hard">Hard (never over)</option>
          <option value="soft">Soft (warning only)</option>
          <option value="off">Off</option>
        </select></label>
        <label>Gifts and statics<select value={f.gifts} onChange={(e) => set('gifts', e.target.value)}>
          <option value="count">Count as the area’s encounter</option>
          <option value="free">Free extra</option>
          <option value="banned">Not allowed</option>
        </select></label>
        <fieldset className="toggles">
          <label><input type="checkbox" checked={f.randomized} onChange={(e) => set('randomized', e.target.checked)} /> Randomized</label>
          <label><input type="checkbox" checked={f.dupes} onChange={(e) => set('dupes', e.target.checked)} /> Dupes clause</label>
          <label><input type="checkbox" checked={f.shiny} onChange={(e) => set('shiny', e.target.checked)} /> Shiny clause</label>
        </fieldset>
      </div>
      <pre className="json-preview">{JSON.stringify(preview, null, 2)}</pre>
      <p className="status small-print">Mock-up: nothing is created. Shows what a run would store. “rules” would be a new column, so each run can have its own house rules (right now they are built into the app).</p>
    </div>
  )
}
