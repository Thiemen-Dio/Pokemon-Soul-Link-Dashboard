// Settings for one run: who you are on this device, which generation the Pokémon and moves follow,
// nicknames, boss info, and the randomizer log. Shared settings are saved on the run (runs.rules).
import { useEffect, useRef, useState } from 'react'
import { updateRun } from '../../../api/soullink.js'
import { PLAYERS } from '../../../soullink/rules.js'
import { logSetsFor, parseLogEvolutions, parseRandomizerLog, readMe, runSettings, writeMe } from './data.js'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** Generation selects shared with "New run": Pokémon data and move data. */
export function GenFields({ monGen, movesGen, onChange }) {
  return (
    <>
      <label title="Typing, learnsets and abilities">Pokémon follow<select value={monGen} onChange={(e) => onChange({ monGen: Number(e.target.value) })}>
        {GENS.map((g) => <option key={g} value={g}>Gen {ROMAN[g]}</option>)}
      </select></label>
      <label title="Power, type and accuracy">Moves follow<select value={movesGen} onChange={(e) => onChange({ movesGen: Number(e.target.value) })}>
        {GENS.map((g) => <option key={g} value={g}>Gen {ROMAN[g]}</option>)}
      </select></label>
    </>
  )
}

/** Read a randomizer log file into { file, sets, evos }, or throw with a readable reason. */
export async function readLogFile(file) {
  const text = await file.text()
  const sets = parseRandomizerLog(text)
  if (sets.length === 0) throw new Error('No “--Wild Pokemon--” section in this file. Is it a Universal Pokémon Randomizer ZX log, with wild Pokémon randomized?')
  return { file: file.name, sets, evos: parseLogEvolutions(text) }
}

export default function RunSettings({ run, rows, log, setLog, onRunChange, onClose, me, setMe }) {
  const ref = useRef(null)
  const s = runSettings(run)
  const [f, setF] = useState(s)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (changes) => setF((x) => ({ ...x, ...changes }))
  useEffect(() => { ref.current?.showModal() }, [])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const rules = { ...(run.rules ?? {}), pokemon_gen: f.monGen, moves_gen: f.movesGen, separate_nicknames: !f.sharedNames, hide_bosses: !f.bosses }
    try {
      onRunChange(await updateRun(run.id, { rules }))
      onClose()
    } catch (err) {
      setBusy(false)
      setError(`Couldn’t save the settings: ${err.message}`)
    }
  }

  async function loadLog(file) {
    try { setLog(await readLogFile(file)); setError('') } catch (err) { setError(err.message) }
  }
  const missing = log ? rows.filter((r) => logSetsFor(r.area, log.sets).length === 0).map((r) => r.area) : []

  return (
    <dialog ref={ref} className="setup-dialog" onCancel={onClose} onClose={onClose}>
      <form onSubmit={save}>
        <header className="setup-head">
          <h3>Settings · {run.name}</h3>
          <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <section className="setup-step">
          <h4>You</h4>
          <div className="form-grid">
            <label>On this device I am<select value={me ?? ''} onChange={(e) => { writeMe(run.id, e.target.value || null); setMe(e.target.value || null) }}>
              <option value="">Not set (edit both players)</option>
              {PLAYERS.map((p) => <option key={p} value={p}>{run[p === 'p1' ? 'player1_name' : 'player2_name']}</option>)}
            </select></label>
          </div>
          <p className="status small-print">You fill in your own catches; your partner’s show up when they save theirs. Remembered on this device only, saved straight away.</p>
        </section>

        <section className="setup-step">
          <h4>Generations</h4>
          <div className="form-grid">
            <label>Game played (type chart)<input value={`Gen ${ROMAN[run.generation]}`} disabled /></label>
            <GenFields monGen={f.monGen} movesGen={f.movesGen} onChange={set} />
          </div>
          <p className="status small-print">Pokémon: typing, learnsets, abilities. Moves: power, type, accuracy. A randomizer can update either to a newer generation (Leech Life: 20 power before Gen VII, 80 after). Match what you picked there.</p>
        </section>

        <section className="setup-step">
          <h4>Names and surprises</h4>
          <fieldset className="toggles">
            <label><input type="checkbox" checked={!f.sharedNames} onChange={(e) => set({ sharedNames: !e.target.checked })} /> Give each Pokémon its own nickname (off: one name per linked pair)</label>
            <label><input type="checkbox" checked={f.bosses} onChange={(e) => set({ bosses: e.target.checked })} /> Show the bosses ahead (names, types, Boss prep). Off for surprise runs.</label>
          </fieldset>
        </section>

        <section className="setup-step">
          <h4>Randomizer log</h4>
          <div className="toolbar">
            <input type="file" accept=".log,.txt" aria-label="Randomizer log file" onChange={(e) => e.target.files[0] && loadLog(e.target.files[0])} />
            {log && <button type="button" className="chip-button" onClick={() => setLog(null)}>Remove log</button>}
          </div>
          {log && (
            <p className="status small-print">
              {log.file}: {log.sets.length} encounter sets, {rows.length - missing.length} of {rows.length} areas matched
              {log.evos?.length ? `, ${log.evos.length} changed evolutions` : ''}.
              {missing.length > 0 && ` No match (gifts, starters or different names): ${missing.join(', ')}.`}
            </p>
          )}
          <p className="status small-print">The .log from Universal Pokémon Randomizer ZX. It stays on this device (applies straight away), so each player loads their own.</p>
        </section>

        {error && <p className="status error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
        </div>
      </form>
    </dialog>
  )
}
