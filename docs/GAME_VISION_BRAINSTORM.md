# Game vision brainstorm

Living document. Captures what we're keeping from the fork, what the engine
rewrite frees us to redesign, and open genre-direction ideas. Not a decision
record — nothing here is committed until a direction is picked.

## 1. Existing foundations (survive the rewrite untouched)

These are MIT-safe, sit above the `src/micro` Worker boundary, and don't
depend on Tier-1 engine decisions — free to build on immediately.

- **Dual WebGL2/WebGPU rendering** with TSL (Three.js Shading Language) node
  materials — positioned for GPU-compute-driven simulation, not just
  graphics, as WebGPU compute matures.
- **A real traffic simulator, not an abstraction.** `src/traffic/` (`Car`,
  `Intersection`, `Lane`, `Road`, `TrafficWorld`, `Trajectory`, curve/geometry
  classes) is a per-vehicle lane-and-pathing sim — separate from the crude
  GPL `Traffic.js` density valve in `src/micro`. Much richer than stock
  SimCity's traffic model.
- **A cinematic rendering pipeline**: custom `GroundShader`, `PostEffect`/
  `Vignette`, LUT color grading (`assets/luts`), DRACO-compressed model
  loading, texture atlasing (`AutoTexture.js`).
- **A full UI shell** (`src/city3d/hub/`): Budget, Build, Disaster, Economy,
  Eval, History, Ordinances, Overlays, Awards, Save/Load, Top-bar — 13 panels
  already scaffolded. Backing logic can be swapped without redesigning UX.
- **Disaster spectacle system actively in progress** (recent commits: fire
  animation, disaster meshes, disaster visuals) plus a sound set including
  siren, explosion, helicopter, and a monster/zombie roar — groundwork
  already leans toward kaiju/disaster spectacle, not quiet zoning.
- **Web Worker separation** — sim already runs off the main thread.
- Save/load, mobile support, sound system, export tooling
  (`src/jsm/exporters`) — genre-agnostic infrastructure, no rebuild needed.

## 2. Genre-direction options (Tier 1 / Tier 4 rewrite decides these)

The engine data model (Tier 1) and city-systems layer (Tier 4) are where
genre identity actually lives. Candidate directions, each buildable on what
already exists:

### A. Disaster-spectacle city builder
City building punctuated by escalating threats requiring defensive design —
evacuation routing via the real traffic sim, defense infrastructure, risk/
reward zoning near hazards. "Rampage meets SimCity." Leans directly on the
disaster mesh/animation work already underway and the monster sfx.
- Core loop: build → threat escalates → defend/adapt → rebuild → repeat.
- Hub tie-in: `Hub_Disaster.js` becomes a primary panel, not a rare event log.
- Risk: can tip into tower-defense and lose the "calm builder" audience.

### B. Traffic-first city builder
Individual car AI and lane geometry become the core strategic loop instead
of a background stat — congestion, signal timing, transit-mode design,
supply routes.
- Core loop: zone → generate demand → route/relieve congestion → unlock
  transit tech → repeat at higher density.
- Natural extension: cargo trucks visibly carrying goods between industrial
  and commercial zones using the same pathing system (see §4).
- Risk: niche appeal vs. traffic-sim enthusiasts specifically; needs strong
  onboarding so it doesn't read as "SimCity but slower."

### C. Cozy/diorama builder
WebGPU/shader pipeline and the existing "snow, night" roadmap items become
the hook — gorgeous lighting/weather, softer fail-states, strong photo mode
(already have the post-processing for it).
- Core loop: build → weather/season shifts mood and needs → decorate/curate
  → share screenshot.
- Risk: shallow long-term systems depth if not paired with another axis.

### D. Run-based / roguelite city builder
Scenario maps with modifiers and constraints instead of an endless sandbox;
meta-progression unlocks building types/ordinances across runs.
- `Hub_Awards.js` and `Hub_Ordinances.js` already anticipate exactly this
  unlock structure.
- Core loop: pick scenario/modifiers → run to a win/loss condition → unlock
  → next run with new options.
- Risk: cuts against the "sandbox city builder" expectation some players want.

### E. Shared/persistent world
Async multiplayer trade between cities, or a shared map — biggest lift (no
networking layer exists yet) but most differentiated; browser-native means
zero install friction for a shared session.
- Risk: server/infra cost and complexity far beyond the other options.

### Hybrid combinations worth considering
- **B + A**: traffic-first economy with disaster spikes that test the
  transit network you built (evacuation becomes a real routing problem, not
  a scripted cutscene).
- **D + A**: roguelite runs where each scenario's modifier *is* a disaster
  archetype (flood map, kaiju map, blizzard map), with unlocks changing your
  defensive toolkit.
- **C + B**: cozy presentation, traffic-sim depth underneath — approachable
  surface, real systems for players who dig in.

## 3. Browser-native differentiators (things a desktop city builder can't easily do)

- **Shareable cities via URL/short code** — no install means a link can drop
  someone straight into your city. Strong social/virality angle unavailable
  to Cities: Skylines-style competitors.
- **Spectator/flythrough mode** — auto-camera tour using the existing
  `PostEffect`/`Vignette`/exporter pipeline; good for sharing without
  requiring the viewer to play.
- **Deterministic replay/timelapse** — since the sim already advances via
  discrete Worker tick messages, logging and replaying that message stream
  is a comparatively cheap way to get replay/timelapse export, no separate
  system needed.
- **Twitch/stream-friendly disaster triggers** — chat-voted disasters or
  policy events layer naturally onto the existing Disaster/Ordinances panels.
- **Leaderboards/challenges** — lightweight to instrument given the Worker
  architecture already isolates and ticks simulation state cleanly.

## 4. New foundations worth building regardless of genre direction

- **Data-driven tile/building definitions** (JSON tables instead of the
  original's hardcoded tile-ID switch statements) — cheap to add zone types,
  seasonal reskins, or later content without code changes.
- **Pluggable Tier 4 city-systems modules** (Budget/Evaluation/etc. as
  independent, composable systems) so new overlay layers (pollution, crime,
  tourism, education) can be added beyond classic RCI/power/traffic without
  touching the core.
- **Visible goods movement** — extend the existing car-agent traffic sim so
  industrial→commercial supply chains are actual routed vehicles, not an
  invisible stat. Nobody else can cheaply copy this without already having a
  real per-vehicle pathing sim, which we do.
- **Season/weather system** wired into Tier 4, not just visual: seasons
  affect RCI growth, power demand, disaster likelihood (snow needs plowing
  infrastructure, etc.) — connects the existing shader/LUT roadmap item to
  real gameplay instead of a cosmetic toggle.
- **Policy-event "dilemma" system** — Frostpunk-style random events with
  real tradeoffs, surfaced through the existing `Hub_Ordinances.js` panel
  instead of a flat toggle list.
- **Versioned save format**, decided now while the data model is being
  rewritten anyway — avoids breaking saves on every later patch.
- **Modding-friendly content layer** — a natural side effect of data-driven
  definitions; lets a community add buildings/scenarios without touching
  engine code.
- **Accessibility from day one** — colorblind-safe overlay palettes, since
  `Hub_Overlays.js` already exists as the natural place to add them.

## 5. Additional mechanics ideas (round 2)

### Traffic sim as an economy engine, not just a routing puzzle
`src/traffic` already moves individual vehicle agents around for visual/
congestion purposes. Let those same agents *carry* something — goods from an
industrial zone to a warehouse, workers from residential to jobs, tourists
from a hotel to an attraction — and supply chains become visible and legible
instead of a background number. Most city builders fake this with stats; a
truck can visibly get stuck in the jam you caused. Rare differentiator
because it requires a real per-vehicle pathing sim, which already exists
here.

### Mass Movement Events — one system, two opposite triggers
Originally framed as "disasters as an emergent traffic-stress test rather
than a scripted event" (load the existing road network dynamically — spike
evacuation demand, watch `TrafficWorld` actually gridlock, score on how many
sims got out, instead of "tornado plays animation, damages tiles").

Broadened: build this as a general **mass movement event** system with two
opposite triggers sharing the same underlying mechanism:

- **Forced / negative** — disaster evacuation. Sudden, unplanned, penalizes
  a network that can't clear fast enough.
- **Planned / positive** — city events: concerts, sports games, festivals,
  parades, conventions. Scheduled (often player-triggered) surges tied to
  specific venue buildings (Stadium, Arena, Concert Hall, festival grounds,
  Convention Center) rather than random disasters.

Planned events add a risk/reward layer disasters don't: bigger events mean
more ticket revenue and tourism income, but stress the road network around
that venue exactly like an evacuation would — if transit design can't
handle the surge, the payoff is complaints, traffic-jam penalties, possibly
cancelled events or reputation loss. Strategic response mirrors real
infrastructure problems: build parking/transit hubs near venues, schedule
events off-peak, run event-specific shuttle lines using the same
vehicle-agent system as goods transport above.

Because both triggers reduce to "spike demand on the road network, measure
whether it holds," this is cheap to build once and get both a disaster
system and an events/economy system out of it. Natural tie-ins to existing
scaffolding: `Hub_Economy.js` (ticket/tourism revenue), `Hub_Ordinances.js`
(event permits), `Hub_Overlays.js` (event traffic heatmap), `Hub_History.js`
("the city that always jams during football season" as an emergent,
readable story rather than a stat).

### Micro-scenarios as tutorial-by-stealth
The roguelite/run structure (direction D) doesn't have to replace the
sandbox — it can be the onboarding path instead. First-time players get
short scenario runs (5–10 min, one clear failure mode each) that teach one
system at a time, then "graduate" into the open sandbox once they've
unlocked enough building types to make it interesting. Solves the classic
city-builder cold-open problem: a blank map with 40 buttons and no idea
which to press first.

### Seasonal identity over reskins
Rather than snow/night as a cosmetic toggle (current roadmap phrasing), each
season shifts the *dominant* pressure instead: summer = power/water demand,
winter = plowing/heating cost and slower traffic, storm season = the mass
movement / disaster system above. Gives the existing shader/LUT roadmap item
a mechanical reason to exist instead of only looking nice.

### A different fail-state philosophy
SimCity/Skylines punish with abandonment and bulldozing. Given the
disaster-spectacle lean already present in the asset pipeline, failure could
instead be *narrative*: a monster stomps a district, you rebuild it as a
memorial park or a fortified zone, and the city's history panel
(`Hub_History.js`, already exists) visibly carries the scar going forward.
Turns loss into content instead of pure punishment.

## Open question

No genre direction chosen yet. Candidates A–E (and hybrids) in §2 above are
the live options — next step is picking one (or a hybrid) so Tier 1's data
model can be designed around it rather than staying generic.
