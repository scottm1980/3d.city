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

## What's still open

- Shoreline blending — see round 2 above. Not a matter of more guessing;
  needs either the texture-readback approach or a non-software-rendered
  environment to finish verifying.
- A real multi-city architecture in `View.js` itself (this pass used a
  combined-tilesData trick specifically to avoid refactoring `View.js`;
  a genuine region view with independently-sized, independently-loaded
  cities would need real changes there).
- Only 3 of the real UI's ~13 tools (R/C/I) are wired to `src/engine`;
  road/power/service tools are accepted but no-op, since the engine
  doesn't model infrastructure/services yet.
- Eventually: replacing `CityGame.js` as the Worker's actual entry point
  and repointing `utils/rollup.config.city.js`, once the above make that
  safe to do without regressing the shipping game.
