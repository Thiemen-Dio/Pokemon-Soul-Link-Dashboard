import { Link } from 'react-router-dom'
import { CurrentRuns, RunsOverview } from './my-runs/MyRuns.jsx'

/** The real home page is still to be designed; until then: doors, and the overview of all runs. */
export default function HomeSoon() {
  return (
    <section className="home-soon">
      <h2>Home page needs to be built</h2>
      <p className="status">This will become the Soul Link home page. Until then: news and stats from every run.</p>
      <CurrentRuns />
      <div className="doors">
        <Link to="/my-runs" className="door"><strong>My runs</strong><span>The current run, a new run and every run</span></Link>
        <Link to="/pokedex" className="door"><strong>Pokédex</strong><span>Look up any Pokémon</span></Link>
        <Link to="/release-notes" className="door"><strong>Release notes</strong><span>What changed in this version</span></Link>
      </div>
      <RunsOverview />
    </section>
  )
}
