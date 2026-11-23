// The run log: every area of a run as a linked pair, with the Soul Link rules. Used by the dashboard's run page.
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDexNumber, spriteUrl } from '../../../api/pokeapi.js'
import { rosterTypesInGeneration } from '../../../api/pokeapiGraphql.js'
import { deleteEncounter, saveEncounter, updateRun } from '../../../api/soullink.js'
import { gameLabel } from '../../../api/games.js'
import DeathDialog from '../../../components/DeathDialog.jsx'
import TypeLink from '../../../components/TypeLink.jsx'
import {
  PLAYERS,
  STATUSES,
  TEAM_SIZE,
  areaRows,
  emptyEncounter,
  findDupes,
  statusAfterCatch,
  teamClash,
  typeConflicts,
} from '../../../soullink/rules.js'

const RUN_STATUS = { active: 'In progress', won: 'Beaten', lost: 'Lost' }

// "Alive" = on the team or in the PC.
const ENCOUNTER_FILTERS = {
  all: { label: 'All' },
  alive: { label: 'Alive', statuses: ['team', 'box'] },
  box: { label: 'In box', statuses: ['box'] },
  dead: { label: 'Dead', statuses: ['dead'] },
}

/**
 * compact: rows fold to one line, only the next area (or the one clicked) is open,
 * with renderNext(row, save) shown under it. Used by the dashboard run page.
 */
export function Run({ run, encounters, setEncounters, roster, families, onError, onRunChange, compact, renderNext }) {
  const gen = run.generation
  const names = { p1: run.player1_name, p2: run.player2_name }

  // Only Pokémon that existed in this game's generation (no Fairy types in Gen 3/5, etc.).
  const options = useMemo(() => (roster ?? []).filter((e) => e.generation <= gen), [roster, gen])
  const rosterById = useMemo(() => Object.fromEntries((roster ?? []).map((e) => [e.id, e])), [roster])
  const conflicts = useMemo(() => typeConflicts(encounters, rosterById, gen), [encounters, rosterById, gen])
  const rows = useMemo(() => areaRows(run.base_game, encounters), [run.base_game, encounters])

  async function save(row, changes) {
    const merged = { ...row, ...changes }
    const next = { ...changes }
    if (!('status' in changes)) {
      const status = statusAfterCatch(encounters, merged)
      if (status !== row.status || !row.id) next.status = status
    }
    // No shared primary types is a hard rule: a clashing pair can't be on the team.
    let notice = ''
    const clash = teamClash(encounters, { ...merged, status: next.status ?? merged.status }, rosterById, gen)
    if (clash) {
      if (changes.status === 'team') return onError(`${row.area} can’t join the team: it shares ${clash.type} with ${clash.area}. Take that pair off the team first.`)
      next.status = 'box'
      notice = `${row.area} went to the PC: it shares ${clash.type} with ${clash.area} on the team.`
    }
    try {
      const saved = await saveEncounter(run.id, row.area, row.sort_order, next)
      setEncounters((list) => [...list.filter((e) => e.area !== saved.area), saved])
      onError(notice)
    } catch (e) {
      onError(`Couldn’t save ${row.area}: ${e.message}`)
    }
  }

  async function remove(row) {
    try {
      await deleteEncounter(row.id)
      setEncounters((list) => list.filter((e) => e.id !== row.id))
    } catch (e) {
      onError(`Couldn’t remove ${row.area}: ${e.message}`)
    }
  }

  async function setRunStatus(value) {
    try {
      onRunChange(await updateRun(run.id, { status: value }))
    } catch (e) {
      onError(e.message)
    }
  }

  const [filter, setFilter] = useState('all')
  const shown = rows.filter((r) => ENCOUNTER_FILTERS[filter].statuses?.includes(r.status) ?? true)
  const team = rows.filter((r) => r.status === 'team')
  const count = (s) => rows.filter((r) => r.status === s).length
  const conflictCount = Object.keys(conflicts).length
  // null = follow the next area still to catch.
  const [openArea, setOpenArea] = useState(null)
  const current = openArea ?? rows.find((r) => r.status === 'pending')?.area
  const areaRow = (row) => (
    <AreaRow
      key={row.area}
      row={row}
      names={names}
      gen={gen}
      options={options}
      rosterById={rosterById}
      families={families}
      encounters={encounters}
      clash={conflicts[row.id]}
      onSave={save}
      onRemove={remove}
    />
  )

  return (
    <>
      <div className="run-head">
        <div>
          <h3>{run.name}</h3>
          <p className="status">
            Based on {gameLabel(run.base_game)} · Gen {gen} types{run.randomized && ' · Randomized'} ·{' '}
            {names.p1} &amp; {names.p2}
          </p>
        </div>
        <label className="run-status">
          Run
          <select value={run.status} onChange={(e) => setRunStatus(e.target.value)}>
            {Object.entries(RUN_STATUS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <ul className="run-stats">
        <li><strong>{team.length}</strong>/{TEAM_SIZE} on the team</li>
        <li><strong>{count('box')}</strong> in the PC</li>
        <li><strong>{count('dead')}</strong> dead</li>
        <li><strong>{count('failed')}</strong> failed</li>
      </ul>

      <h4 className="section-title">Team</h4>
      {conflictCount > 0 && (
        <p className="rule-warning">
          No shared types: {conflictCount} team pairs share a primary type. Swap one of them into the PC.
        </p>
      )}
      {team.length > TEAM_SIZE && (
        <p className="rule-warning">More than {TEAM_SIZE} pairs are on the team.</p>
      )}
      {compact ? null : team.length === 0 ? (
        <p className="status">Nobody on the team yet. Pairs join once both of you caught something.</p>
      ) : (
        <ul className="team-grid">
          {team.map((r) => (
            <li key={r.area} className={conflicts[r.id] ? 'team-pair clash' : 'team-pair'}>
              <span className="pair-area">{r.area}</span>
              {PLAYERS.map((p) => (
                <MonSummary key={p} id={r[`${p}_pokemon_id`]} nickname={r[`${p}_nickname`]} owner={names[p]} entry={rosterById[r[`${p}_pokemon_id`]]} gen={gen} />
              ))}
              {conflicts[r.id] && <span className="clash-note">Shares {conflicts[r.id].join(', ')}</span>}
            </li>
          ))}
        </ul>
      )}

      <h4 className="section-title">Encounters</h4>
      <div className="tabs encounter-filter" role="group" aria-label="Show encounters">
        {Object.entries(ENCOUNTER_FILTERS).map(([id, f]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {f.label}
          </button>
        ))}
      </div>
      <datalist id={`mons-gen-${gen}`}>
        {options.map((e) => <option key={e.id} value={e.label} />)}
      </datalist>
      <div className="encounter-list">
        <div className="encounter-row encounter-head" aria-hidden="true">
          <span>Area</span>
          <span>{names.p1}</span>
          <span>{names.p2}</span>
          <span>Status</span>
          <span />
        </div>
        {shown.map((row) => compact && row.area !== current ? (
          <button key={row.area} type="button" className={`encounter-row folded status-${row.status}${conflicts[row.id] ? ' clash' : ''}`} onClick={() => setOpenArea(row.area)}>
            <span className="area-name">{row.area}</span>
            {PLAYERS.map((p) => (
              <span key={p} className="folded-mon">
                {row[`${p}_pokemon_id`] && <img src={spriteUrl(row[`${p}_pokemon_id`])} alt="" width="32" height="32" loading="lazy" />}
                {row[`${p}_nickname`] || rosterById[row[`${p}_pokemon_id`]]?.label || '—'}
              </span>
            ))}
            <span className="status small-print">{STATUSES.find((s) => s.id === row.status)?.label}</span>
            <span />
          </button>
        ) : compact ? (
          <div key={row.area} className="encounter-open">
            {openArea && <button type="button" className="chip-button fold-back" onClick={() => setOpenArea(null)}>Back to next area</button>}
            {areaRow(row)}
            {renderNext?.(row, (changes) => save(row, changes))}
          </div>
        ) : areaRow(row))}
      </div>
      <AddArea
        existing={rows}
        onAdd={(area) =>
          save({ ...emptyEncounter(area), sort_order: Math.max(0, ...rows.map((r) => r.sort_order)) + 10 }, {})
        }
      />
    </>
  )
}

function MonSummary({ id, nickname, owner, entry, gen }) {
  if (!id) return null
  const types = entry ? rosterTypesInGeneration(entry, gen) : []
  return (
    <div className="mon-summary">
      <img src={spriteUrl(id)} alt="" width="64" height="64" loading="lazy" />
      <div>
        <span className="mon-owner">{owner}</span>
        <strong>{nickname || entry?.label || `#${id}`}</strong>
        {nickname && entry && <span className="status small-print">{entry.label}</span>}
        <span className="types">{types.map((t) => <TypeLink key={t} type={t} small />)}</span>
      </div>
    </div>
  )
}

/** One area = one linked pair: both players' catches and their shared status. */
function AreaRow({ row, names, gen, options, rosterById, families, encounters, clash, onSave, onRemove }) {
  const status = STATUSES.find((s) => s.id === row.status)
  const [dying, setDying] = useState(false)
  return (
    <div className={`encounter-row status-${row.status}${clash ? ' clash' : ''}`}>
      {dying && (
        <DeathDialog
          row={row}
          names={names}
          rosterById={rosterById}
          options={options}
          onClose={() => setDying(false)}
          onSave={(text) => {
            setDying(false)
            onSave(row, text ? { status: 'dead', died_at: text } : { status: 'dead' })
          }}
        />
      )}
      <span className="area-name">
        {row.area}
        {!row.template && <span className="hidden-tag"> custom</span>}
      </span>
      {PLAYERS.map((p) => (
        <Slot
          key={p}
          player={p}
          names={names}
          row={row}
          gen={gen}
          options={options}
          rosterById={rosterById}
          families={families}
          encounters={encounters}
          onSave={onSave}
        />
      ))}
      <select
        className="status-select"
        aria-label={`${row.area} status`}
        value={row.status}
        onChange={(e) => (e.target.value === 'dead' ? setDying(true) : onSave(row, { status: e.target.value }))}
        title={status?.label}
      >
        {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      {row.id ? (
        <button className="chip-button" onClick={() => onRemove(row)} title={row.template ? 'Clear this area' : 'Remove this area'}>
          {row.template ? 'Clear' : 'Remove'}
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}

/** One player's catch in an area: a Pokémon (typed, with suggestions) and a nickname. */
function Slot({ player, names, row, gen, options, rosterById, families, encounters, onSave }) {
  const name = names[player]
  const idKey = `${player}_pokemon_id`
  const nickKey = `${player}_nickname`
  const id = row[idKey]
  const entry = rosterById[id]
  const savedLabel = entry?.label ?? ''

  const [label, setLabel] = useState(savedLabel)
  const [nickname, setNickname] = useState(row[nickKey] ?? '')
  const [problem, setProblem] = useState('')
  const editing = useRef(false)

  // Take over changes from the other player, unless this field is being typed in.
  useEffect(() => {
    if (!editing.current) {
      setLabel(savedLabel)
      setNickname(row[nickKey] ?? '')
    }
  }, [savedLabel, row, nickKey])

  const byLabel = useMemo(
    () => Object.fromEntries(options.map((e) => [e.label.toLowerCase(), e.id])),
    [options],
  )

  function commitPokemon(text) {
    const value = text.trim()
    if (!value) {
      setProblem('')
      if (id) onSave(row, { [idKey]: null })
      return
    }
    const found = byLabel[value.toLowerCase()]
    if (!found) {
      setProblem(`“${value}” isn’t a Gen ${gen} Pokémon`)
      return
    }
    setProblem('')
    setLabel(rosterById[found].label)
    if (found !== id) onSave(row, { [idKey]: found })
  }

  const dupes = id ? findDupes(encounters, id, rosterById, families, { area: row.area, player }) : []
  const types = entry ? rosterTypesInGeneration(entry, gen) : []

  return (
    <div className="slot">
      <div className="slot-mon">
        {id ? <img src={spriteUrl(id)} alt="" width="48" height="48" loading="lazy" /> : <span className="slot-empty" />}
        <div className="slot-fields">
          <input
            list={`mons-gen-${gen}`}
            aria-label={`${name}’s Pokémon on ${row.area}`}
            placeholder={`${name}’s Pokémon`}
            value={label}
            onFocus={() => (editing.current = true)}
            onChange={(e) => {
              setLabel(e.target.value)
              // Picking a suggestion fills in the full name: save straight away.
              if (byLabel[e.target.value.toLowerCase()]) commitPokemon(e.target.value)
            }}
            onBlur={(e) => {
              editing.current = false
              commitPokemon(e.target.value)
            }}
          />
          <input
            aria-label={`${name}’s nickname on ${row.area}`}
            placeholder="Nickname"
            value={nickname}
            onFocus={() => (editing.current = true)}
            onChange={(e) => setNickname(e.target.value)}
            onBlur={() => {
              editing.current = false
              if (nickname !== (row[nickKey] ?? '')) onSave(row, { [nickKey]: nickname })
            }}
          />
        </div>
      </div>
      {entry && (
        <span className="types">
          <span className="dex-number">{formatDexNumber(entry.dex)}</span>
          {types.map((t) => <TypeLink key={t} type={t} small />)}
        </span>
      )}
      {problem && <span className="slot-warning">{problem}</span>}
      {dupes.length > 0 && (
        <span className="slot-warning">
          Dupe: same evolution line as {dupes.map((d) => `${names[d.player]}’s ${d.area}`).join(', ')}
        </span>
      )}
    </div>
  )
}

function AddArea({ existing, onAdd }) {
  const [name, setName] = useState('')
  const taken = existing.some((r) => r.area.toLowerCase() === name.trim().toLowerCase())
  return (
    <form
      className="toolbar add-area"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim() || taken) return
        onAdd(name.trim())
        setName('')
      }}
    >
      <input placeholder="Add an area (post-game spot, gift, hack-only route…)" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="chip-button" type="submit" disabled={!name.trim() || taken}>
        Add area
      </button>
      {taken && <span className="status">That area is already in the list.</span>}
    </form>
  )
}
