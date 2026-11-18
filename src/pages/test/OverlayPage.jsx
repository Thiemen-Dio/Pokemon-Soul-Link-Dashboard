// /overlay?run=JetBlack — the team strip for OBS (Browser Source). See-through background,
// updates live when either player changes something. Read-only.
import { useEffect, useState } from 'react'
import { spriteUrl } from '../../api/pokeapi.js'
import { getEncounters, getRuns, subscribeToRun } from '../../api/soullink.js'
import './test.css'

export default function OverlayPage() {
  const [run, setRun] = useState(null)
  const [team, setTeam] = useState([])
  const [dead, setDead] = useState(0)
  const [error, setError] = useState('')

  // See-through page while the overlay is open.
  useEffect(() => {
    const root = document.documentElement
    const before = root.style.background
    root.style.background = 'transparent'
    return () => { root.style.background = before }
  }, [])

  useEffect(() => {
    const wanted = new URLSearchParams(location.search).get('run')?.toLowerCase()
    getRuns()
      .then((list) => setRun(list.find((r) => r.name.toLowerCase() === wanted) ?? list.find((r) => r.status === 'active') ?? list.at(-1) ?? null))
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!run) return
    const load = () => getEncounters(run.id).then((list) => {
      setTeam(list.filter((e) => e.status === 'team'))
      setDead(list.filter((e) => e.status === 'dead').length)
    }).catch((e) => setError(e.message))
    load()
    return subscribeToRun(run.id, load)
  }, [run])

  // Options in the link: ?size=small|large  &names=off  &theme=light
  const params = new URLSearchParams(location.search)
  const px = { small: 48, large: 96 }[params.get('size')] ?? 64
  const showNames = params.get('names') !== 'off'
  const light = params.get('theme') === 'light'

  if (error) return <p className="overlay-error">{error}</p>
  if (!run) return null
  return (
    <div className="overlay-only">
      <div className={light ? 'overlay-strip light' : 'overlay-strip'}>
        <span className="overlay-run">{run.name}</span>
        {team.length === 0 && <span className="overlay-empty">No team yet</span>}
        {team.map((r) => (
          <span key={r.id} className="overlay-pair" title={r.area}>
            {r.p1_pokemon_id && <img className="pixel" src={spriteUrl(r.p1_pokemon_id)} alt="" width={px} height={px} />}
            <span className="overlay-link" />
            {r.p2_pokemon_id && <img className="pixel" src={spriteUrl(r.p2_pokemon_id)} alt="" width={px} height={px} />}
          </span>
        ))}
        {showNames && <span className="overlay-names">{run.player1_name} ↔ {run.player2_name} · {dead} fallen</span>}
      </div>
    </div>
  )
}
