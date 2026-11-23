import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../api/supabase.js'

/**
 * Hide when scrolling down, show again as soon as the user scrolls up.
 * Small jitters (< 8px) are ignored so the bar doesn't flicker.
 */
function useHideOnScrollDown() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y < 80) {
        setHidden(false)
        lastY = y
      } else if (y > lastY + 8) {
        setHidden(true)
        lastY = y
      } else if (y < lastY - 8) {
        setHidden(false)
        lastY = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return hidden
}

export default function SiteHeader({ email }) {
  const hidden = useHideOnScrollDown()
  const { pathname } = useLocation()
  const onPokedex = pathname.startsWith('/pokedex')

  return (
    <header className={hidden ? 'site-header hidden' : 'site-header'}>
      <nav className="nav">
        <span className="brand">Soul Link</span>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/pokedex">Pokédex</NavLink>
        <NavLink to="/release-notes">Release notes</NavLink>
        <button type="button" className="logout" title={email ? `Logged in as ${email}` : undefined} onClick={() => supabase?.auth.signOut()}>
          Log out
        </button>
      </nav>
      {onPokedex && (
        <nav className="tabs-bar" aria-label="Pokédex sections">
          <div className="tabs">
            <NavLink to="/pokedex" end>Pokémon</NavLink>
            <NavLink to="/pokedex/types">Types</NavLink>
            <NavLink to="/pokedex/abilities">Abilities</NavLink>
            <NavLink to="/pokedex/moves">Moves</NavLink>
          </div>
        </nav>
      )}
    </header>
  )
}
