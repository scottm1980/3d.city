# src/engine — Tier 1 data model (draft)

Clean-room replacement foundation for `src/micro`, per
`docs/LICENSE_REWRITE_SCOPE.md` and `docs/COUNTRY_SIM_ENGINE_PLAN.md`. This
directory shares no code, structure, or naming with the GPL-derived
`micropolisJS` tree — the data model is organized around resources,
recipes, and multi-city regions, which have no equivalent in the original.

## What's here (Tier 1 scope only)

- **`resources/`** — the commodity type registry (`ResourceType`) and
  production-chain definitions (`Recipe`). Data, not logic: recipe
  *resolution* (deciding what actually gets built on a lot) is Tier 3.
- **`world/`** — `Lot` (replaces `Tile.js`), `Facility` (a resolved
  building instance), `CityState` (a single city node, with its
  `managed`/`automated` control-mode flag), `CorridorEdge` (inter-city
  connection), and `RegionState` (the top-level country/region container).
- **`trade/`** — `Shipment`, the traceable cargo-carrying entity that makes
  automated trade observable rather than a black box.
- **`budget/`** — `NationalBudget` and `CityBudget`, implementing the
  two-tier allocation model locked in the engine plan.
- **`messages/`** — Worker message-type vocabulary only. Actual
  scheduling/dispatch across `managed` (full-fidelity) and `automated`
  (coarse) cities is Tier 7, not implemented here.
- **`worldgen/`** — Tier 2, both slices now complete:
  - *Single-city slice*: `CityMapGenerator` generates a `CityState`'s
    terrain and resource endowment from a seed. Dependency-free hash-based
    value noise (`ValueNoise2D`) drives elevation and moisture fields that
    classify each `Lot`'s `TerrainType`; each raw resource in
    `DefaultResourceRules` gets its own independent noise field,
    terrain-gated and threshold-clustered into belts, so placement reads as
    real geography rather than a per-tile random roll.
  - *Region/network slice*: `RegionMapGenerator` places city nodes across
    an abstract region space (seeded rejection sampling for minimum
    spacing), generates each node's full `CityState` via `CityMapGenerator`
    with a per-node seed, and connects the network with `CorridorEdge`s —
    a minimum spanning tree for guaranteed connectivity plus a redundancy
    pass for nearby node pairs, not a fully modeled connecting terrain (see
    the locked node-network decision in `COUNTRY_SIM_ENGINE_PLAN.md`). The
    first node defaults to `managed`; the rest start `automated`.
    `summarizeResources()` aggregates a generated city's dominant resources
    for site-selection/UI use, derived from the map rather than generated
    separately.
  - Both are deterministic per seed.

- **`resolution/`** — Tier 3. `ZoneResolver.resolve(city, lot,
  availableResourceIds)` decides what a zoned, undeveloped `Lot` becomes:
  it walks the `RecipeRegistry` for the lot's `zoneType` and returns the
  first recipe that's satisfiable, where "satisfiable" means the lot's own
  resource endowment matches an extraction recipe's output
  (geography-gated, via `geographicResourceIds`), or a zero-input recipe
  with a non-geographic output like housing's labor is simply available
  once zoned, or a processing/manufacturing recipe's inputs appear in a
  caller-supplied `availableResourceIds` set — **and** the recipe's
  `footprintSize` × `footprintSize` area around the lot has room
  (`footprintTiles()`: every tile in bounds, non-water, and not already
  `occupiedBy` another facility). That availability set is a placeholder
  for what Tier 4 will compute from local production + shipments —
  `ZoneResolver` doesn't care where it comes from, only what to do with
  it. One resolver handles every zone type uniformly (residential
  "produces" labor the same way a mine produces ore), replacing the RCI
  growth-stage math and the `zone/Residential.js`/`Commercial.js`/
  `Industrial.js` classes entirely. `developLot()` attaches the resolved
  `Facility` to the lot and claims its whole footprint — every tile gets
  `occupiedBy` set (blocking further zoning there), while only the anchor
  lot holds the `Facility` object itself (`lot.facility`). `footprintSize`
  defaults to 1; `DefaultRecipes.js` sets it to 3 uniformly, matching the
  real renderer's fixed 3×3 building tools (`Base.toolSet`, see
  `RENDERER_INTEGRATION_FINDINGS.md`). `DefaultRecipes.js` is example
  content (mines, farms, a steel/lumber processing chain, housing, retail)
  proving the mechanism, not a final content list. `undevelopLot()` is
  `developLot()`'s inverse — frees every footprint tile's `occupiedBy`,
  clears the anchor's `facility`/`zoneType`, and removes the `Facility`
  from `city.facilities`, making the lots genuinely zoneable again rather
  than just visually cleared. `BulldozeTool` (Tier 5) is the player-facing
  wrapper around it.

- **`trade/TradeResolver.js`** — Tier 4. `TradeResolver.tick()` runs the
  region's economic heartbeat: production/consumption for every developed
  `Facility` (extraction output scales with the lot's `resourceEndowment`
  richness), advancing in-flight `Shipment`s toward delivery, then matching
  fresh demand (facilities below their input buffer target) against fresh
  supply (facilities with output on hand) and creating new `Shipment`s
  routed over `CorridorPathfinder`'s shortest path — throttled by real
  corridor capacity, not an abstract cap. `availableResourceIds(region)`
  is what Tier 3's `ZoneResolver` should be driven by in practice: a
  resource only unlocks processing recipes once something in the region is
  actually producing it.

- **`tools/`** — Tier 5. Tool scope splits by control mode, per the
  round-2 decision:
  - `ZoningTool` — for `managed` cities. `preview()` dry-runs a zoning
    decision (set, resolve, restore) so a player can see what a lot would
    become before committing, satisfying the plan's "surface resource
    endowment... before the player commits." `zone()` commits and attempts
    immediate resolution. `reattempt()` sweeps every zoned-but-undeveloped
    lot in a city and retries resolution - deliberately control-mode
    agnostic, since picking up a lot that couldn't resolve before isn't a
    control decision. Tier 7's orchestrator is expected to call it for
    every city, managed or automated, after each `TradeResolver.tick()`.
  - `TownCharterTool` — for `automated` cities. No tile-by-tile control:
    `apply()` zones a batch of a city's undeveloped lots per call according
    to a `TownCharter`'s industrial/residential/commercial weights (an
    on-site resource always wins toward industrial), using a `SeededRandom`
    for deterministic, replayable growth. `maxLots` caps successful
    developments per call, not lots zoned - unresolved ones stay zoned for
    `ZoningTool.reattempt()` to pick up later.
  - `BulldozeTool` — for `managed` cities, the demolition counterpart to
    `ZoningTool`. `demolish( city, lot )` removes whatever facility
    occupies `lot` via `ZoneResolver.js`'s `undevelopLot()` (the inverse
    of `developLot()`: frees every tile in the facility's footprint, not
    just the anchor, and drops it from `city.facilities`). `lot` can be
    any tile inside a multi-tile facility's footprint, not only its
    anchor - resolved via `Lot.occupiedBy` first, matching how the real
    renderer's own bulldozer (`View.js`'s `testDestruct`) lets a player
    click anywhere on a building to remove it. Throws on an `automated`
    city, same scoping as `ZoningTool`.
  - `FoundCityTool` — places one new city node into an existing region
    network (minimum-spacing enforced, connects to the nearest existing
    cities), generating its map via the same `CityMapGenerator` Tier 2 uses.
    No equivalent exists in the original tool set.

- **`visuals/`** — Tier 6. `CargoVisualRegistry` resolves a `CargoVisual`
  (tint, `ModelVariant`, short label) per resource id, falling back to a
  per-category default (`RAW`/`PROCESSED`) so a resource added later
  without explicit art direction still renders as something coherent
  instead of breaking. `ModelVariant` is deliberately a small fixed set
  (hopper/tanker/flatbed/refrigerated/van/transit) rather than one mesh per
  resource, so cargo sharing a variant can still batch into the same
  `InstancedMesh` - only the tint needs to vary per instance, which lines
  up with the GPU-driven instancing item in
  `docs/GRAPHICS_ENGINE_UPGRADE.md`. `visualForShipment()` is the Tier 7
  wiring point: given a `Shipment` and the region's resource registry, what
  it should look like once shipments are rendered as real traffic
  vehicles. `DefaultCargoVisuals.js` is example content covering every
  resource in `DefaultRecipes.js`, not a final art pass.

- **`orchestrator/RegionOrchestrator.js`** — Tier 7, engine-side half only.
  `tick()` runs `TradeResolver.tick()`, then sweeps every city (any control
  mode) with `ZoningTool.reattempt()` since picking up a previously-blocked
  lot isn't a control decision, then grows `automated` cities via
  `TownCharterTool` - but only on their due tick, not every tick.
  `automatedTickInterval` is the real, verified fidelity knob for the
  "managed cities get full fidelity, automated get coarse" split the plan
  calls for: each automated city is phase-offset by a hash of its id (so
  they don't all land on the same tick) and only grows on roughly 1-in-N
  ticks. Player zoning on a managed city goes through
  `orchestrator.zoningTool` directly - the orchestrator never auto-zones a
  managed city. `tick()` returns a `REGION_TICK` message via Tier 1's
  `tickMessage()` envelope, the first thing in this codebase to actually
  use it.

## Deliberately not here yet

- Tier 7's other half: wiring `TradeResolver`'s `Shipment`s into the real
  `src/traffic` vehicle-agent system (`TrafficWorld`/`Car`/`Road`) and
  `src/city3d` rendering, and replacing `CityGame.js`/`WorkerBridge.js` for
  real. `TrafficWorld` is a browser-coupled module (uses
  `window.localStorage`, assumes one city's coordinate space, has no
  concept of inter-city corridors) - integrating it is real work that
  can't be verified headlessly the way everything above was, and needs an
  actual dev-server/browser pass instead of a Node script.

This is a data-model skeleton meant to unblock those tiers, not a working
simulation on its own.
