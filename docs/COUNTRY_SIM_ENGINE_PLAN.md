# Country Sim: locked design pillars & engine change plan

Status: **locked direction.** This supersedes the genre brainstorm in
`docs/GAME_VISION_BRAINSTORM.md`. This doc maps the design pillars to
concrete engine changes, using the same Tier 1–7 breakdown from
`docs/LICENSE_REWRITE_SCOPE.md` — that doc scoped *how much* needs replacing
for licensing reasons; this one decides *what it gets replaced with*.

## Locked design direction

Vanilla SimCity zoomed out: **zoning + economy + traffic** becomes
**resource-gated specialization + production chains + regional logistics**,
played across a country/region of interdependent cities rather than one
isolated city. Three constraints are locked, explicitly rejecting the
Transport Fever/Factorio model of manual freight design:

1. **No manual route-setting.** The player never draws a freight path or
   assigns a vehicle to a specific cargo run.
2. **Resource endowment + zoning designation automatically determines what
   gets built.** An industrial zone sitting on an iron deposit resolves to
   an ore/steel-type facility; the player zones, the simulation decides the
   specific industry from the local resource + regional demand.
3. **Trade is automated but fully traceable and observable.** The
   simulation resolves supply and demand and generates shipments itself —
   but every shipment, chain, and bottleneck must be inspectable by the
   player. Transparency replaces manual control as the interaction model.

## Why this also finishes the licensing job

`docs/LICENSE_REWRITE_SCOPE.md` already requires Tiers 1, 3, 4, and 7 to be
rewritten from scratch to get off GPL. This design happens to make that
rewrite structurally inevitable anyway: resource endowments, cargo-carrying
agents, recipe-driven facility resolution, and a region-level trade graph
don't exist in any form in the original micropolisJS model (which is a
single-city, tile-switch-statement RCI simulator with no cross-city or
commodity concept at all). Building this vision and clearing the GPL
contamination are the same work, not two competing priorities.

## Engine changes required, by tier

### Tier 1 — Foundation (supersedes generic scope)
- **Resource/commodity type registry**: raw types (ore, coal, timber, grain,
  oil, fish...) and processed types (steel, lumber, flour, plastics...).
- **Lot-level resource endowment**: each tile gains a resource field set at
  map-gen time — replaces the original `Tile.js`'s pure land-use-code model.
- **Cargo-carrying shipment entity**: extends the existing vehicle-agent
  concept with origin, destination, commodity, quantity, chain-stage, and a
  traceable ID — this is what makes automated trade observable rather than
  a black box.
- **Two-level simulation scope, decided now, not bolted on later**: a
  per-city tick (similar shape to the existing `Simulation.js`) plus a
  region-level tick that resolves trade across cities. The original
  `CityGame.js` assumes exactly one city per Worker; that assumption cannot
  survive this design even if v1 ships with only one or two cities.

### Tier 2 — Map generation
- **Resource layer generation** alongside terrain — ore belts, farmland,
  coastal fishing grounds, forests, oil fields — as real geographic
  placement, not a random per-tile roll. Extends/replaces `MapGenerator.js`
  and `MapUtils.js`.
- **Region/country overworld map**: a grid of city-site plots, each
  summarizing its own resource endowment, connected by inter-city terrain
  for rail/road placement. `GameMap.js` currently models exactly one city;
  this is new, not an extension.

### Tier 3 — Zone resolution rules
- Replace the RCI growth-stage math entirely with a **resource/recipe-aware
  resolver**: given a zoned lot, its resource endowment, and regional
  supply/demand, resolve which facility archetype gets built and how it
  grows. This is a wholesale replacement of the `zone/Residential.js`,
  `Commercial.js`, `Industrial.js` classes, not an adaptation of them.
- New **data-driven recipe table**: input commodities → output commodities,
  facility archetype, required zone designation. Content, not code — new
  chains should be addable without touching engine logic.

### Tier 4 — City systems
- **Trade/logistics resolver** (doesn't exist in the original at all): each
  tick/interval, matches regional supply and demand per commodity, generates
  shipments, and hands them to the transport layer for actual pathfinding
  and movement using the existing `src/traffic` vehicle-agent system.
- **Observability/trace system**: indexes active shipments and chain health
  so the UI can answer "what's feeding this factory" or "why is this chain
  stalled" without ever exposing a manual routing control. This is the
  mechanism that satisfies constraint 3 above.
- **Budget/Evaluation scope decision required** — see Open decisions below;
  affects how `Budget.js`/`Evaluation.js` get rebuilt.

### Tier 5 — Tools
- Zoning tool (`BuildingTool.js` replacement) must surface a lot's resource
  endowment at zoning time, so the automatic industry selection is legible
  before the player commits.
- New **found-city tool** to place additional city sites within the region
  map — no equivalent exists in the original tool set.

### Tier 6 — Sprites
- Extend the existing vehicle/traffic sprite system with cargo-type visual
  tagging — reuses `SpriteManager.js` and the traffic sprite work already
  built; only needs cargo metadata wired through.

### Tier 7 — Orchestrator
- Biggest structural departure from the original. `CityGame.js`'s
  single-city-per-Worker model becomes a **region orchestrator** managing
  multiple city sims plus the trade graph. Needs a decision: one Worker
  managing N cities, or N Workers coordinated by a region-level controller —
  a performance question as much as an architecture one.

## Suggested build order

1. **Tier 1 foundation primitives** — resource types, cargo agents, the
   two-level tick model. Nothing else can be built without this existing
   first.
2. **Tier 2 resource-aware map gen**, single city first — prove resource
   endowment + auto-industry resolution works in isolation before adding
   regional complexity.
3. **Tier 3 zone resolution + recipe table** — prove one production chain
   end-to-end within a single city (e.g. ore → steel) before going regional.
4. **Tier 4 trade/logistics resolver + observability**, extended to two
   cities — prove automated cross-city shipment and full traceability.
5. **Tier 7 orchestrator restructure** to formally support N cities.
6. **Tier 5 found-city tool** and **Tier 6 cargo sprite tagging** — polish
   once the above is proven, not before.

## Locked decisions (round 2)

1. **Multi-city nodes** — a stylized network, not one continuous modeled
   region terrain. Each city is its own fully generated map (a node); cities
   are connected by inter-city corridors (rail/road/sea lanes) rather than
   a shared SimCity 4/2013-style contiguous region. This substantially
   shrinks Tier 2's scope versus the continuous-terrain option.
2. **National budget sets individual city budgets — both, not either/or.**
   A national treasury pools revenue (taxes + trade activity across the
   whole network) and allocates funding to each city; cities aren't fully
   autonomous, but they aren't a pure pass-through either. This is a
   two-tier budget system, not a single ledger.
3. **Lighter automated oversight for satellite towns.** The player doesn't
   tile-by-tile manage every founded city. Smaller resource towns run on
   simplified, automated rules; full manual control is reserved for the
   city/cities the player actively chooses to manage closely.

### Implications for the engine plan above

- **Tier 1** — add a per-city **control-mode flag**: `managed` (full player
  tools, full-fidelity per-tile simulation) vs. `automated` (heuristic-driven,
  coarser simulation). This isn't just a UI restriction — automated cities
  can run a cheaper aggregate simulation instead of a full `Tile`-grid tick,
  which is what actually makes simulating many cities at once feasible
  performance-wise. This is now a load-bearing part of Tier 1, not a later
  optimization.
- **Tier 2** — replaces the "region map" bullet: generate a **network graph**
  of city nodes (each independently map-generated, resource endowment
  assigned per node) connected by **corridor edges** — simplified transport
  segments with distance/capacity for the vehicle-agent system to path
  along, not fully modeled connecting terrain. Much less Tier 2 work than
  the continuous-terrain alternative would have been.
- **Tier 4** — `Budget.js`/`Evaluation.js` become **two-tiered**: a National
  Budget system aggregating revenue and allocating it per city, and a City
  Budget that operates within its national allocation rather than fully
  independently. City evaluation/happiness can now be starved by national
  policy, not just local mismanagement — a real tension, and it directly
  reuses the "smaller cities forced to serve bigger ones" dependency already
  central to the resource/production-chain design. Needs a new **National
  Budget hub panel**, distinct from the existing per-city budget panel.
- **Tier 5** — tool scope splits by control mode: full zoning/building tools
  for `managed` cities; a lighter **town-charter tool** (policy/priority
  sliders, not tile-by-tile control) for `automated` ones.
- **Tier 7** — the region orchestrator must schedule mixed-fidelity ticks:
  full simulation for `managed` cities, cheap aggregate simulation for
  `automated` ones. This is the concrete answer to Tier 7's open
  Worker-architecture question — fidelity, not just city count, is what
  should drive how work is split across Workers.
