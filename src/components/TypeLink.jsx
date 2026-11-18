import { Link } from 'react-router-dom'
import { TYPE_COLORS } from '../api/pokeapi.js'

/** A type badge that opens that type on the Pokédex Types tab. */
export default function TypeLink({ type, small = false, onClick }) {
  return (
    <Link
      to={`/pokedex/types/${type}`}
      className={small ? 'type small type-link' : 'type type-link'}
      style={{ background: TYPE_COLORS[type] }}
      onClick={onClick}
      title={`Open the ${type} type`}
    >
      {type}
    </Link>
  )
}
