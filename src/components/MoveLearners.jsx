import { useEffect, useState } from 'react'
import { displayName, spriteUrl } from '../api/pokeapi.js'
import { getMoveLearners, methodLabel } from '../api/pokeapiGraphql.js'

/** Every Pokémon that can learn one move, with how it learns it. */
export default function MoveLearners({ moveId, moveName, gameId, gameName, onSelectPokemon }) {
  const [learners, setLearners] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLearners(null)
    setError(false)
    getMoveLearners(moveId, gameId)
      .then((list) => !cancelled && setLearners(list))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [moveId, gameId])

  const where = gameName ? ` in ${gameName}` : ''

  return (
    <>
      <h5>
        Pokémon that can learn {displayName(moveName)}
        {where}
        {learners && ` (${learners.length})`}
      </h5>
      {error && <p className="status error">Couldn’t load which Pokémon learn this move.</p>}
      {!learners && !error && <p className="status">Loading…</p>}
      {learners?.length === 0 && (
        <p className="status">No Pokémon can learn this move{where}.</p>
      )}
      {learners?.length > 0 && (
        <ul className="mini-mons">
          {learners.map((p) => (
            <li key={p.id}>
              <button className="mini-mon" onClick={() => onSelectPokemon(p.id)}>
                <img src={spriteUrl(p.id)} alt="" loading="lazy" width="56" height="56" />
                <span>{p.label}</span>
                <span className="ways">{p.ways.map((w) => methodLabel(w.method, w.level)).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
