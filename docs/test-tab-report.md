# Test tab report

Session: 18 Nov 2026, 18:32–18:58. Everything below lives on the **Test** tab (`/test`), plus one new page, `/overlay`.
Open a run straight from the link: `/test?run=JetBlack` or `/test?run=Randomized Emerald`.

**Everything is read-only.** The Test tab and the overlay read runs and encounters but never write to the database. The two forms are mock-ups that save nothing.

## Changes made

| File | What changed |
|---|---|
| `src/components/SiteHeader.jsx` | "Test" link after Dashboard and Pokédex |
| `src/App.jsx` | `/test` route, plus `/overlay` route **without the header** (normal pages now share a small `Layout`) |
| `src/index.css` | Header links are a bit smaller under 480px wide, so three links fit on a phone. **Fix for the whole app:** dropdowns keep room for their arrow (the arrow covered the end of the text), and links styled as buttons are no longer underlined |
| `src/pages/test/Test.jsx` | The Test lab: all prototypes, grouped in categories with a jump menu |
| `src/pages/test/MockForms.jsx` | Death report and New run setup mock-up forms |
| `src/pages/test/OverlayPage.jsx` | `/overlay?run=Name`: see-through team strip for OBS, updates live |
| `src/pages/test/data.js` | Helpers: PokeAPI route encounters, next evolutions, level caps, gifts, catches, time-ago |
| `src/pages/test/data.check.mjs` | Self-check for the helpers. Run with `node src/pages/test/data.check.mjs` (passes) |
| `src/pages/test/test.css` | Styles for the Test tab and overlay only |
| `docs/test-tab-report.md` | This report |

**To remove the experiment:** delete `src/pages/test/`, the Test link in `SiteHeader.jsx`, and the `/test` and `/overlay` routes in `App.jsx`. Keep the `Layout` change if `/overlay` stays.

## Research: how Soul Link trackers and streamers sort their information

- **Pairs are the unit.** Trackers show the two linked Pokémon side by side; team/box/dead moves both together ([Soullocke](https://soullocke.vercel.app/about), [SidoJain tracker](https://github.kxpsado.workers.dev/SidoJain/Pokemon-Soul-Link)).
- **Timeline and event log.** Soullocke has a timeline view and an event log that records deaths ([guide](https://soullocke.vercel.app/guides/getting-started)).
- **Stream overlays.** PokeStreamer Tools shows paired sprites on stream via a web page that OBS loads ([GitHub](https://github.com/EverOddish/PokeStreamer-Tools/)); simpler team overlays exist too ([Cobold](https://coboldthefox.itch.io/pokemon-team-stream-overlay)).
- **Next level cap always visible**, and **every route in order with what can appear there** ([Nuzlocke Tracker](https://nuzlocke-tracker.pages.dev/), [PokeTools Emerald](https://www.poketools.com/emerald/nuzlocke)).
- **Rule alerts**: dupes clause warnings, custom rule sets that warn when broken ([dupes clause](https://nuzlocke-tracker.pages.dev/nuzlocke-dupes-clause.html)).
- **Gaps seen:** no good graveyard views, no cross-run stats, no player-vs-player view. Those are chances to stand out.

## Category structure (proposal for the real site)

The Test tab is organised the way the real site could be:

1. **Home**: the run you're playing, news, doors to other pages
2. **Before you play**: next up, route finder, area planner, what-if, level caps, boss prep
3. **Team**: weaknesses & coverage, free types, swaps, evolutions, rule check
4. **History**: timeline, graveyard, death report, run Pokédex, player vs player, where used, all-run stats, achievements
5. **Setup**: new run with its own house rules
6. **Share & stream**: overlay, copyable summary

## Prototypes built

| Category | Prototype | Pokédex × run? | State |
|---|---|---|---|
| Home | **Home & news**: dark hero with the active run, team strip, progress bar, next area & cap; latest catches/deaths; "new since your last visit" marker; doors to Dashboard, Pokédex, Type chart, Moves, Overlay, Graveyard | — | Works. "News" = last changed rows (`updated_at`). |
| Before you play | **Next up**: next area, next boss + cap, team size | — | Works. Boss stays on the first until "bosses beaten" is stored. |
| | **Route finder**: wild encounters per area from PokeAPI (levels, method %, Gen types), **dupe** and **type clash** marks, **dupe chance per method**, a **max level** filter to hide post-game slots, starters and Emerald gifts | ✔ | Works for **42/42 Black/White** and **56/56 Emerald** areas. Randomized runs get a warning. |
| | **Area planner**: areas not done yet, ranked by how many evolution lines are still new to you, with a sprite preview | ✔ | Works (JetBlack: Giant Chasm first with 22 new lines). Checks ~40 areas at once on load. |
| | **What-if checker**: type two Pokémon → dupe? type clash? team or PC? | ✔ | Works. |
| | **Level caps** with **boss danger** ("4/8 weak" to Roxanne) | ✔ | Works. Vanilla caps, clicking marks beaten (not saved). |
| | **Boss prep**: per team member, the strongest super-effective level-up moves learned by the boss's cap, from the run's game learnset | ✔ | Works. Uses current move types; TMs not included. |
| Team | **Weaknesses & coverage**: weak/resist count per attacking type + which types the team's own types hit 2× | ✔ | Works. Gen-correct chart. |
| | **Free primary types**: which primary types are still open | ✔ | Works. |
| | **Swap suggestions**: PC pairs that fit the team without a clash | ✔ | Works. |
| | **Evolution watch**: next evolution + how (level, stone, trade, friendship), limited to the run's generation | ✔ | Works. |
| | **Rule check**: team size, shared types, dupes, shared fate | — | Works. See open question 3. |
| History | **Run timeline**: one dot per area, coloured by status | — | Works. |
| | **Graveyard**: dead pairs, grey sprites | — | Works (8 graves in Randomized Emerald). |
| | **Death report (mock)**: cause, killer, level, place, last words, live graveyard-card preview | — | Mock-up, saves nothing. |
| | **Run Pokédex**: the generation's species, coloured if caught, silhouette if not | ✔ | Works (38/135 Gen 3 in Emerald run). |
| | **Player vs player**: catches, type spread bar, favourite types, % nicknamed | ✔ | Works. |
| | **Where did we use it?**: search a Pokémon, see every run/area its evolution line was caught in and how it ended | ✔ | Works. |
| | **All-run stats**: areas used, pairs, deaths, survival %, top type per run | ✔ | Works. |
| | **Achievements**: First pair, Full team, Halfway, Collector, Survivor, Graveyard keeper, Champions | — | Works (5 of 7 in Randomized Emerald). Could feed the home news. |
| Setup | **New run setup (mock)**: game, players, randomized, rule toggles → shows what would be stored, incl. a `rules` object | — | Mock-up, creates nothing. |
| Share & stream | **Stream overlay**: preview on the Test tab + real page at `/overlay?run=Name` (see-through, live updates, no header). Options: `&size=small` or `large`, `&names=off`, `&theme=light`. The Test tab has a **link builder** for these, with an "Open overlay" button and OBS steps | — | Works. Add as an OBS Browser Source. |
| | **Share summary**: copyable text for Discord/WhatsApp/chat | — | Works. |

## Ideas not built yet

### Home page / news
- "Since you last visited" per **player** (now it's per browser): store last-seen per player.
- Milestones as news: first gym beaten, 10th death, team complete, run beaten.
- A run card per run on the home page, each with a mini timeline.
- "MVP of the run": both players vote for a pair.

### Connecting Pokédex data to runs
- **Badges on Pokédex cards**: "used in JetBlack (Route 3), died". The "Where did we use it?" search is the data side of this.
- **Boss prep with TMs** and with the boss's own team (needs boss teams; PokeAPI has no trainer data).
- **Ability alerts** for the next boss (Levitate vs Ground, Sturdy, Intimidate).
- **Encounter planner**: order the remaining areas by dupe chance, so you visit the most "fresh" ones first.
- **Move type history**: use the move's type for the run's generation (Bite was Normal before Gen 2, Charm before Gen 6).

### Pages / categories
- **Bosses page** per game: teams, levels, your past results.
- **Deaths page**: cause stats, deadliest area, deadliest boss (needs the death report columns).
- **Rules page**: house rules written out, with which ones the app checks.
- **Run journal**: session notes ("Session 4: beat Elesa, lost Chomp").
- **Run setup / settings** page (from the mock-up).

### Streamer-inspired
- Graveyard scene for stream intermissions (`/overlay/graveyard`).
- Overlay options in the link: `?size=large&names=off&theme=light`.
- Partner presence: "Finn is online" via Supabase Realtime presence.

## Open questions (your expertise)

1. **JetBlack level caps and areas**: the hack differs from vanilla Black/White. Do you have the boss list and area list?
2. **Exact game version**: runs store a version *group* (`black-white`). The route finder assumes the first game (Black / Emerald). White has some different encounters. Store the exact version on the run?
3. **Dupes and pair partners**: the rule check counts two partners catching the same line in one area as a dupe. Is that a dupe in your rules?
4. **Gifts and statics**: only the 3 Emerald gifts are listed by hand. Should gifts count as the area's encounter (the setup mock asks this)?
5. **What to save**: bosses beaten, death details (cause, killer, level), per-run rules. Each needs a small database change. Which matter?
6. **Randomized runs**: the route finder can't help there. Log what you *saw* per area instead?
7. **Other forms**: forms like blue-striped Basculin aren't in the app's Pokémon list (only normal + regional forms), so they show without types in the route finder. Add them to the list?
8. **Post-game encounters**: PokeAPI mixes early and post-game slots (Route 1 in Black lists Lv 2–4 *and* Lv 32–35 dark grass). Hide slots above the next level cap?

## Security notes

- **Run data can be read and changed by anyone who has the site's public key, without logging in** (known before this session, not changed). Anyone who finds the site could edit or delete runs. Suggested fix: Supabase login for the two players plus row-level security so only you two can write. I did not change this: it touches the live database and needs your decision.
- The new code only **reads**. The route finder and evolution queries send values to PokeAPI as GraphQL **variables**, so a typed custom area name can't change the query.
- `/overlay` shows only team sprites, run name, player names and death count, all of which are already public on the site.

## Checks run

- `npm run build`: passes after every step.
- `node src/pages/test/data.check.mjs`: passes (area name → PokeAPI name, game version, time-ago, catches).
- Area coverage against PokeAPI: Black/White 41/42 + starter, Emerald 52/56 + starter + 3 hand-made gifts.
- Screenshots of the Test tab (both runs), the overlay page (normal and `size=large&names=off&theme=light`) and the dashboard after the layout change.
- Typed into the page in a hidden browser: what-if (Bulbasaur + Charmander → both dupes, correct), "Where did we use it?" (Ariados → Finn's "Chomp", Route 110, on the team; Gible → never caught), route finder (Route 110: 11 Pokémon, 10 with max Lv 15).
- Header at 390px wide: the three links fit.
- **Not checked:** the overlay inside OBS itself, the two mock forms by typing, and every Test tab section at phone width.

## Bugs found and fixed during the session
- Death report and route finder picked their first choice before the run's data had loaded → the Test tab now waits for the run's data.
- Forms not in the app's list (blue-striped Basculin) showed as "#10016" → now use PokeAPI's own name.
- "Victory Road" and "Safari Zone" found no data → PokeAPI puts the region in front; fixed.
