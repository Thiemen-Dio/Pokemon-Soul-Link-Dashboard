import { useEffect, useMemo, useState } from 'react'
import TypeLink from './TypeLink.jsx'
import {
  chartForGeneration,
  defensiveMatchups,
  getTypeData,
  typesInGeneration,
} from '../api/pokeapi.js'

const GROUPS = [
  { label: 'Weak ×4', test: (m) => m === 4 },
  { label: 'Weak ×2', test: (m) => m === 2 },
  { label: 'Resists ×½', test: (m) => m === 0.5 },
  { label: 'Resists ×¼', test: (m) => m === 0.25 },
  { label: 'Immune ×0', test: (m) => m === 0 },
]

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
const LATEST_GEN = 9

export default function TypeMatchups({ typeHistory, introducedIn, onNavigate }) {
  const [typeData, setTypeData] = useState(null)
  const [error, setError] = useState(false)
  const [gen, setGen] = useState(LATEST_GEN)

  useEffect(() => {
    getTypeData().then(setTypeData).catch(() => setError(true))
  }, [])

  const types = typesInGeneration(typeHistory, gen)
  const matchups = useMemo(
    () => (typeData ? defensiveMatchups(chartForGeneration(typeData, gen), types) : []),
    [typeData, gen, types],
  )

  const gens = []
  for (let g = introducedIn; g <= LATEST_GEN; g++) gens.push(g)

  return (
    <>
      <div className="section-head">
        <h4>Type matchups</h4>
        <select value={gen} onChange={(e) => setGen(Number(e.target.value))} aria-label="Matchup generation">
          {gens.map((g) => (
            <option key={g} value={g}>Gen {ROMAN[g]}</option>
          ))}
        </select>
      </div>

      {error && <p className="status error">Couldn’t load the type chart.</p>}
      {!typeData && !error && <p className="status">Loading…</p>}

      {typeData && (
        <dl className="matchups">
          {GROUPS.map(({ label, test }) => {
            const hits = matchups.filter((m) => test(m.multiplier))
            if (!hits.length) return null
            return (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="types">
                  {hits.map((m) => (
                    <TypeLink key={m.type} type={m.type} small onClick={onNavigate} />
                  ))}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </>
  )
}
