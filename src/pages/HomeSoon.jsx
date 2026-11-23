import { Link } from 'react-router-dom'

/** The real home page is still to be designed; until then this points to what exists. */
export default function HomeSoon() {
  return (
    <section className="home-soon">
      <h2>Home page needs to be built</h2>
      <p className="status">This will become the Soul Link home page. For now, everything lives on the dashboard.</p>
      <div className="doors">
        <Link to="/dashboard" className="door"><strong>Dashboard</strong><span>All runs, the team planner and the run log</span></Link>
        <Link to="/pokedex" className="door"><strong>Pokédex</strong><span>Look up any Pokémon</span></Link>
        <Link to="/release-notes" className="door"><strong>Release notes</strong><span>What changed in this version</span></Link>
      </div>
    </section>
  )
}
