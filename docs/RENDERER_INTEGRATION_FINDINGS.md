# Renderer integration findings (Tier 7, the other half)

`docs/COUNTRY_SIM_ENGINE_PLAN.md` scoped Tier 7 as "the region orchestrator
that replaces `CityGame.js`... including wiring `TradeResolver`'s shipments
into the real `src/traffic` vehicle-agent system and `src/city3d`
rendering." The engine-side half of that (`RegionOrchestrator`) is done and
verified headlessly. This doc records what a deep read of the actual
rendering/protocol code found before writing any more integration code,
because it changes the shape of what's left more than expected.

## The existing renderer is not a clean data contract

`src/city3d/View.js` doesn't consume a semantic "zone type + building type"
description — it branches directly on the numeric tile-ID ranges defined by
the GPL `src/micro/Tile.js` (ground `<240`, water `1-5`, water border
`5-21`, trees `21-30`, fire `55-64`, road-valid flag `63-68`, buildings
`≥240` with sub-ranges). An adapter from `src/engine`'s data model would
have to either fake that legacy numbering convention or the renderer needs
real rework to accept something else.

## Three things block the country-sim vision specifically, independent of the engine

1. **Sprites are one-instance-per-type, not per-object.** The vehicle
   sprite system (`View.js`'s `moveSprite`) is keyed by type
   (`1=train, 2=helicopter, ...`) with no per-instance id — it can render
   exactly one of each vehicle type *simultaneously, total*. The core
   "watch many trucks moving between cities" mechanic this whole design is
   built around cannot be shown by this renderer as it stands, no matter
   how good a data adapter is. This needs real new rendering capability.
2. **`src/traffic/` (the real per-vehicle road sim) isn't integrated with
   anything.** It's a disconnected procedural demo that only runs on the
   title screen (`TrafficBase.js`, driven by `View.js`'s intro state) and
   is torn down before gameplay starts. Nothing in `CityGame.js` or the
   Worker protocol references it. "Wire shipments into `src/traffic`" is
   new integration work from zero, not restoring something that already
   worked.
3. **The renderer has no concept of multiple cities.** It's built for
   exactly one city's `tilesData`, sized at generation time. The
   country-sim's core premise — many cities, visible inter-city trade —
   doesn't fit the current renderer's shape regardless of which engine
   drives it.

## Decision: scope the first integration milestone to single-city, no vehicles

Attempting all three at once risked an unverified, partially-working
result given the size of what's involved. The clarifying-question tool was
unavailable when this decision point came up (repeated transient failures),
so this was decided unilaterally rather than blocking — flagged here for
visibility, redirectable if the wrong call.

**Chosen first milestone**: prove `src/engine` can drive something real and
visible before tackling the harder rendering gaps (multi-instance vehicles,
multi-city view). Terrain generation only, no zoning/facilities/vehicles
yet, verified in an actual browser.

## What's done: `dev_engine_mapgen.html`

Mirrors the existing `dev_mapgen.html` convention already in this repo — an
isolated canvas preview, entirely separate from `CityGame.js`/
`WorkerBridge.js`/GPL `src/micro`, so it's zero-risk to the shipping game.
Drives `CityMapGenerator` instead of the GPL `MapGenerator`, colors lots by
`TerrainType`, and tints resource endowment on top so belts read visually
distinct from bare terrain.

Verified with Playwright against a local static server (browsers
pre-installed in this environment; `playwright` installed locally with
`--no-save`, not part of the shipped project): zero JS errors, real varied
canvas output (246 distinct colors on a 128×128 map), and terrain/resource
counts consistent with Tier 2's existing Node-script tests. The screenshot
shows a mountain cluster with an iron-ore belt visibly nested inside it —
geographic clustering working as designed, not scattered noise.

(Note: `dev_mapgen.html` itself references `build/uil.module.js`, a
gitignored local build artifact absent from a fresh checkout — it would
404 the same way `dev_engine_mapgen.html` initially did before that
dependency was dropped in favor of plain HTML controls.)

## What's still open

- Zoning/facility rendering for a single city (extending this preview, or
  a real `View.js` integration path, once a tile-encoding decision is made
  that doesn't require replicating the GPL numeric ID table exactly).
- The multi-instance vehicle rendering the sprite system currently can't
  do — a prerequisite for shipments ever being visible as multiple trucks.
- A multi-city/region view — new UI and camera work, not present in any
  form today.
- Eventually: replacing `CityGame.js` as the Worker's actual entry point
  and repointing `utils/rollup.config.city.js`, once the above make that
  safe to do without regressing the shipping game.
