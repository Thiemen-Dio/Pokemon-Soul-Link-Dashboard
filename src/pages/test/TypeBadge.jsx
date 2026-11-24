import { TYPE_COLORS } from '../../api/pokeapi.js'

/** A type badge that stays put: on the run pages, types don't jump to the Pokédex. */
export default function TypeBadge({ type, small = false }) {
  return <span className={small ? 'type small' : 'type'} style={{ background: TYPE_COLORS[type] }}>{type}</span>
}
