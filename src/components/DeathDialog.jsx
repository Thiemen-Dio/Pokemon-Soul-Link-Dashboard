// Pop-up when a pair's status is set to Dead: how it happened, saved in died_at.
import { useEffect, useRef, useState } from 'react'
import { spriteUrl } from '../api/pokeapi.js'
import { PLAYERS } from '../soullink/rules.js'

const CAUSES = ['Boss fight', 'Trainer battle', 'Wild Pokémon', 'Critical hit', 'Poison / burn', 'Self-destruct / recoil', 'Misplay', 'Other']

/** One line for the graveyard, e.g. "Boss fight · Nosepass Lv 15 · Rustboro Gym · “Should have switched”". */
export function deathText({ cause, killer, level, where, note }) {
  const by = [killer.trim(), level && `Lv ${level}`].filter(Boolean).join(' ')
  return [cause, by, where.trim(), note.trim() && `“${note.trim()}”`].filter(Boolean).join(' · ')
}

export default function DeathDialog({ row, names, rosterById, options, onSave, onClose }) {
  const ref = useRef(null)
  const [form, setForm] = useState({ cause: CAUSES[0], killer: '', level: '', where: '', note: '' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  useEffect(() => { ref.current?.showModal() }, [])
  const pair = PLAYERS.map((p) => row[`${p}_nickname`] || rosterById[row[`${p}_pokemon_id`]]?.label || '?').join(' & ')

  return (
    // Esc (the dialog's cancel event) closes without changing the status.
    <dialog ref={ref} className="death-dialog" onCancel={onClose} onClose={onClose}>
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); onSave(deathText(form)) }}>
        <div className="death-head">
          <span className="grave-mons">
            {PLAYERS.map((p) => row[`${p}_pokemon_id`] && <img key={p} className="pixel" src={spriteUrl(row[`${p}_pokemon_id`])} alt="" width="56" height="56" />)}
          </span>
          <div>
            <h3>{pair} fell</h3>
            <p className="status small-print">{row.area} · {names.p1} & {names.p2}. Both go to the graveyard.</p>
          </div>
        </div>
        <div className="form-grid">
          <label>Cause<select value={form.cause} onChange={set('cause')}>{CAUSES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Killed by<input list="death-killers" value={form.killer} onChange={set('killer')} placeholder="e.g. Nosepass" /></label>
          <label>Level<input type="number" min="1" max="100" value={form.level} onChange={set('level')} /></label>
          <label>Where<input value={form.where} onChange={set('where')} placeholder="e.g. Rustboro Gym" /></label>
          <label className="wide">Last words<input value={form.note} onChange={set('note')} placeholder="A line for the graveyard" /></label>
        </div>
        <datalist id="death-killers">{options.map((e) => <option key={e.id} value={e.label} />)}</datalist>
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={onClose}>Cancel</button>
          <button type="button" className="chip-button" onClick={() => onSave(null)}>Mark dead, no details</button>
          <button type="submit" className="primary-button">Save to graveyard</button>
        </div>
      </form>
    </dialog>
  )
}
