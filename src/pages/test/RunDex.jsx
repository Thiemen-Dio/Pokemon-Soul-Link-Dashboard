// Run Pokédex for the PC box: every species of every generation, caught ones and their whole evolution lines marked.
import { spriteUrl } from '../../api/pokeapi.js'
import { catches } from './data.js'


/**
 * Every species of every generation. Caught = in colour with a solid ring. Catching one member of an
 * evolution line counts for the whole line: the rest are in colour with a dashed outline. Others: silhouettes.
 */
export default function RunDex({ encounters, rosterById, families }) {
  const caught = new Set(catches(encounters).map((c) => rosterById[c.id]?.dex ?? c.id))
  const familyOf = (dex) => families[dex] ?? -dex
  const caughtLines = new Set([...caught].map(familyOf))
  // Base forms only: regional forms share a dex number.
  const species = Object.values(rosterById).filter((e) => e.id === e.dex)
  const byGen = Object.entries(Object.groupBy(species, (s) => s.generation))
  const lines = species.filter((s) => caughtLines.has(familyOf(s.dex))).length
  return (
    <div className="run-dex-all">
      <p className="status">{caught.size} species caught, which covers {lines} of {species.length} Pokémon through their evolution lines.</p>
      {byGen.map(([g, list]) => (
        <section key={g}>
          <h4 className="mini-title">Gen {g} · {list.filter((s) => caughtLines.has(familyOf(s.dex))).length}/{list.length}</h4>
          <ul className="run-dex">
            {list.map((s) => {
              const state = caught.has(s.dex) ? 'got' : caughtLines.has(familyOf(s.dex)) ? 'line' : ''
              return (
                <li key={s.id} className={state} title={`${s.label}${state === 'got' ? ': caught' : state === 'line' ? ': its line is caught' : ''}`}>
                  <img src={spriteUrl(s.id)} alt={s.label} width="48" height="48" loading="lazy" className="pixel" />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

