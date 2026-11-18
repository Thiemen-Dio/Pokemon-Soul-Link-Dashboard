import { Outlet } from 'react-router-dom'

// The Pokémon / Types / Abilities / Moves tabs live in the sticky SiteHeader.
export default function Pokedex() {
  return (
    <section>
      <div className="page-head">
        <h2>Pokédex</h2>
      </div>
      <Outlet />
    </section>
  )
}
