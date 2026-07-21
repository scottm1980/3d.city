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

## What's also done: `dev_engine_city.html`

Extends the terrain-only proof to the full single-city loop: generation →
zoning → facility resolution → trade production, all from `src/engine`. The
city is `AUTOMATED` and driven by `RegionOrchestrator` (the same mechanism
already verified in the Tier 7 capstone test), so this page proves that
pipeline is real and visible, not just something a Node script asserted.
Developed lots are colored by their facility's primary output resource,
reusing Tier 6's `CargoVisualRegistry` tints rather than a separate palette.

Verified via Playwright: zero JS errors, real growth (430 facilities across
6 archetypes, ~2,300 shipments delivered on a default 60-tick run), and —
more rigorously than a screenshot — exact pixel-level verification that
facility color blending matches the expected math by hand (a sawmill lot's
rendered `[196,150,93]` is precisely an 80% blend of desert terrain toward
lumber's tint `0xc08a52`). Confirms the resolution → recipe → cargo-visual
→ pixel chain is wired correctly end to end, not just plausible-looking.

## What's also done: `dev_engine_region.html`

Proves the two hardest rendering gaps are solvable in principle: a
multi-city region view (cities as nodes sized by facility count,
corridors as lines colored/thickened by real-time load-vs-capacity) and
many concurrent vehicle instances (every in-transit cross-city `Shipment`
rendered as its own moving dot, animated live via `setInterval`-driven
`orchestrator.tick()` calls, tinted by Tier 6's cargo visuals). Still a
flat 2D canvas, zero involvement from `CityGame.js`/`WorkerBridge.js`/GPL
`src/micro`.

Caught and fixed a real bug via browser verification that static review
missed: `visualForShipment` was imported from the wrong module
(`DefaultCargoVisuals.js` instead of `CargoVisual.js`, where it's actually
defined) — a silent runtime failure that wouldn't have shown up without
actually loading the page.

Verified via Playwright: zero JS errors, and a stable 111–122 concurrent
visible shipments sampled across 10 frames over 3 seconds (not a one-off
spike). The screenshot shows dots queued densely along corridor lines like
real freight traffic, visibly congesting between cities — the exact
"watch a real bottleneck" mechanic the whole design was chasing.

## What's also done: `dev_engine_region_3d.html`

The first dev preview to use the project's real Three.js vendor code
(`src/three`, `src/jsm/controls/OrbitControls.js`) instead of a flat 2D
canvas — answering the concrete technical question behind the multi-vehicle
work: can a single `InstancedMesh` represent hundreds of independently
positioned, independently colored, independently moving shipments at once?
That's the actual fix for the real sprite system's one-instance-per-type
limitation. Cities render as spheres sized by facility count and tinted by
control mode, corridors as lines colored by real-time load-vs-capacity,
every in-transit cross-city shipment as an `InstancedMesh` instance tinted
by Tier 6's cargo visuals, unused capacity hidden via zero-scale matrices.

Verified with software-rendered WebGL (`--use-gl=swiftshader`, since
headless Chromium has no GPU): zero JS errors, real WebGL context, and a
screenshot confirming correct 3D positioning matching the 2D version's
topology. For the vehicle instances specifically — too small to visually
confirm color under lighting from a screenshot — verification went past
pixels and read the actual `instanceMatrix`/`instanceColor` GPU buffers
directly, checked against the engine's own data: rendered instance count
(95) exactly matched in-transit cross-city shipment count (no
truncation/off-by-one), every sampled instance's color matched its
`CargoVisual` tint to floating-point precision, positions were finite and
in-bounds, and unused capacity was correctly hidden.

## What's also done: `dev_engine_view3d.html`

The first dev preview to drive the game's **real** production rendering
code (`src/city3d/View.js`, `Hub.js`) instead of hand-rolled canvas or
Three.js. Deliberately never calls `Main.init()` or `Main.initWorker()` —
no Worker is booted, GPL `CityGame.js` is never loaded or executed. Only
`View`/`Hub`/`AppState` are constructed directly, and `AppState.tilesData`
is fed from `CityMapGenerator` through a minimal tile-value adapter using
`Tile.js`'s own documented constants (`RIVER=2` for plain water, `DIRT=0`
for plain ground — read for interop, not reused as logic) instead of a
`WorkerBridge` message. Water vs. ground only for this first pass — no
shoreline blending, trees, or buildings yet.

Two real bugs found and fixed via actual browser verification, not code
review: `initRenderer()` unconditionally calls `AppState.main.start()`
assuming `Main.init()` already ran (fixed with a no-op stub, since the real
`Main.init()` would boot the Worker/`CityGame.js` this harness exists to
avoid), and the real game's title/menu overlay stays visible until
whatever normally clears it runs — this harness skips that, so an explicit
`view3d.clearIntro()` call was added.

Verified with software-rendered WebGL: zero JS errors, `paintMap()`
completes with tile counts matching exactly (222 water + 8994 ground =
9216 = 96×96). The screenshot was partially obstructed by a separate
`Pool.js` loading-status overlay unrelated to rendering correctness (not
chased down — cosmetic, not a correctness question), so verification went
past pixels and inspected the real Three.js scene graph directly instead:
`AppState.view3d.land` contains exactly 36 real textured `Mesh` chunks,
precisely matching `(96/16)² = 36` — the actual 16×16-tile chunked
texture-atlas architecture documented above, not a coincidence. Confirms
the production rendering pipeline genuinely painted `src/engine`'s terrain
data using its real texture system.

## Richer tile encoding: trees added, confirmed real

Extended the water/ground-only pass to FOREST terrain using `Tile.js`'s
own documented constants (`TREEBASE=21`..`LASTTREE=36`), read for interop
with the renderer's value contract, not guessed. Confirmed via `View.js`'s
own `drawLayer()` (MIT code) that tree values 21-29 skip ground-texture
drawing entirely and route through a separate real 3D mesh pipeline
(`addTree` → `populateTree` → `buildMeshLayer`), not a flat texture like
water/ground.

Verified past the tile-count check into the rendering pipeline's own
bookkeeping: `view3d.treeLists` contains exactly 861 entries, an exact
match against the 861 tree tiles emitted (not a coincidence), and 15 of
the 36 chunk layers built real merged tree geometry (129 to 8,414 vertices
each, 31,378 total), every one confirmed present in the actual Three.js
scene with a real material.

**Shoreline blending was traced but deliberately not attempted.** Cleared
of licensing concern — `Zone()`/`ZoneExtand()` (`src/city3d/Base.js`) are
MIT code, not GPL — but it's real complexity: the water-border value range
(5-20) drives height-map deformation intertwined with several special-cased
branches (`v===13/14`, `v===9/10`, `v===11/12`, `v===7/8`, `v===15/16` each
doing something different), and getting the neighbor-to-tile-ID
orientation table right needs either authoritative documentation (not
found in `Tile.js`'s constants alone — the individual 5-20 IDs aren't
individually named) or empirical per-value testing, neither pursued here.

## Buildings: real, but surfaced a genuine data-model mismatch

`dev_engine_view3d_buildings.html` proved building placement — a
genuinely different integration path than terrain. The "MESH BUILD" tile
range (`≥240`) isn't driven by `tilesData` values; it's driven by direct
method calls (`view3d.build(x,y)`) using whichever tool is selected
(`view3d.selectTool(id)`), reading a small fixed catalog of ~13 building
model variants (`Base.toolSet`, MIT code in `src/city3d/Base.js`).

**Surfaced rather than papered over**: `Base.toolSet`'s building tools use
a fixed 3×3 footprint centered on `(x,y)` (confirmed via `Base.js`'s
`Zone()` function, MIT code), which `src/engine`'s `Lot` model (1 lot = 1
facility, no footprint/adjacency concept) doesn't natively account for.
This preview sidesteps the mismatch by placing facilities on a
deliberately spaced grid (4-tile spacing) rather than the dense output
`RegionOrchestrator` actually produces — it proves building geometry
renders correctly, not yet a real footprint-aware placement policy. That
gap is now explicit, not assumed away.

**A licensing line drawn deliberately**: while researching shoreline
blending, `MapGenerator.js`'s `riverEdge[16]` lookup table was located
(the exact table needed) but its values were not read. A 16-entry data
table mapping neighbor-bitmask patterns to specific tile IDs is GPL
creative expression, not just a numeric interface contract like
`DIRT=0`/`RIVER=2`/`TREEBASE=21` (which are individually-named, minimal
constants). Shoreline blending will need independent empirical derivation
against the real renderer's output instead of reading that table.

Verified via Playwright: zero JS/console errors, 518 facilities
zoned/resolved/built across the spaced grid (173 residential, 173
commercial, 172 industrial). Verified past the build count into the
pipeline's own bookkeeping: `view3d.buildingLists` has exactly 518
entries, all 36 chunk layers built real geometry (86,062 vertices total,
confirmed present in the scene), and sampled entries' building-type codes
(244/427/616) exactly match `Base.R`/`Base.C`/`Base.I`'s first elements —
residential, commercial, and industrial each routed to the correct model
family.

## Footprint-aware building placement: fixed for real

The data-model gap flagged above is closed. `src/engine` now knows about
multi-tile footprints: `Recipe.footprintSize` (default 1, set to 3 across
`DefaultRecipes.js` to match `Base.toolSet`'s fixed 3×3 building tools),
`Lot.occupiedBy` (set on every tile of a placed facility's footprint, not
just the anchor — `isDeveloped` now reflects this), `Facility.footprint`
(every `Lot` it occupies), and a new `footprintTiles(city, lot, size)` in
`ZoneResolver.js` that `resolve()` consults before returning a recipe —
rejecting it if the footprint would go out of bounds, cross water, or
overlap another facility.

Verified past "doesn't crash" into the actual correctness property: a
headless test zoned every non-water lot in a city at 1-tile density (a
maximally overlap-prone stress test) and confirmed, by construction, zero
overlapping footprints among everything that got placed. The full Tier
4/7 regional-growth regression (75 ticks, multiple cities) still passes
with zero footprint overlaps region-wide. `dev_engine_view3d_buildings.html`
was updated to match: the synthetic 4-tile-spaced placement grid was
replaced with a dense, deliberately overlap-prone 2-tile grid (2,074
candidate attempts) routed through the real renderer, and the engine's
own clearance check correctly rejected 1,555 of them, placing 519 with
zero overlaps — confirmed both by the harness's own overlap check and by
`view3d.buildingLists`' exact entry count (519) and real geometry (86,154
vertices, all confirmed in-scene). The building preview screenshot is now
genuinely readable: colored R/C/I markers spread across the ground in a
clean, non-overlapping grid.

## Loading overlay: found and fixed

The `Pool.js` loading-status overlay flagged as open in the last two
milestones has a real fix, found while researching shoreline tiles:
`Hub.start()` — not `View.clearIntro()` — is what actually fades out and
removes the `"Loading 3d models..."` DOM overlay, via its own
self-contained `setInterval` timer with no Worker/`CityGame.js`
dependency. `clearIntro()` only ever removed the 3D scene's title/border
objects and the menu buttons (`clearStartHub()`); the loading overlay
itself is a separate DOM element (`Hub.full`) that `Hub.start()` owns.
Both `View.js`-driving previews now call it and produce genuinely
unobstructed (or near-unobstructed, fade-timing permitting) screenshots.

## Shoreline blending: substantial research, still unresolved

Made real progress but did not ship an implementation. Located the exact
texture atlas (`assets/textures/tiles.png`) and its precise slicing
formula via `Pool.js`'s `makePixelData()` (32px cells, column = `id % 32`,
row = `floor(id / 32)`), and confirmed the atlas-to-render texture copy is
direct and unrotated (`copyTextureToTexture`, no transform), meaning atlas
pixels are a faithful, first-hand preview of actual render output —
reading them is looking at a game asset image, not GPL code. Visually
classified the water-border tile range (5-20): solid land (4-9, 18, 20),
solid water (15, 17), several north-edge-like wavy shapes (10-13), and a
few diagonal corners (14, 16, 19).

**What's still missing**: only about 6 of the 16 possible neighbor
orientations are visually distinguishable in this range — no clear south,
east, or west straight edges, and no rotation mechanism was found in the
renderer code that would explain filling the gap at render time. Which
world-space direction the image's "up" corresponds to is also still
unconfirmed — an attempt to resolve this with a live, controlled
water/land test render got entangled with the loading-overlay issue above
(now fixed) and wasn't completed before time ran out on this pass.

**Deliberately not pursued**: `MapGenerator.js`'s `riverEdge[16]` lookup
table, which would very likely answer the orientation question directly.
That table is GPL creative expression — a specific 16-entry data
structure encoding tile-orientation logic — not a minimal, individually-
named numeric constant like `DIRT=0`/`RIVER=2`/`TREEBASE=21`. Shoreline
blending needs either a completed live-render empirical test (the
loading-overlay blocker is now resolved, so this is unblocked for a
follow-up) or acceptance of partial/asymmetric coverage.

## Shoreline blending, round 2: real obstacles, still unresolved

With the loading-overlay fix in hand, made a second attempt: built a
4-quadrant test map placing the same candidate tile id with water at each
of the 4 cardinal `tilesData` neighbor directions in one scene, so only
the correctly-oriented quadrant should show a seamless edge — a
decisive, single-screenshot test in principle.

Hit two compounding, genuine obstacles in this environment rather than a
knowledge gap:
1. A near-vertical camera angle (`cam.vertical` close to 90) breaks the
   water plane's geometry (`THREE.BufferGeometry` NaN bounding-box/sphere
   warnings) — reverted to default angles, which come with more
   perspective distortion and make edge orientation harder to read
   cleanly at a distance.
2. Software-rendered WebGL (`swiftshader`, no real GPU in this sandbox)
   runs this scene at ~2 FPS, and the loading overlay's fade-out (an
   `setInterval`-driven timer) did not reliably complete even after 9+
   seconds of wait — plausibly because the interval competes with a main
   thread this saturated. Screenshots stayed tinted/darkened by the
   still-visible overlay, and cropped close-ups of the water/land
   boundaries were too low-fidelity at this distance and lighting to
   confidently distinguish "wavy shoreline blend" from "plain straight
   edge" — exactly the distinction this test exists to make.

Started down a more precise alternative — reading the composited ground
texture (`MAT_LAND[layer].map`, a GPU-copy destination written by
`copyTextureToTexture`) directly via a WebGL render-target readback,
bypassing screenshot lighting/compression entirely — but did not complete
it; it needs lower-level renderer API work disproportionate to spend
further on this one cosmetic feature right now, next to everything else
this session accomplished.

**Honest conclusion**: shoreline blending is not a knowledge gap anymore
(the atlas, slicing formula, and partial shape classification are solid,
documented above) — it's blocked on reliably verifying world-space
orientation in this specific software-rendering sandbox. The right next
attempt is either the texture-readback approach (precise, avoids the
rendering-fidelity problem entirely) or running the verification
somewhere with real GPU-accelerated WebGL.

## Multi-city + vehicles ported into the real View.js scene

`dev_engine_view3d_vehicles.html` ports the work from the standalone
`dev_engine_region_3d.html` into `View.js` itself. `View.js`'s internal
state (`this.land`, `mapSize`, `AppState.tilesData`) is fundamentally
single-map-shaped — there's no "second city" slot without refactoring
`View.js`, which this deliberately does not attempt. Instead: two real
cities are placed side by side inside **one combined `tilesData` grid** (a
gap of plain ground stands in for the corridor), so `View.js` renders both
through its completely unmodified real terrain/building pipeline. A real
2-city `RegionState` (`CorridorEdge`, `TradeResolver`,
`RegionOrchestrator`, `ZoneResolver`'s footprint clearance — all proven
Tier 1-7 code) drives an actual mine-city/mill-city trade scenario, and
every in-transit cross-city `Shipment` renders as an `InstancedMesh`
instance added directly to `view3d.scene`, colored by Tier 6's cargo
visuals.

Caught a real bug via verification: a hardcoded steel_mill test-lot
position sat inside another facility's footprint claimed by the dense
placement grid, so it never resolved — footprint clearance was correctly
blocking it. Fixed by searching for an actually-clear spot with
`footprintTiles()` after placement runs, rather than guessing a position.

Verified past summary counts into **complete** instance-buffer inspection
— not a sample: every active vehicle instance in one run (21 of them)
checked individually, positions matching their expected interpolation
between the real city anchors to floating-point precision, confirmed as
21 distinct shipment ids (not a duplicate-reading artifact), with genuine
variety in commodity/progress values.

**Noted honestly**: the water plane appears oversized/misaligned for the
non-square combined map used here (104×40) — `View.js`'s water plane was
very likely only ever exercised against the square maps the game
normally uses (64/128/192). Cosmetic, not a correctness issue for the
vehicle/multi-city proof itself, but a real finding for whoever tackles a
non-hacky multi-city region view later.

## Water-plane sizing quirk: fixed, a real `View.js` bug

The "noted honestly" item above turned out to be a genuine latent bug in
existing MIT `View.js` code, not a cosmetic quirk to live with. Two spots
used `this.mapSize[0]` (map width) where `this.mapSize[1]` (map depth) was
needed:

- The water plane's `translate()` call offset its z-axis by
  `(this.mapSize[0]*0.5)-0.5` instead of `(this.mapSize[1]*0.5)-0.5`.
- The tree edge-height-clamping check compared `y` against
  `this.mapSize[0]-1` instead of `this.mapSize[1]-1`.

Both are invisible on every map the shipping game actually generates,
since `width === height` there always (64/128/192) — `mapSize[0]` and
`mapSize[1]` are numerically identical, so the bug can't produce a
different result. It only surfaced because this integration work's
104×40 combined two-city map is the first non-square `tilesData` shape
`View.js` has ever been driven with.

Fixed both one-line instances directly in `src/city3d/View.js`. Verified
two ways:
- **Zero regression on square maps**: re-ran `dev_engine_view3d.html` and
  `dev_engine_view3d_buildings.html` after the fix and confirmed
  byte-identical output to before it (`waterCount:222, treeCount:861,
  groundCount:8133`; `builtCount:519, overlapCount:0`) — the fix is a
  true no-op when width equals height, as expected.
- **The actual fix, on the non-square map**: re-ran
  `dev_engine_view3d_vehicles.html` and called
  `view3d.water.geometry.computeBoundingBox()` directly on the live
  scene object. The water plane now measures exactly `width:104,
  depth:40`, matching `mapSize=[104,40]` precisely — previously it was
  oversized/misaligned along one axis.

## Real vehicle geometry per ModelVariant, replacing the tinted-box placeholder

`dev_engine_view3d_vehicles.html`'s vehicle layer previously shared one
`BoxGeometry` `InstancedMesh` across every commodity, differing only by
per-instance tint — proving the InstancedMesh mechanism, not the actual
visual gap Tier 6's `ModelVariant` set (`HOPPER`/`TANKER`/`FLATBED`/
`REFRIGERATED`/`VAN`/`TRANSIT`) was designed to close. Closed that gap:
one `InstancedMesh` per variant now, each with a genuinely distinct
primitive silhouette (a tapered hexagonal `CylinderGeometry` for hopper
cars, a horizontal cylinder for tankers, low/boxy/compact `BoxGeometry`
variants for flatbed/refrigerated/van/transit) — simple Three.js
primitives, not ripped assets, so no licensing question. All six share
one `MeshStandardMaterial` (vertex-colored) so per-instance tinting still
works exactly as before; only geometry now varies per variant instead of
being uniform. Vehicles also now face their direction of travel
(`dummy.rotation.y` from the segment's direction), a small but real
correctness improvement over the previous unrotated boxes.

Per-variant instance budgets replace the old single shared cap (40 each
instead of one pool of 200), and each mesh's unused instances are hidden
the same zero-scale-matrix way as before, now tracked per mesh instead of
globally.

Verified past "it renders" into per-mesh, per-instance correctness: all
six `InstancedMesh` objects confirmed live in `view3d.scene`
(`mesh.parent !== null`) with the intended distinct geometry
(`CylinderGeometry` for hopper/tanker, `BoxGeometry` with the intended
per-variant vertex counts for the rest). A full (not sampled) sweep of
every instance's raw `instanceMatrix.array` per mesh confirmed the
"visible" count (non-zero-scale entries) exactly matches the
`renderedByVariant` bookkeeping the simulation itself reports for every
variant, including the zero-count variants (tanker/refrigerated/van
weren't produced by this particular mine/mill scenario, and correctly
rendered zero instances rather than stale leftovers) — in one sampled
run: 9 hopper (iron ore + coal), 12 flatbed (steel), 7 transit (labor
commuting between the two cities, an emergent cross-city flow this
scenario didn't explicitly script), 28 total, zero JS/console errors.

## Camera controls: already real, not a gap

While scoping the vehicle-geometry work, confirmed the "Hub UI/camera
integration" item previously listed as open is largely already solved
for free: `View.js`'s own `initRenderer()` (called by every `View.js`-
driving preview already) registers real mouse/touch/wheel event
listeners and starts `renderer.setAnimationLoop(animate)`, which calls
`updateCamera()` every frame — the exact same orbit/pan/zoom/momentum
camera the shipping game uses is already live and interactive in these
dev previews, with no extra wiring needed. What's still missing is Hub's
actual DOM UI chrome (tool palette, menus) and a first-class multi-city
region view, not camera control itself.

## Real player interaction: the real Hub UI driving src/engine, not CityGame.js

`dev_engine_view3d_vehicles.html` was, until now, a replay — the player
could look and orbit the camera, but every facility came from the
simulation's own scripted growth. Closed that gap for real: the actual
game UI now drives actual player zoning through `src/engine`.

- `AppState.hub.initGameHub()` constructs the shipping game's real
  `Hub_Top`/`Hub_Build` DOM UI (`src/city3d/hub/`, MIT code) — the same
  BUILD/SERVICE tool palette, population/money/score/happiness panels,
  and top menu bar the real game uses. No synthetic UI built for this;
  it's the genuine article, unmodified.
- `AppState.main` — previously two no-op stubs — now implements
  `selectTool(id)` (forwards to `view3d.selectTool`, matching what
  `Hub_Build`'s buttons already call) and `mapClick(toolName)`
  (`handlePlayerMapClick`): reads `view3d.raypos` (View.js's own,
  already-proven raycasting), maps world coordinates into Steeltown's
  local lot space, and — only for `residential`/`commercial`/
  `industrial`, the three zone types `src/engine` actually models —
  calls `orchestrator.zoningTool.zone(...)`. Every other real tool
  (road, power, services, ...) is accepted by the genuine UI without
  crashing but intentionally no-ops, since the engine doesn't model
  them yet; that's a scope boundary, not a bug.
- Only Steeltown (the `MANAGED` city) accepts player zoning — clicking
  in Ironhaven (`AUTOMATED`) is rejected with an explicit status
  message, matching the round-2 control-mode decision that automated
  cities grow via `TownCharterTool`, not direct player input.
- `syncNewBuildings()` replaces the old one-shot `placeBuildings()` and
  the ad-hoc single-lot re-check this file used to have: every tick (and
  once at startup) it renders any facility that exists in the engine but
  hasn't been drawn yet, tracked via a `renderedFacilityIds` set so it's
  idempotent. This covers all three ways a facility can now appear —
  pre-seeded resource lots, `RegionOrchestrator`'s own automated growth,
  and direct player clicks — with one mechanism instead of three, and
  incidentally deleted a redundant manual resolve-check that duplicated
  what `orchestrator.tick()`'s own `zoningTool.reattempt()` sweep already
  does for every control mode.
- Because `view3d.build()` reads `view3d.currentTool` as an implicit
  argument, `syncNewBuildings()` restores the player's actually-selected
  tool afterward (tracked in `currentPlayerToolId`) so a mid-drag
  simulation tick can't silently swap the player's active tool out from
  under them.

Verified via Playwright, driving the exact same entry points a real
click does (`AppState.main.selectTool`/`.mapClick`), with `raypos` set
directly to isolate this change from the already-proven raycasting math:
zero JS/console errors; a genuinely clear lot (found via the same
`footprintTiles()` check `zoningTool.zone()` itself uses, not guessed)
went from undeveloped to a resolved `housing` facility in one click,
`millCity.facilities.size` and `view3d.buildingLists`' real entry count
each increased by exactly 1 (engine state and the actual rendered scene
agree); a second click on the now-developed lot correctly changed
neither; and a click inside Ironhaven was correctly rejected with the
expected status message. A screenshot confirms the real BUILD panel,
top bar, and population/money/score/happiness readouts are genuinely
present and rendered, not just constructed in the DOM.

## Demolition: BulldozeTool, closing a gap the engine never had

The interactive milestone above could zone but not un-zone — `src/engine`
had no way to remove a facility at all, so the real bulldozer tool (id 8,
already present in `Base.toolSet` and the real BUILD panel) was a dead
button with nothing behind it. Closed for real, not stubbed out:

- `ZoneResolver.js` gained `undevelopLot( city, lot )`, the inverse of
  `developLot()`: frees every tile in the facility's footprint (not just
  the anchor), clears the anchor's `.facility`/`.zoneType`, and removes
  the `Facility` from `city.facilities` — the lots become genuinely
  zoneable again, not just visually cleared.
- `src/engine/tools/BulldozeTool.js` (Tier 5, new) is the player-facing
  wrapper: `demolish( city, lot )`, same `managed`-only control-mode
  scoping as `ZoningTool` (throws on an `automated` city). `lot` can be
  any tile inside the footprint, not just the anchor — resolved via
  `Lot.occupiedBy` — matching how `View.js`'s own `testDestruct` lets a
  real player click anywhere on a building to remove it.
- `RegionOrchestrator` now constructs `this.bulldozeTool` alongside
  `this.zoningTool`, following the same "player-driven, orchestrator
  never touches it directly" pattern.
- In the preview, `AppState.main.mapClick('bulldozer')` resolves the
  clicked lot, calls `orchestrator.bulldozeTool.demolish(...)` to update
  `src/engine` state, drops the removed facility's id from
  `renderedFacilityIds` (so a future building on the same tiles isn't
  mistaken for already-rendered), then calls the real
  `view3d.build(x,y)` — which internally runs `View.js`'s own
  `testDestruct()`, the actual mesh/geometry removal the shipping game
  itself uses, unmodified.

Verified two ways. Headlessly first (a plain Node script, not committed,
matching this repo's existing test-script convention): develop a lot,
demolish it via a non-anchor footprint-edge tile, confirm the facility is
gone from `city.facilities`, every footprint tile's `occupiedBy` is
freed, the anchor's `zoneType` resets, re-zoning the same footprint
immediately resolves a *new* facility with a fresh id, demolishing an
already-empty lot is a safe no-op, and demolishing in an automated city
throws. Then in the real browser, driving the actual
`selectTool`/`mapClick` entry points: zoning a lot (facility count and
`view3d.buildingLists`' real entry count both +1) → bulldozing it via a
different footprint tile (both −1, `lot.isDeveloped` false, `zoneType`
`none`) → bulldozing again (no change, confirmed against the pre-tick
snapshot to avoid the live 200ms simulation interval's own independent
growth confounding the count) → re-zoning the identical tiles as a
different zone type (both +1 again, resolving to a genuinely different
archetype — `retail` this time, not the earlier `housing` — proving the
footprint was actually freed, not left in a stale state). Zero
JS/console errors throughout.

## The budget system went from inert data to a real, load-bearing gate

`src/engine/budget/` had existed since Tier 4 but did nothing: `NationalBudget`/
`CityBudget` were constructed and attached to every `CityState`, and nothing
ever read or wrote them. Zoning was effectively free. That's fixed for real
(full technical writeup in `src/engine/README.md`'s `budget/` section) - the
locked "national treasury pools revenue and allocates funding to each city"
decision is now something the simulation actually does every tick, and
`ZoneResolver.resolve()` gates development on `Recipe.buildCost` against a
city's live `CityBudget.totalFunds`.

This surfaced a real ordering bug in `dev_engine_view3d_vehicles.html`
specifically, worth recording because it's the kind of thing that only
shows up once a system stops being a no-op: the steel_mill test lot was
previously zoned *after* `fillCity()`'s dense R/C/I grid, on the theory
that doing so guaranteed a footprint genuinely clear of what the grid had
already claimed. That was fine when zoning was free. Once it costs real
money, the ordering meant `fillCity()`'s cheaper candidates (housing at
$80 vs. steel_mill's $350) could claim Steeltown's founding grant first,
every tick, indefinitely - starving the one facility this whole demo
exists to prove works. Fixed by force-placing the steel_mill lot (via
`developLot()` directly, not `resolver.resolve()` - its inputs can't be
"available" yet this early regardless of budget, so a normal resolve
would always fail here) *before* `fillCity()` runs, reserving both the
footprint and the budget slot while the grant is still intact - the same
"guaranteed test fixture" spirit as the mine city's `ResourceEndowment`
overrides, just via direct placement instead of a data override.

The preview's status line and player-facing messages now surface
`treasury`/`mineAllocation`/`millAllocation`, and `millSteelMillResolved`
(facility exists, which is now trivially true from tick 0 given the
force-placement above) was replaced with `millSteelMillActive`
(`FacilityStatus.ACTIVE`, meaning it has genuinely consumed a real
shipment of iron_ore and coal) - the signal that's actually still
diagnostic now.

Verified headlessly first (a plain Node script, not committed): a new
city gets a founding grant and can build its first (affordable) facility
off it alone; an expensive recipe is correctly blocked at low funds and
resolves the instant funds arrive, with no other state disturbed;
`NationalBudget.tick()`'s weighted allocation splits correctly
proportional to facility count; and a full 75-tick automated-growth
regression (mirroring the real preview's scenario) still grows past its
seeded facilities under real budget constraints, with treasury and every
city's allocation staying non-negative throughout. Then in-browser:
before the ordering fix, cross-city vehicle rendering stayed at 0 for the
first several seconds (no ore/coal demand existed yet because the mill
lot was starved); after it, hopper-variant vehicles were rendering by
tick 1, and the steel mill reached `FacilityStatus.ACTIVE` by tick 18 -
confirming the full mine-demand → shipment → mill-consumption loop works
end to end under real money constraints, not just when zoning was free.
Zero JS/console errors throughout.

## corridor.load: another inert field, found while auditing for more of the same

Auditing the rest of `src/engine` for the same "documented as owned by a
system, never actually written" pattern the budget system turned out to
have (see above) found one more: `CorridorEdge.load` (`world/CorridorEdge.js`)
is commented "current throughput this tick, owned by the Tier 4 trade
resolver," but `TradeResolver` never wrote it - it stayed permanently 0.
This isn't cosmetic: `TradeResolver.js`'s own top-of-file comment states
the point of the whole module is that "a congested route is a visible,
diagnosable bottleneck," and `dev_engine_region.html`'s corridor
coloring/thickening (documented earlier in this file as a verified
feature) reads `corridor.load` directly - meaning that visualization has
been silently rendering every corridor as if it carried zero traffic
regardless of actual congestion, since the milestone that supposedly
proved it worked.

Fixed in `TradeResolver._matchNewShipments()`, which already builds a
`reserved` map (corridor id → quantity reserved by every in-transit
shipment, including the ones just matched that same tick) purely to
enforce capacity while creating new shipments - the exact number
`corridor.load` should be. One line writes it back at the end of the
method.

Verified headlessly with an independent cross-check, not just "it's
non-zero": a two-city mine→mill scenario ticked 20 times, confirming
`load` starts at 0, goes positive once ore/coal start shipping, never
exceeds the corridor's own `capacity` (the same clamp shipment-matching
already enforces), and - the real proof - exactly matches a from-scratch
recomputation summing `quantity` across every currently in-transit
shipment whose `path` includes that corridor, on every tick checked, not
just the end state. Then re-ran `dev_engine_region.html` (a real 6-city
`RegionMapGenerator` scenario, now also running under the budget gating
above) for 20 ticks: zero JS/console errors, 40 facilities grown, 10
shipments in transit - confirming the fix doesn't disturb the existing
region-view integration, though the browser check couldn't inspect
`corridor.load` directly (it's closed over the preview's own module
scope, not exposed to `window`) - the headless test is what actually
proves this fix correct; the browser pass proves it doesn't regress
anything.

## Shoreline blending, round 3: real progress, still not shippable

Picked back up with a fresh angle rather than repeating round 2's
blocked approach. Two genuine advances, one still-open contradiction -
recorded precisely rather than rounded up to "solved."

**Fixed a real misunderstanding of `View.js`'s camera, found by re-
deriving the math instead of trusting the earlier assumption.**
`View.js`'s `Orbit(origin, horizontal, vertical, distance)` uses
`vertical` as the polar angle from +Y (standard spherical coordinates):
`p.y = distance*cos(vertical)`, `p.x/p.z = distance*sin(vertical)*...`.
That means a HIGH `vertical` (near `CAM_V_MAX=87`) is a near-horizontal
grazing shot, and a LOW `vertical` (near `CAM_V_MIN=5`) is near-overhead
- the opposite of what the name suggests at a glance, and the opposite
of what round 2's attempt assumed. A first test at `vertical=80` (meant
to be "steep") produced exactly the grazing, unusable shot that implies;
correcting to `vertical≈15-18` immediately produced genuinely readable
top-down screenshots showing real, distinct polygon shapes per water-
border tile - a categorical improvement over every prior round, where
water was barely visible at all. This is a durable, reusable finding for
any future top-down rendering work in this codebase, independent of
whether shoreline blending itself gets finished.

**Found the actual compass-direction labels for two tile IDs directly in
source comments - not a guess, not the avoided GPL table.** Reading
`Base.js`'s `Zone(size, x, y, v)` (MIT code) for an unrelated reason
turned up an explicit compass legend in its own comments (`-Y=N, +Y=S,
-X=W, +X=E`) and two directly-labeled cases: `v===5||6 // S` and
`v===13||14 // N`. Cross-referencing `View.js`'s height-deformation code
(`if(v>4 && v<21)` block, around the `initRenderer`/`paintMap` height
pass) confirms the mechanism: `13/14` *lowers* the tile's bottom-edge
vertices (the -Y/north-facing edge) to reveal water there, while `5/6`
*raises* that same edge back to land height - two complementary tiles
for opposite sides of the same shoreline segment. This is genuinely
interop-safe: a directional comment on rendering code, structurally no
different from reading `TREEBASE=21`/`RIVER=2`, not the `riverEdge[16]`
neighbor-to-tile lookup table this investigation has deliberately never
read.

**Reasoned out (not confirmed) the E/W pair by the same method.** The
disabled/commented-out `v===9||10` case lowers the tile's *left*-edge
vertices (-X/west-facing edge) - the same geometric pattern as the
confirmed `13/14=N` case, just on the perpendicular axis - and `17/18`
raises that identical vertex pair, mirroring how `5/6` complements
`13/14`. By direct structural analogy (the same derivation method that
correctly predicted the two confirmed labels): **`9,10` = West, `17,18`
= East**. This is a well-grounded hypothesis, not a wild guess, but it
is not independently confirmed the way `13/14`/`5/6` are.

**The empirical render test of that hypothesis was inconclusive, and
that's reported honestly rather than glossed over.** Built a corrected
version of round 2's test (fixed camera angle, plus an explicit bright
marker mesh placed at each water-neighbor's exact world position so
"where is the neighbor" never has to be inferred from pixel-offset math)
and tested ID 10 against all four cardinal directions. The N/S tests
showed a plausibly continuous water shape; the E/W tests showed a visible
gap between the marker and the rendered water. Taken at face value this
contradicts the West-prediction for ID 10 - but a single isolated water
tile next to a border tile, with land on every other side, may simply not
be enough context for this renderer's height/water-plane system to
produce a clean result regardless of which ID is "correct" (the
`Zone()`/height-deformation code clearly expects multi-tile combinations,
not one tile in isolation), and screenshot fidelity under software
rendering remains a real confound as in every prior round. Rather than
pick a side, this is left as an open contradiction for whoever continues
this: trust the source-derived reasoning (which correctly predicted both
confirmed labels) or trust the render test (which may be an artifact of
an under-specified test map), and resolve it with either a richer test
map (a real multi-tile pond, not an isolated water tile) or the texture-
readback approach round 2 proposed.

**Net state**: `13,14=North` and `5,6=South` are confirmed and usable.
`9,10=West`/`17,18=East` are a strong, sourced hypothesis pending
confirmation. The four diagonal-corner IDs (`7,8` and `19,20`, plus
disabled dead code at `11,12`) and the remaining unexplained IDs
(`15,16`, plus `19,20`'s exact polarity) are understood structurally
(single-vertex or cross-diagonal deformations, some paired as secondary
edge-completion tiles rather than primary shapes) but not resolved
directionally. Implementing shoreline blending now with only N/S
confirmed would produce a visibly broken result for every other
coastline angle - worse than the current plain-edge fallback - so this
still isn't shippable, but the next attempt has real source-derived
ground truth for 2 of 16 values and a concrete hypothesis for 2 more,
instead of starting from zero.

## A real multi-city architecture: region view + click-to-enter city, no View.js changes

This item had been listed as open since the vehicles-preview milestone,
framed as "`View.js` would need real changes." That framing turned out
to be wrong: `View.js` doesn't need to change at all. `dev_engine_region_3d.html`
already proved a real multi-city region overview (cities as nodes,
corridors as lines, many concurrent vehicles) as its own standalone
Three.js scene, and every `View.js`-driving preview since
`dev_engine_view3d.html` has proven `View.js` is a solid single-city
renderer. `dev_engine_region_to_city.html` (new) composes the two
instead of merging them: a real region overview (`RegionMapGenerator` +
`RegionOrchestrator`, 6 real cities) you can click into, entering a real
`View.js` close-up of exactly that city's own `CityState` - its own
terrain, its own buildings, the real Hub UI (`Hub_Build`) for
zoning/demolishing it if it's `MANAGED` - with a button back out to the
region view. The region-wide simulation keeps ticking the whole time,
whichever view is showing, matching the design's "lighter automated
oversight for satellite towns" intent - cities you're not looking at
keep growing on their own.

Because `View.js` has no `dispose()`/multi-instance-switch support, this
preview rebuilds a fresh `View`/`Hub` on every city entry rather than
trying to reuse one across different cities - `#container`/`#hub` are
cleared and a brand new `View()`/`Hub()` constructed each time. That's an
honest, documented limitation, not a hidden one: WebGL resources from
earlier city visits aren't explicitly released (no `dispose()` exists to
call), only their DOM/JS references dropped, so a very long session
hopping between many different cities could eventually approach a
browser's concurrent-WebGL-context limit. Fine for proving the
architecture works; a real cutover would need `View.js` to grow an actual
teardown path.

Two real bugs caught and fixed via browser testing, not code review:

1. **A race between the background simulation tick and async city
   entry.** `enterCity()` is `async` (it awaits `initRenderer()`), and
   the region-wide `setInterval` tick kept running the whole time. Flipping
   `mode`/`activeCityId` to `'city'` *before* that `await` meant a tick
   landing mid-await called `AppState.view3d.selectTool()` on a `View`
   instance whose `this.tool` didn't exist yet - throwing on every such
   tick. Fixed by only flipping `mode`/`activeCityId` *after*
   `initRenderer()` resolves, closing the window entirely rather than
   guarding against it. A second, related edge case (rapid clicks into
   two different cities before the first finish loading) is closed with
   a simple `entering` re-entrancy flag.
2. **A DOM-visibility/sizing order bug**, separate from the race above:
   `#container`/`#hub` need to be visible (non-`display:none`, real
   layout size) *before* `initRenderer()` runs, not after - showing them
   only once loading finishes doesn't retroactively fix anything
   `initRenderer()` already computed off the container's dimensions at
   call time. Getting this backwards was the direct cause of a
   transient-but-real symptom (see below).

Verified via Playwright: zero `pageerror`s (no exceptions) across
entering a city, leaving, and entering a *different* city (the real test
of "switching," not just entering once) - `DOM visibility` checks
confirmed the region canvas and `#container`/`#hub` never both show at
once in either direction, and the real `View.js` scene
(`view3d.land.children`, `view3d.buildingLists`) was inspected directly
in both cities entered, not just screenshotted.

**One remaining, understood-but-unresolved cosmetic finding**: entering
a city logs six `THREE.BufferGeometry.computeBoundingBox()`/
`computeBoundingSphere()` "NaN" console warnings (not exceptions) during
setup - traced to the water plane specifically, and confirmed harmless
by direct inspection: `AppState.view3d.water.geometry`'s position
attribute has zero actual NaN values and a correct, expected bounding
box (`[-0.5,-0.5]` to `[39.5,39.5]` for a 40×40 city) once entry
finishes - and the rendered screenshot shows a normal, correctly-shaped
lake with no visual artifact. This city's terrain (real
`RegionMapGenerator`-generated, unlike earlier previews' hand-placed
terrain) happens to have water touching the map boundary (12 of 145
water tiles), which is the leading suspect given `View.js`'s water-plane
setup has boundary-specific special cases - but the warning is
transient (gone by the time the geometry is inspected a second later),
so this reads as an early-frame ordering quirk during setup, not a
persistent math error. Not chased further since it demonstrably doesn't
affect the final rendered or geometric state; flagged here rather than
silently ignored.

## Shoreline blending, round 4: shipped what's confirmed, deferred what isn't

Round 3 closed with two confirmed IDs (`13,14=North`, `5,6=South`) and a
note that implementing "would produce a visibly broken result for every
other coastline angle - worse than the current plain-edge fallback." That
was wrong on reflection: falling back to the existing plain
`TILE_GROUND`/`TILE_WATER` behavior for every neighbor pattern *except*
the two confirmed ones is strictly additive, never worse than the
current baseline. `dev_engine_shoreline.html` (new) ships exactly that -
real, working shoreline blending scoped to only what's confirmed, with
zero risk of using a wrong guessed ID:

- A lot with a water neighbor directly to its north gets tile value `13`
  (the confirmed North-facing shore tile); directly to its south gets
  `5` (South-facing). Every other case - water to the east, west,
  diagonal, or no water neighbor at all - renders exactly as every prior
  preview already did (plain ground). East/west/diagonal blending stays
  unimplemented, honestly, rather than guessed.
- `?blend=0` disables the feature entirely (same map, same camera target
  lot) purely to allow a controlled before/after comparison - not part
  of the feature itself.

**Verified two ways, and the second is more rigorous than the first.**
Screenshots at a close, near-top-down camera angle on a real shoreline
segment (same target lot, with and without blending) looked nearly
identical to the eye - the height difference involved (0.2 world units)
turned out to be too subtle to distinguish visually at this software-
rendering fidelity, the same fundamental limitation every round of this
investigation has hit. Rather than call that inconclusive result either
a pass or a fail, verification went past pixels into the actual mesh
data: reading `AppState.view3d.heightData` directly (via
`findHeightId()`, the same accessor `View.js` itself uses) at five
sampled north-facing shore tiles and five south-facing ones. Every
north-facing sample had both relevant vertices at exactly `-0.2`
(`-AppState.heightBorder`, lowered toward water) and every south-facing
sample had both at exactly `+0.2` (raised to land height) - precisely
what reading `View.js`'s own height-deformation code predicted in round
3, now confirmed empirically rather than just reasoned about. Five
interior-land control samples (no water neighbor) showed ordinary
varying noise-based heights (0.65 down to 0.46), confirming the
shoreline-tagged samples' suspiciously-exact `±0.2` values aren't a
coincidence of the base terrain. A tile-count regression check confirmed
the change is purely a reclassification, not a loss: `blend=0`'s 8133
plain-ground tiles exactly equal `blend=1`'s 8094 ground + 26 shoreNorth
+ 13 shoreSouth. Zero JS/console errors in either mode.

This is real, shippable, verified shoreline blending - just an honestly
partial one. East/west and diagonal coastlines still render as plain
hard edges, exactly as they did before this round; only north/south
ones are new. `dev_engine_view3d.html`'s and other previews' terrain
generation could adopt this same tile-value logic later without risk,
since it degrades to their existing behavior everywhere it doesn't
apply.

## Cutover research: what replacing `CityGame.js` for real actually requires

Before writing more integration code, a dedicated research pass traced
the shipping game's actual boot path end to end (`index.html` →
`Main.init()` → `WorkerBridge.boot()` → the real Worker running
`src/micro/CityGame.js`) to find every place the current Hub UI and
render path assume the GPL Worker protocol's specific shapes. The
finding changes the shape of what's left more than expected, so it's
recorded here in full rather than folded into a to-do bullet.

**The plumbing is not the hard part.** Driving `View.js` from
`src/engine` state (terrain, buildings, camera, tools) has been proven
repeatedly by every preview this session, and the multi-city + budget +
demolition work already goes well beyond what a real cutover's render
path would need.

**The Hub UI is the hard part, and it's a different game's dashboard.**
`Hub_Budget.js` expects tax rates, per-service funding percentages
(road/fire/police/water/education), and municipal bonds. `Hub_Eval.js`
expects crime, pollution, traffic, health, happiness, education,
unemployment, and a city evaluation score. `Hub_Top.js` expects
population, an RCI demand "valve," a city class, and a season. All of it
comes from a 25-element `infos` array `Simulation.js` builds every tick
and a matching `getData('budget'|'eval'|...)` shape `CityGame.js`
computes on request. `src/engine` has **none of this** - not as a gap to
fill in, but because it's a deliberately different game (resource/trade-
gated country sim, not a Micropolis-style census/tax/bond city sim). Save/
load is also completely unbuilt in `src/engine` - a separate, fully
unstarted workstream regardless of approach.

**Three candidate strategies were scoped**: (A) keep the Worker/message
protocol, reimplement `CityGame.js`'s internals against `src/engine`, and
synthesize every Micropolis stat on top of an engine that models none of
them; (B) bypass the Worker entirely and drive `src/engine` synchronously
on the main thread (productizing what every preview already does), still
needing a stats-layer decision; (C) keep (or drop) the Worker for
placement/render, but **replace the Hub panels themselves** with ones
that reflect what `src/engine` actually models, rather than faking a
foreign simulation's numbers.

**Decision: Strategy C.** Faking population/crime/pollution/bonds on top
of a simulation that doesn't model any of them would mean building a
shadow mini-Micropolis just to keep old panels from showing zeroes - the
worse of the three options. Redesigning the Hub around the real model is
more UI churn but is honest, and doesn't risk the "different game wearing
a borrowed dashboard" problem.

## Hub redesign, step 1: `Hub_EngineStats`, a real panel for what `src/engine` actually models

The first concrete step on Strategy C, and deliberately scoped to be
additive-only: `src/city3d/hub/Hub_EngineStats.js` is a **new** Hub panel
file, structurally alongside `Hub_Top.js`/`Hub_Budget.js`, but it does
not touch or replace them in place. Those files are still what the
shipping game displays today (`src/micro`/`CityGame.js` is still the
live simulation behind `index.html`) - editing them in place would change
what the currently-shipping game shows before `src/engine` is actually
driving it. Instead, `dev_engine_region_to_city.html` (the most complete
preview) constructs `Hub_EngineStats` alongside the existing
`Hub_Build`/`Hub_Top` (via `initGameHub()`, unchanged), then hides
`Hub_Top`'s now-meaningless docked panels (`content0`/`content`/`content2`
- never fed data here since there's no population/score/happiness to
feed them) by toggling DOM elements this preview already holds a
reference to - `Hub_Top.js` itself is never modified.

The new panel shows what the engine actually has: city name + region,
control mode (`MANAGED`/`AUTOMATED`, colored), national treasury, this
city's allocation, R/C/I facility counts, and shipments in transit/
delivered touching this city - reusing the game's real `--c-*`/`--font-ui`
CSS custom properties so it reads as part of the same UI language, not a
bolted-on debug overlay. `Hub_Build`'s RCI bar (`updateRCI(r,c,i)`) turned
out to already be genuinely engine-agnostic - three raw counts, no
Micropolis-specific assumption baked in - so it's reused as-is rather
than rebuilt, the one piece of the existing Hub that needed no redesign
at all.

Verified via Playwright: the actual rendered DOM text (not just internal
state) was checked to contain the city's name, its control mode, and its
facility-count string, confirming the panel really displays computed
values, not just that `update()` was called with plausible-looking
arguments. The reused RCI bar's rendered `style.width` values were
checked against the exact expected formula (`count * 0.033px`) for all
three categories and matched precisely. Zero new JS/console errors beyond
the already-documented, already-confirmed-harmless transient water-plane
NaN warning.

## Hub redesign, step 2: real Budget + Economy panels, honest placeholders for the rest

Completed the rest of Strategy C's panel set. Given the choice between
building only what has real engine backing versus building every panel
button a player coming from the real game's UI would expect to find (even
where `src/engine` has nothing to back it), the latter was chosen -
better an honest "not modeled yet" than a silently missing button.

**Two panels have real engine backing, not fabricated numbers:**

- **`Hub_EngineBudget.js`** - treasury, this city's allocation, and a
  spend-by-facility-type breakdown read directly from
  `CityBudget.spend` (the exact `Map` `ZoneResolver.developLot()` already
  writes via `spendOn()` - not synthesized for this panel, the real
  bookkeeping).
- **`Hub_EngineEconomy.js`** - the original `Hub_Economy.js` picks a
  city's "industry specialization," which `src/engine` has no concept
  of, but `TownCharterTool`'s per-city residential/commercial/industrial
  growth weights (`DefaultTownCharter`) map onto the same idea and
  already drive automated growth every tick. The sliders here write
  directly into the same charter object `RegionOrchestrator`'s
  `charterFor(city)` callback returns - moving them for real changes
  what that city builds next, not a display-only mock. `MANAGED` cities
  show a plain message instead of sliders that would do nothing, since
  the player already controls their zoning directly.

**Five honest placeholders** (`Hub_EnginePlaceholder.js`, one reusable
class parameterized by title/message) stand in for `Eval`/`Ordinances`/
`Awards`/`History`/`Disaster` - each says plainly that the mechanic
(crime/pollution/happiness census, ordinances, achievements, historical
trends, disasters) isn't modeled in `src/engine`, rather than fabricating
numbers or omitting the button entirely.

**Two real bugs caught via browser testing, not code review, while wiring
this in:**

1. **A second, distinct city-switching race**, different from the one
   the multi-city milestone already fixed. That fix closed the window
   during `initRenderer()`'s `await`; this one opened when switching from
   an *already-active* city straight to a different one (not just the
   first-ever entry): `activeCityId` stayed pointing at the old city
   while `AppState.view3d` was about to be reassigned to a fresh,
   not-yet-initialized instance a few lines later. If the background
   `tickSim()` interval landed in that window, its `mode==='city' &&
   activeCityId` guard still passed (both were still set from the
   previous city), so it called `syncCityBuildings()` →
   `view3d.selectTool()` against the *new* `View` before `initRenderer()`
   had created its `tool` object - throwing every time, reliably
   reproduced by a Playwright test that switched between two different
   cities and clicked through several panels. Fixed by clearing
   `activeCityId` immediately at the start of `enterCity()`, not only
   after the later `await` - closing the whole transition window, not
   just part of it.
2. **A stale-until-next-tick display bug**: both new panels only
   refreshed their displayed values while `state==='open'`, so opening a
   panel showed blank/stale content until whatever *external* tick loop
   happened to call `update()` next - occasionally a genuinely noticeable
   beat under this environment's slow software rendering, and a real
   (if smaller) rough edge on real hardware too. Fixed two ways: the
   panels now update regardless of open/closed state (gated only on
   `init()` having run at all, not on visibility), and `Hub_EngineStats`
   gained an `onPanelOpen` hook that the driving preview wires to force
   an immediate refresh the moment any panel opens - so a just-opened
   panel is never stale, not even for one tick.

Verified via Playwright: a `MANAGED` city's Economy panel shows the
plain message (not sliders); an `AUTOMATED` city's shows three real
sliders, and dragging one via a dispatched `input` event changed the
underlying charter object's value and - critically - that value survived
a subsequent tick rather than snapping back, confirming the orchestrator
reads the same live object the slider writes; the Budget panel's actual
rendered text showed real dollar amounts per facility archetype
immediately upon opening; a placeholder panel's rendered text matched
its honest message exactly; and opening one panel correctly closed
whichever other panel was open (the same mutual-exclusivity behavior
`Hub_Top.closePannel()` has). Zero page errors after both fixes, across
entering a `MANAGED` city, an `AUTOMATED` city, dragging a slider, and
opening all four tested panels in sequence - only the already-documented,
confirmed-harmless transient water-plane NaN warnings remained.

## Hub redesign, step 3: five more real mechanics, five more real panels

Step 2 left `Eval`/`Ordinances`/`Awards`/`History`/`Disaster` as honest
placeholders (`Hub_EnginePlaceholder.js`), each stating plainly that the
mechanic wasn't modeled in `src/engine` yet. This step replaces all five
with genuine engine mechanics and genuine panels - nothing left saying
"not modeled yet."

This step covers the five panels Budget/Economy don't already have
`src/engine` equivalents for: **Eval, Ordinances, Awards, History,
Disaster**. Each is backed by a genuinely new engine mechanic, not a
placeholder:

- **`engine/observability/CityHistory.js`** - a bounded, throttled
  time-series recorder (`maxSamples`, `sampleInterval`) over real region
  state per city: facility count, region-shared treasury, city allocation,
  and average corridor utilization. `record(region)` is safe to call every
  tick regardless of cadence; it self-throttles.
- **`engine/observability/CityEvaluation.js`** - `evaluateCity(city,
  region)` returns a composite 0-100 health score from three real
  sub-scores: **vitality** (fraction of facilities `ACTIVE` vs
  `STALLED`), **solvency** (city funds relative to twice the region's
  cheapest buildable recipe - "real headroom," not just "not negative"),
  and **strain** (inverse of average corridor congestion, the same
  load/capacity ratio the region view's corridor coloring already uses).
- **`engine/observability/AchievementTracker.js`** - five milestones
  checked against live state each tick, each unlocking once and staying
  unlocked: First Trade (any shipment delivered), Growing Town (a city
  hits 10 facilities), Industrial Powerhouse (a city hits 5 industrial
  facilities), Treasury Milestone (national treasury ≥ $1000), and
  Founder (a city founded via `FoundCityTool` *after* the tracker started
  watching - relative to the region's starting city count, not an
  absolute one, so pre-placed cities can't retroactively unlock it).
- **`engine/tools/OrdinanceTool.js`** - real, toggleable per-city policy
  levers, defaulting off (no-op) so existing verified behavior is
  unchanged until a player actually toggles one:
  - `priorityFunding` multiplies a city's weight in
    `NationalBudget._allocate()`'s per-tick weighted distribution by 1.5x
    - a zero-sum pull of national funding toward this city, at every
    other city's expense.
  - `exportTariff` multiplies the production-tax revenue this city's
    facilities contribute to the treasury (`TradeResolver
    ._produceAndConsume`) by 1.5x.
  Both required editing already-shipped Tier 4 engine files
  (`NationalBudget.js`, `TradeResolver.js`) - the most invasive of the
  five mechanics, but additive: a city with no ordinances toggled produces
  bit-for-bit the same numbers as before this change (verified by the
  existing `test_budget.mjs`/`test_corridor_load.mjs` regression scripts
  passing unchanged after the edit).
- **`engine/tools/DisruptionTool.js`** - a trade-sim-appropriate
  "disaster," not a Micropolis fire/flood/monster reskin: a **supply
  shock** (`Facility.disruptedUntilTick`) stops one facility producing for
  K ticks regardless of input stock, distinct from a normal `STALLED`
  (missing inputs, self-clearing) - it's a new field `TradeResolver`
  checks and skips. A **transport disruption**
  (`CorridorEdge.disruptedUntilTick` / `disruptionCapacityFactor`, read
  through a new `effectiveCapacity(tick)` method) reduces or zeroes a
  corridor's usable capacity, which forces `TradeResolver`'s shipment
  matching to route around it or simply fail to move enough. Both ripple
  genuinely: a headless test confirmed a severed corridor's `load` drops
  to exactly 0 and a real downstream steel mill facility (previously
  `ACTIVE`) transitions to `STALLED` once its buffered input runs out -
  an actual traceable consequence, not a display flag, matching the
  "fully traceable trade" design pillar.

Every mechanic above was verified headlessly (scratch Node scripts, never
committed) before any UI work: `CityHistory` and `CityEvaluation`'s
sub-scores against hand-constructed facility/budget/corridor states,
`AchievementTracker` against a full `RegionOrchestrator` run plus a real
`FoundCityTool.found()` call (confirming Founder requires a genuinely new
city, not just the starting pair), `OrdinanceTool` against direct
before/after `NationalBudget.tick()`/`TradeResolver.tick()` comparisons
(confirming the 1.5x multipliers apply exactly, not approximately), and
`DisruptionTool` against a real two-city ore→coal→steel chain (confirming
production/shipment behavior before, during, and after the disruption
window, including automatic recovery once `disruptedUntilTick` passes).

### Five new Hub panels, replacing the five placeholders

`src/city3d/hub/Hub_EngineEval.js`, `Hub_EngineOrdinances.js`,
`Hub_EngineAwards.js`, `Hub_EngineHistory.js`, and
`Hub_EngineDisaster.js` are new files, each extending the real, generic
`Hub_Pannel` base class exactly like the legacy `Hub_Eval.js`/
`Hub_Awards.js`/etc. do (lazy `init()` on first open, `.hub-panel` CSS for
background/border/shadow, an `update(data)` method the caller drives).
`Hub_EngineStats._initPanelRegistry()` now instantiates these five in
place of the five `Hub_EnginePlaceholder` entries step 2 registered,
alongside the unchanged `Hub_EngineBudget`/`Hub_EngineEconomy` panels -
same button bar, same positioning, same mutual-exclusivity behavior,
just real panels where placeholders used to be. `Hub_EnginePlaceholder.js`
itself is now dead code (nothing references it any more) and was deleted
rather than left around unused. As before, none of the legacy `Hub_*.js`
panel files, `Hub_Top.js`, or `Hub.js` were touched.

`dev_engine_region_to_city.html` now constructs `cityHistory` (a
`CityHistory`), `achievementTracker` (an `AchievementTracker`),
`ordinanceTool`, and `disruptionTool` alongside the existing
`orchestrator`, records/checks the first two every tick regardless of
mode (so History/Awards reflect activity in cities the player isn't
currently looking at, matching how `orchestrator.tick()` itself already
behaves), and builds a `Hub_EngineStats` instance on `enterCity()`,
tearing it down on `leaveCity()`. The Disaster panel's two trigger
buttons pick a random currently-undisrupted facility/corridor belonging to
the active city and call `disruptionTool.disruptFacility`/
`disruptCorridor` directly - a real player action against real engine
state, not a scripted demo.

### Verified in an actual browser, and it found a real bug

Playwright (headless Chromium, software GL) drove the full flow against
the actual page: enter a real `MANAGED` city (`city-1`, deterministic per
`RegionMapGenerator`), let the sim tick, then open each of the five new
panels and read real rendered DOM text - not just that a function was
called. All five showed genuine live data (an Eval score with
vitality/solvency/strain sub-bars, a History table with real tick/
treasury/congestion rows, an Awards list with 3/5 unlocked including
"First Trade" at a specific real tick, both ordinances listed with their
actual descriptions).

Clicking the Priority Funding row surfaced a real, reproducible bug:
`Hub_EngineOrdinances.update()` was tearing down and rebuilding its
entire row list (`innerHTML = ''` then re-append) on every call, and the
caller refreshes an open panel every tick (~150ms). A real Playwright
click raced that rebuild and hit a `element was detached from the DOM`
failure - the exact kind of interaction bug that only shows up by
actually clicking through a running page, not by reading the code. Fixed
by building each ordinance's row once in `init()`/on first sight and
having `update()` adjust only that row's existing style in place
thereafter - a panel's DOM shouldn't be more volatile than the data
actually changing warrants, especially one with click handlers on it.
Re-tested after the fix: the
click now reliably toggles `city.ordinances.priorityFunding` on the real
live `CityState` object. Triggering a Supply Shock similarly confirmed a
real `Facility.disruptedUntilTick` gets set on a live object (not just a
panel-local flag) and the Disaster panel's active-disruption list
reflects it with a correct, decrementing `ticksRemaining`.

The one console warning seen during the whole flow was the already-
understood, already-documented transient water-plane NaN bounding-box
warning noted elsewhere in this doc (confirmed harmless, unrelated to
this work) - zero new errors of any kind.

## What's still open

- Save/load for `src/engine` (`RegionState`/`CityState` serialization) is
  completely unbuilt - a separate workstream regardless of UI progress.
- Shoreline blending, east/west and diagonal cases — round 3's
  structurally-derived hypothesis (`9,10=West`, `17,18=East`) is still
  unconfirmed, and the diagonal/secondary-edge-completion IDs are still
  fully open. Needs either a richer multi-tile test map, the texture-
  readback approach, or a non-software-rendered environment.
- The transient water-plane NaN warning noted above - understood to be
  harmless, not root-caused to an exact line.
- `View.js` still has no `dispose()`/teardown path - fine for the
  rebuild-per-entry approach `dev_engine_region_to_city.html` uses, but
  a real multi-city cutover would want one, to avoid the WebGL-context
  accumulation noted above over a long session.
- Only 3 of the real UI's ~13 tools (R/C/I) are wired to `src/engine`;
  road/power/service tools are accepted but no-op, since the engine
  doesn't model infrastructure/services yet.
- Eventually: replacing `CityGame.js` as the Worker's actual entry point
  and repointing `utils/rollup.config.city.js`, once the above make that
  safe to do without regressing the shipping game.
