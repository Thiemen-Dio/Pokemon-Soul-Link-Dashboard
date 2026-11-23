// Release notes: what changed per release, newest first. Screenshots live in public/release-notes/.
import { Link } from 'react-router-dom'

const RELEASES = [
  {
    name: 'Test to prod 1',
    date: '23 November 2026',
    summary: 'What was built in the Test tab is now the real site. The old dashboard is replaced by My runs, and every run gets its own page built around the team.',
    compare: [
      ['Start page', 'The run log of one run', 'Home (news and stats of all runs) + My runs'],
      ['Choosing a run', 'Chips at the top of the page', 'Run cards with team, progress and status; “Playing now” on top'],
      ['The team', 'A list of the pairs on the team', 'Team planner: big sprites, suggestions, item and rule checks'],
      ['Run log', 'Every area open at once', 'Folded: only the next area is open, with what can appear there'],
      ['A Pokémon', 'Name, sprite and types', 'Card with nature, ability, stats, four moves, held item, evolving'],
      ['Shared primary types', 'A warning', 'Hard-locked: a clashing pair can’t be on the team'],
      ['Randomized runs', 'Type the Pokémon by hand', 'Search list, or upload the randomizer log to see every route'],
    ],
    sections: [
      {
        title: 'New structure',
        image: ['dashboard-home.png', 'My runs: the run you are playing, then every run with its team and a dot per area.'],
        points: [
          'Menu: Home, My runs, Pokédex, Release notes, Test. The Test tab stays as the playground for new ideas; what worked there is now the real site.',
          'My runs: the run you are playing, the New run button and cards for every run.',
          'Home (the real home page is still to be built): latest news from all runs, “In which runs did we use…?”, all runs side by side and the Hall of Fame.',
          'New run button with the run’s rules and randomizer settings.',
          'Every page needs a login; only the two players can change anything.',
        ],
      },
      {
        title: 'Team planner',
        image: ['team-planner.png', 'Both players’ six side by side, with the suggestions and checks on the right.'],
        points: [
          'The main piece of a run: both sixes side by side, linked pairs, big sprites with BST, Speed and the held item’s icon.',
          'Pin pairs to keep them, Swap a pair, × takes one off and the rest move up.',
          'Best option: the best all-round team over every variable. Below it, best at one thing: balanced, fewest weaknesses, highest base stats, legendaries, attack coverage, defensive coverage, tanky, fast, hardest hitters.',
          'Flip through up to five options per choice. The same pairs always give the same suggestions.',
          'Held items are handed out where they help most (pinned items stay put), with a switch to work it out without items.',
          'Attack range (from damaging moves) and defence range (from typing), weak spots, and the rule checks.',
          'Clicking a Pokémon opens its card; clicking outside closes it.',
        ],
      },
      {
        title: 'Pokémon card',
        image: ['pokemon-card.png', 'A Pokémon as it is now in the run.'],
        points: [
          'Animated sprite, nickname, species, types and a Pokédex button that opens the Pokédex on top of the run.',
          'Nature and ability side by side. The nature marks its stats: +Atk in red, −Def in blue.',
          'Stat bars coloured by how high they are (like PokémonDB), with nature and item included.',
          'Four move blocks coloured by type. New catches start with their level 1 moves.',
          'Held items and berries from the run’s generation, with pictures; pin an item or take it off with ×.',
          'What it is weak to and what it resists.',
          'Evolve from the card: it changes the Pokémon in the run, so types and stats stay right everywhere.',
          'Moves, item, nature and ability are saved in the database, so both players see them.',
        ],
      },
      {
        title: 'Run log',
        image: ['run-log-next-area.png', 'Only the next area is open, with everything that can appear there.'],
        points: [
          'Every area folded to one line; only the next area to catch is open. Click any line to open it.',
          'The open area shows what can appear there (levels, odds, dupe warnings). Tap a player’s name to fill in their catch.',
          'Randomized runs get a search list instead. “Not listed? Search all” works everywhere.',
          'Setting a pair to Dead asks what happened; the graveyard remembers it.',
        ],
      },
      {
        title: 'PC box',
        image: ['pc-box.png', 'Every caught pair; click one for both partners’ cards.'],
        points: [
          'Every caught pair as linked sprites, coloured by status (team, PC, dead, failed), with filters.',
          'Click a Pokémon to see both partners’ cards side by side.',
        ],
      },
      {
        title: 'Rules',
        points: [
          'No shared primary types is hard-locked: a clashing pair can’t join the team, a new catch that would clash goes to the PC, and an evolution that causes a clash sends the pair to the PC. You get a message each time.',
          'Dupes clause checked over the whole run, by evolution line.',
        ],
      },
      {
        title: 'Getting ready and scouting',
        points: [
          'Next up: the next area, the next boss with its type and level cap, and how many of your team are weak to it.',
          'Level caps (mark bosses beaten), boss prep (super-effective moves learned before the cap), team weaknesses & coverage, evolution watch.',
          'Randomizer log: upload the Universal Pokémon Randomizer ZX log and every route shows its real Pokémon.',
          'Route finder with dupe chance, and an area planner that ranks areas by new evolution lines.',
        ],
      },
      {
        title: 'Story and sharing',
        points: [
          'Graveyard with favourites, run Pokédex, favourite types per player, achievements and a run timeline.',
          'Stream overlay for OBS and a share summary for Discord or chat.',
        ],
      },
    ],
  },
]

export default function ReleaseNotes() {
  return (
    <section className="release-notes">
      <h2>Release notes</h2>
      {RELEASES.map((r) => (
        <article key={r.name} className="release">
          <header className="release-head">
            <span className="release-tag">{r.name}</span>
            <span className="status small-print">{r.date}</span>
          </header>
          <p className="release-summary">{r.summary}</p>

          <div className="table-wrap">
            <table className="moves release-compare">
              <thead><tr><th /><th>Before</th><th>Now</th></tr></thead>
              <tbody>
                {r.compare.map(([what, before, now]) => (
                  <tr key={what}><th>{what}</th><td className="before">{before}</td><td className="now">{now}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {r.sections.map((s) => (
            <section key={s.title} className={s.image ? 'release-section with-image' : 'release-section'}>
              <div>
                <h3>{s.title}</h3>
                <ul>{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
              {s.image && (
                <figure>
                  <img src={`/release-notes/${s.image[0]}`} alt={s.image[1]} loading="lazy" />
                  <figcaption className="status small-print">{s.image[1]}</figcaption>
                </figure>
              )}
            </section>
          ))}
          <p className="status small-print">Go to the <Link to="/my-runs">My runs</Link> to try it.</p>
        </article>
      ))}
    </section>
  )
}
