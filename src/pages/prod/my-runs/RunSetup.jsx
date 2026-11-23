// "+ New run": basics, house rules, and randomizer settings, the same groups as the
// Universal Pokémon Randomizer ZX tabs, so you can copy what you picked there.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGames } from '../../../api/pokeapiGraphql.js'
import { gameLabel } from '../../../api/games.js'
import { createRun } from '../../../api/soullink.js'

// [key, label, options]: first option = the randomizer's default ("Unchanged").
const RANDOMIZER = [
  ['wild', 'Wild Pokémon', ['Unchanged', 'Random', 'Area 1-to-1', 'Global 1-to-1']],
  ['wildStrength', 'Wild strength', ['Any', 'Similar strength', 'Catch ’em all']],
  ['starters', 'Starters', ['Unchanged', 'Custom', 'Random', 'Random basic (2 evolutions)']],
  ['statics', 'Static & gift Pokémon', ['Unchanged', 'Swap legendaries', 'Completely random']],
  ['trades', 'In-game trades', ['Unchanged', 'Random given Pokémon', 'Random given & requested']],
  ['trainers', 'Trainers', ['Unchanged', 'Random', 'Type themed', 'Similar strength']],
  ['trainerLevels', 'Trainer levels', ['Unchanged', '+10%', '+25%', '+50%']],
  ['types', 'Pokémon types', ['Unchanged', 'Random (follow evolutions)', 'Completely random']],
  ['stats', 'Base stats', ['Unchanged', 'Shuffle', 'Random (follow evolutions)']],
  ['abilities', 'Abilities', ['Unchanged', 'Random', 'Random, no wonder guard']],
  ['evolutions', 'Evolutions', ['Unchanged', 'Random', 'Random, every level']],
  ['movesets', 'Movesets', ['Unchanged', 'Random (prefer same type)', 'Completely random', 'Metronome only']],
  ['tms', 'TMs & move tutors', ['Unchanged', 'Random']],
  ['items', 'Field items', ['Unchanged', 'Shuffle', 'Random']],
]
const TWEAKS = [
  ['impossibleEvos', 'Change impossible evolutions (trade → level)'],
  ['fastText', 'Fastest text'],
  ['noLegendaries', 'No legendaries in the wild'],
  ['fullyEvolvedTrainers', 'Trainers fully evolved from level 30'],
]

export default function NewRunButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="new-run-button" onClick={() => setOpen(true)}>
        <span className="new-run-plus" aria-hidden="true">+</span>
        <span><strong>New run</strong><span className="status small-print">Game, players, house rules, randomizer</span></span>
      </button>
      {open && <RunSetup onClose={() => setOpen(false)} />}
    </>
  )
}

function RunSetup({ onClose }) {
  const ref = useRef(null)
  const navigate = useNavigate()
  const [games, setGames] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { ref.current?.showModal() }, [])
  useEffect(() => { getGames().then(setGames).catch(() => setGames([])) }, [])
  const [f, setF] = useState({ name: '', game: 'black-white', randomized: false, p1: 'Thiemen', p2: 'Finn', typeRule: 'primary', dupes: true, shiny: true, caps: 'hard', gifts: 'count', seed: '' })
  const [rando, setRando] = useState(() => Object.fromEntries(RANDOMIZER.map(([k, , o]) => [k, o[0]])))
  const [tweaks, setTweaks] = useState({})
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const game = games.find((g) => g.name === f.game)

  async function create(e) {
    e.preventDefault()
    if (!game) return setError('Pick a game first.')
    setBusy(true)
    setError('')
    const rules = {
      no_shared_types: f.typeRule, dupes_clause: f.dupes, shiny_clause: f.shiny, level_caps: f.caps, gifts: f.gifts,
      ...(f.randomized && { randomizer: { ...rando, tweaks: Object.keys(tweaks).filter((k) => tweaks[k]), settings_string: f.seed.trim() || null } }),
    }
    try {
      const run = await createRun({ name: f.name.trim(), base_game: f.game, generation: game.generation, randomized: f.randomized, player1_name: f.p1.trim() || 'Player 1', player2_name: f.p2.trim() || 'Player 2', rules })
      navigate(`/my-runs/${encodeURIComponent(run.name)}`)
    } catch (err) {
      setBusy(false)
      // Before migration 002 the "rules" column doesn't exist yet.
      setError(/rules/.test(err.message) ? 'The database needs its update first (supabase/migrations/002). Nothing was created.' : `Couldn’t create the run: ${err.message}`)
    }
  }

  return (
    <dialog ref={ref} className="setup-dialog" onCancel={onClose} onClose={onClose}>
      <form onSubmit={create}>
        <header className="setup-head">
          <h3>New run</h3>
          <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <section className="setup-step">
          <h4><span className="step-no">1</span> The basics</h4>
          <div className="form-grid">
            <label className="wide">Run name<input required autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Platinum Hardcore" /></label>
            <label>Base game<select value={f.game} onChange={(e) => set('game', e.target.value)}>{games.map((g) => <option key={g.id} value={g.name}>{gameLabel(g.name)}</option>)}</select></label>
            <label>Player 1<input value={f.p1} onChange={(e) => set('p1', e.target.value)} /></label>
            <label>Player 2<input value={f.p2} onChange={(e) => set('p2', e.target.value)} /></label>
          </div>
          <p className="status small-print">{game ? `Gen ${game.generation}: types and Pokémon follow that generation.` : 'Loading games…'}</p>
        </section>

        <section className="setup-step">
          <h4><span className="step-no">2</span> House rules</h4>
          <div className="form-grid">
            <label>Shared types<select value={f.typeRule} onChange={(e) => set('typeRule', e.target.value)}>
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
          </div>
          <fieldset className="toggles">
            <label><input type="checkbox" checked={f.dupes} onChange={(e) => set('dupes', e.target.checked)} /> Dupes clause</label>
            <label><input type="checkbox" checked={f.shiny} onChange={(e) => set('shiny', e.target.checked)} /> Shiny clause</label>
          </fieldset>
        </section>

        <section className="setup-step">
          <h4><span className="step-no">3</span> Randomizer</h4>
          <label className="switch">
            <input type="checkbox" checked={f.randomized} onChange={(e) => set('randomized', e.target.checked)} />
            <span>This run is randomized (Universal Pokémon Randomizer ZX)</span>
          </label>
          {f.randomized && (
            <>
              <div className="form-grid">
                {RANDOMIZER.map(([k, label, options]) => (
                  <label key={k}>{label}<select value={rando[k]} onChange={(e) => setRando((r) => ({ ...r, [k]: e.target.value }))}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>
                ))}
                <label className="wide">Settings string (optional)<input value={f.seed} onChange={(e) => set('seed', e.target.value)} placeholder="Paste from the randomizer: Settings → Copy settings string" /></label>
              </div>
              <fieldset className="toggles">
                {TWEAKS.map(([k, label]) => (
                  <label key={k}><input type="checkbox" checked={!!tweaks[k]} onChange={(e) => setTweaks((t) => ({ ...t, [k]: e.target.checked }))} /> {label}</label>
                ))}
              </fieldset>
            </>
          )}
        </section>

        {error && <p className="status error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy || !f.name.trim()}>{busy ? 'Creating…' : 'Create run'}</button>
        </div>
      </form>
    </dialog>
  )
}
