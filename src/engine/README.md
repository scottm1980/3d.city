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

- **`resolution/`** — Tier 3. `ZoneResolver` decides what a zoned,
  undeveloped `Lot` becomes: it walks the `RecipeRegistry` for the lot's
  `zoneType` and returns the first recipe that's satisfiable, where
  "satisfiable" means either the lot's own resource endowment matches an
  extraction recipe's output (geography-gated, via `geographicResourceIds`)
  or, for a zero-input recipe with a non-geographic output like housing's
  labor, it's simply available once zoned; processing/manufacturing
  recipes resolve once their inputs appear in a caller-supplied
  `availableResourceIds` set. That set is a placeholder for what Tier 4
  will compute from local production + shipments — `ZoneResolver` doesn't
  care where availability comes from, only what to do with it. One
  resolver handles every zone type uniformly (residential "produces"
  labor the same way a mine produces ore), replacing the RCI growth-stage
  math and the `zone/Residential.js`/`Commercial.js`/`Industrial.js`
  classes entirely. `developLot()` attaches the resolved recipe's
  `Facility` to the lot. `DefaultRecipes.js` is example content (mines,
  farms, a steel/lumber processing chain, housing, retail) proving the
  mechanism, not a final content list.

## Deliberately not here yet

- The trade/logistics resolver that matches supply and demand, computes
  real `availableResourceIds` per city, and creates `Shipment`s (Tier 4),
  plus the observability queries built on top of it.
- Tools (Tier 5), cargo-sprite visuals (Tier 6), and the region orchestrator
  that replaces `CityGame.js` (Tier 7).

This is a data-model skeleton meant to unblock those tiers, not a working
simulation on its own.
