# Licensing situation & engine-rewrite scope

Written for anyone (including future-me) deciding whether to release a derivative
of this project as closed-source. Not legal advice — if real money is riding on
this, get a lawyer to confirm before shipping.

## The licensing conflict

`README.md` and `package.json` both declare **MIT**. The repo's actual
`LICENSE`/`COPYING` files, and the file headers throughout `src/micro/`, say
**GPLv3** — specifically the `micropolisJS` terms (itself descended from the
original EA-released SimCity source), which add:

- No use of the "SimCity" name or any EA trademark, no claiming EA affiliation.
- Modified versions must be marked as modified, not passed off as the original.
- Copyright notice + these terms must be preserved on any conveyance.
- If you assume contractual liability to recipients, you must indemnify EA.

The `MIT` label is not a valid re-license — nobody can unilaterally relicense
GPL code by adding a comment. Confirming this isn't just a stray doc mismatch:
`utils/rollup.config.city.js` bundles `src/micro/CityGame.js` (the GPL-headered
engine) into `build/citygame.min.js` and its own `header()` plugin stamps the
output `SPDX-License-Identifier: MIT` — the build tooling mislabels GPL code
as MIT at the point where it matters most (what actually ships).

**Practical effect:** treat the simulation engine as GPLv3. You can build on
it and release commercially, but only if you keep the whole derivative under
GPLv3 (source available, same license, notices preserved, no SimCity/EA
branding). A closed-source release requires replacing the GPL engine.

## Architecture: the good news

`src/city3d/` (27 files, 7,320 lines — Three.js rendering/UI, genuinely MIT)
talks to the simulation engine *only* through `Worker.postMessage`/`onmessage`,
routed via `src/WorkerBridge.js`. No file under `city3d` imports anything from
`src/micro` directly — confirmed by grep across the tree. That means the GPL
engine can be replaced behind that message boundary without touching the
renderer, as long as the replacement speaks the same (or an adapted) protocol.

## Dead code — delete now, zero rewrite cost

| Path | Lines | Why it's free to remove |
|---|---:|---|
| `src/micro_old/` | 10,404 | Full earlier draft of the same GPL engine; imported by nothing (build entry point is `src/micro/CityGame.js`, not `micro_old`) |
| `src/micro/_not_use/` | 359 | Confirmed unreferenced anywhere in the tree |
| `src/micro_old/_not_use/` | 359 | Same, inside the already-dead `micro_old` tree |

## The real rewrite surface — `src/micro/`, ~10,400 lines / 59 live files

| Tier | Files | Lines | What it does | Difficulty |
|---|---|---:|---|---|
| 1. Foundation | `Simulation.js`, `Micro.js`, `Tile.js`, `Storage.js`, `Text.js`, `Messages.js`, `MessageManager.js`, `math/*` | ~2,170 | Tile-grid data model, tick loop, message envelope | Medium — plumbing, but everything else depends on it |
| 2. Map generation | `map/GameMap.js`, `map/MapGenerator.js`, `map/MapUtils.js` | ~1,480 | Terrain/heightmap procedural generation | Low-medium — generic algorithm territory, lowest legal sensitivity |
| 3. Zone growth rules | `zone/Residential.js`, `Commercial.js`, `Industrial.js`, `Road.js`, `Transport.js`, `EmergencyServices.js`, `Stadia.js`, `MiscTiles.js` | ~1,055 | RCI zone growth/decay logic | **High** — this is the actual "SimCity" gameplay algorithm; most design-sensitive, most worth doing well since it's the game's differentiation |
| 4. City systems | `game/Budget.js`, `Evaluation.js`, `PowerManager.js`, `Traffic.js`, `DisasterManager.js`, `Census.js`, `Valves.js`, `Ordinances.js`, `IndustrySpecialization.js`, `SeasonManager.js`, `CityHistory.js`, `Achievements.js`, `AnimationManager.js`, `BlockMap.js`, `MapScanner.js`, `RepairManager.js`, `TileHistory.js` | ~2,580 | Tax/budget, approval rating, power grid, traffic, disasters, stats | Largest bucket; good candidate to trim for an MVP (defer ordinances/achievements/seasons) |
| 5. Player tools | `tool/BaseTool.js`, `BuildingTool.js`, `BulldozerTool.js`, `RoadTool.js`, `RailTool.js`, `WireTool.js`, `ParkTool.js`, `QueryTool.js`, `WorldEffects.js` | ~1,005 | Build/bulldoze/road/rail/query interactions | Low — mechanical once Tier 1 exists |
| 6. Sprites | `sprite/BaseSprite.js`, `SpriteManager.js`, `Airplane/Boat/Copter/Explosion/Monster/Tornado/Train` sprites | ~1,220 | Moving vehicle/disaster animation state machines | Low-medium |
| 7. Orchestrator | `CityGame.js` | 885 | Wires all of the above into the Worker message protocol `WorkerBridge` expects | Do last — defines the contract the renderer already relies on |

**Total: ~10,400 lines across 59 files** must be an original implementation
before a closed-source release is safe. `src/city3d/` (7,320 lines) needs no
rewrite for licensing purposes.

## Recommended path

1. Delete `src/micro_old/` and both `_not_use/` folders now — no downside.
2. Ship interim releases under GPLv3 (open-source) while rewriting.
3. Rewrite order: Tier 1 → Tier 2/5 (mechanical, unblock playability) → Tier 7
   (re-point the orchestrator at the new modules) → Tier 3 (the part worth
   spending real design time on) → Tier 4 (trim scope for v1, backfill later)
   → Tier 6.
4. Flip to closed-source only once the last file under `src/micro/` with a
   `micropolisJS`/GPL header is gone.
