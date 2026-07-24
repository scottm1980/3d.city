# Graphics engine upgrade: stay in-browser

Question this answers: to get a meaningfully better-looking game, do we need
to move off browser rendering (Unity/Unreal/Godot)? **No.** This documents
why, what's already in place, and the concrete upgrade path within Three.js/
WebGPU.

## Current state (verified in the codebase)

The rendering layer is already more advanced than a typical browser city
builder, and it's part of the MIT-safe layer identified in
`docs/LICENSE_REWRITE_SCOPE.md` — none of this needs to be rewritten for
licensing reasons.

- **Dual-path renderer**: `index.html` runs WebGL2, `index_gpu.html` runs
  WebGPU, both driven from `src/city3d/View.js`.
- **TSL (Three.js Shading Language) node-based post-processing already
  implemented**, in `src/jsm/tsl/display/`:
  - `GTAONode.js` — ground-truth ambient occlusion
  - `TRAANode.js` — temporal reprojection anti-aliasing (the same technique
    family UE5 defaults to)
  - `GaussianBlurNode.js`
  - `Lut3DNode.js` — 3D LUT color grading, backed by `assets/luts`
- Custom `GroundShader`, `PostEffect`/`Vignette`, DRACO-compressed model
  loading, and texture atlasing (`AutoTexture.js`) round out the pipeline.

This is a real modern post-processing stack, not a stub — the ceiling here
is meaningfully higher than "browser toy" rendering already implies.

## Why WebGPU changes the historical calculus

The traditional reason to leave the browser for "real" graphics was that
WebGL couldn't touch compute shaders or low-level GPU access — Unity/Unreal
had a structural advantage there. WebGPU closes that gap: it's the browser's
equivalent of Vulkan/Metal/DX12, compute shaders included. The rendering
ceiling isn't fundamentally different anymore. What matters now is how much
of that capability is actually being used — and right now the WebGPU path
likely isn't pushing compute very hard yet.

## Concrete upgrade path, staying in-browser

1. **GPU-driven culling/instancing via WebGPU compute.** The single
   highest-value item for this project specifically — a country-sim with
   many city nodes and large numbers of vehicles/buildings needs cheap
   density. Compute-driven frustum culling and instancing is what native
   engines use for exactly this problem, and WebGPU compute makes it
   available here too.
2. **Real-time GI beyond GTAO** — screen-space GI or light probes for actual
   bounced lighting, not just occlusion. A heavier lift than item 1, but
   within reach of the TSL pipeline already started.
3. **LOD/impostors for distant geometry** — not optional polish; required
   once multiple city nodes are being rendered per the country-sim plan in
   `docs/COUNTRY_SIM_ENGINE_PLAN.md`.
4. **Volumetric weather** (fog/clouds via compute) — ties directly into the
   seasonal-identity gameplay idea from the earlier vision brainstorm, so
   it's gameplay-relevant investment, not purely cosmetic.
5. **Treat WebGL2 as a compatibility fallback only.** Concentrate future
   rendering work on the WebGPU/TSL path — that's where the real headroom
   is.

## Where browser rendering genuinely still loses

- **Hardware ray tracing** isn't broadly exposed through WebGPU yet.
- **Art-pipeline tooling** — Unity/Unreal have far more mature editor and
  asset-pipeline ecosystems.

Neither matters much for a stylized city builder chasing a specific look
rather than photorealism.

## Cost of leaving the browser (why we're not doing this)

The project's own stated differentiator (`README.md`) is "no download, no
install, just open a tab and build." Re-platforming to Unity/Unreal/Godot
throws that away entirely. It would also orphan the ~7,320 lines of
rendering/UI code in `src/city3d/` already confirmed license-clean in
`docs/LICENSE_REWRITE_SCOPE.md` — rebuilding the one layer that doesn't need
rewriting for legal reasons, in exchange for a graphics ceiling this genre
doesn't actually require.

## Recommendation

Stay on Three.js/WebGPU. Prioritize compute-driven instancing/culling first
since it's the direct enabler for the country-sim's multi-city rendering
load, then layer in GI, LOD, and volumetric weather as the gameplay systems
that need them (seasons, regional scale) come online.
