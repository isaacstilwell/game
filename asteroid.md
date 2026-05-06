# Asteroid System

## Overview

The asteroid is a `QuadtreeTerrainCube` — a 6-faced LOD terrain system where each face is a `QuadtreeTerrainPlane`. The surface is rendered as a point cloud (`renderAsPoints = true`) with a solid black fill body underneath to occlude the interior.

All code lives in `game/src/game/asteroid/`.

## Architecture

### LOD Flow

```
buildAsteroid(id, res, radius)
  → Config.create(id, radius)          seed-based procedural config
  → QuadtreeTerrainCube                6 faces, each a QuadtreeTerrainPlane
      → prerenderCoarseGeometry        1 heightShader GPU pass per face (upfront)
  → initial setCameraPosition(AU)      build at lowest LOD (6 face-chunks)
  → returns { group, update }
```

Each frame in the game/lab, call `update(camera.position)`. This:
1. Calls `qtc.setCameraPosition(cameraPos)` — walks the quadtree and queues any add/remove changes based on camera distance
2. Pumps the build queue one step: `processNextQueuedChange` → `builder.updateMaps` → `builder.update`

### Split Condition (`QuadtreeTerrainPlane._setCameraPosition`)

A node subdivides when:
- `distanceToCamera < chunkSize * CHUNK_SPLIT_DISTANCE` (camera is close enough)
- `chunkSize >= minChunkSize * 2` (chunk is large enough to split)

`CHUNK_SPLIT_DISTANCE = 1.25`, so the split triggers when the camera enters a 1.25× bubble around the chunk.

### Chunk Build Pipeline (per chunk, synchronous on main thread)

1. **Worker pool** (stubbed, runs synchronously): `rebuildChunkGeometry` — CPU-computes undisplaced sphere positions for the chunk
2. **`updateMaps`**: one `heightShader` GPU pass → CPU readback → `applyDisplacementToGeometry` moves points to their final displaced positions
3. Chunk becomes visible

Color and normal shader passes have been removed — the point color is a flat gray and the fill body is pure black.

## Key Files

| File | Role |
|---|---|
| `AsteroidBuilder.ts` | Entry point. `buildAsteroid(id, res, radius)` → `{ group, update }` |
| `AsteroidConfig.ts` | Seed-based procedural config. `Config.create(id, radius)` |
| `QuadtreeTerrainCube.ts` | 6-face cube, LOD state machine, queues changes |
| `QuadtreeTerrainPlane.ts` | Per-face quadtree, handles split/merge logic and neighbor stitching |
| `TerrainChunkManager.ts` | Allocates/recycles `TerrainChunk` instances, drives map generation |
| `TerrainChunk.ts` | One chunk: fill body mesh (`MeshBasicMaterial`) + point cloud (`PointsMaterial`) |
| `TerrainChunkUtils.ts` | `rebuildChunkGeometry` (CPU), `generateHeightMap` (GPU), `applyDisplacementToGeometry` |
| `shaders/index.ts` | Pre-baked GLSL strings — `heightShader` and `heightShaderWithStitching` only |
| `constants.ts` | Tuning constants — see below |

## Constants (`constants.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `MIN_CHUNK_SIZE` | `4` | Minimum chunk size in world units. Controls max LOD depth. With `radius=5`, gives ~3 levels; `radius=50` gives ~6 levels. |
| `CHUNK_SPLIT_DISTANCE` | `1.25` | Split when camera is within `1.25 × chunkSize` of the chunk center. |
| `OVERSAMPLE_CHUNK_TEXTURES` | `true` | Adds 2-pixel border to height textures to reduce seam artifacts. |
| `AU` | `1.495978707e11` | Used only for the initial low-LOD build. |

## Rendering (`TerrainChunk`)

In `renderAsPoints = true` mode, each chunk has two objects in the scene:

- **`_points` (`THREE.Points`)**: the visible point cloud. `PointsMaterial` with `sizeAttenuation: true`, fixed `size: 0.05`. Color is flat `0x515c63`.
- **`_plane` (`THREE.Mesh`)**: solid black fill body. `MeshBasicMaterial` (no lighting). Positions are the point positions scaled to **97%** to sit slightly inside the surface and avoid bleed-through.

Height displacement is applied CPU-side via `applyDisplacementToGeometry` using a GPU-rendered height bitmap read back with `readPixels`. The fill body positions are derived from the displaced point positions scaled inward (not independently displaced).

## Config / Scale

`Config.create(id, radius)` generates a fully procedural config from a SHA-256 seed derived from `id`. The `radius` parameter (default `5`) controls world-space size.

- **Lab default**: `radius = 5`. Camera starts at `z = 25`. LOD kicks in around `z = 12–15`.
- **Game use**: pass a larger radius (e.g. `50–100`) to `buildAsteroid(id, res, radius)` and call `update(camera.position)` each frame. The split thresholds scale with the radius automatically.

## Shaders

Only `heightShader` and `heightShaderWithStitching` are used at runtime. The `colorShader`, `normalShader`, and `resourceShader` have been removed entirely.

All shaders live as pre-baked TypeScript string constants in `shaders/index.ts`. The original `.glsl` files are kept as readable references but not imported. Internal GLSL helpers are prefixed to avoid duplicate symbol conflicts (`_sn_*` for snoise, `_cn_*` for cellular noise).

## Integration into the Game

When adding asteroids to the main game scene:

1. Call `buildAsteroid(id, res, radius)` — await the promise, then add `group` to the scene
2. Each game loop tick, call `update(camera.position)` — this drives LOD gradually (one change set per tick)
3. The `group` uses the same `THREE.Group` transform system as other scene objects; place/orient it via `group.position`, `group.rotation`, etc.
4. For correct LOD distance, pass the camera position in the asteroid's **local** space if the asteroid has a non-identity world transform: `update(asteroid.worldToLocal(camera.position.clone()))`

## Optimization Work

The original implementation came from a project requiring a realistic rendering style. The following was stripped for game use:

### Completed

**Step 1 — Dead shaders and map generators** (`shaders/index.ts`, `TerrainChunkUtils.ts`, `TerrainChunkManager.ts`):
- `colorShader`, `normalShader`, `resourceShader` exports deleted from `shaders/index.ts`
- `GET_ABUNDANCE_FUNCS` GLSL partial deleted (was only used by `resourceShader`)
- `generateColorMap`, `generateNormalMap`, `generateEmissiveMap`, `initChunkTextures` deleted from `TerrainChunkUtils.ts`
- `_ramps.png.datauri` import removed (was only needed by the color shader)
- `textureOptsDefault` and the async ramps-load variable removed
- `rebuildChunkMaps` now returns only `{ heightBitmap }` — the `colorBitmap`, `normalBitmap`, `emissiveBitmap` fields are gone
- `RebuildChunkMapsParams` interface simplified — `emissiveParams` and `renderAsPoints` params removed
- `TerrainChunkManager` no longer calls `initChunkTextures`; the async startup delay (~100ms waiting for ramps to load) is eliminated; `this.ready = true` immediately

**Step 2 — `AsteroidConfig` dead fields** (`AsteroidConfig.ts`, `OctaveNoise.ts`):
- Removed `ringsPresent`, `ringsMinMax`, `ringsVariation` and their generator methods — ring rendering is not implemented
- Removed `rotationSpeed` — nothing reads it from config
- Removed `bonuses` array — initialized to all-zeros, never modified
- Removed `spectralType` from config data — was only consumed by `colorShader` (gone); still used internally to compute `featuresSharpness`
- Deleted `OctaveNoise.ts` entirely (was only used by `_ringsVariation`)

**Step 3 — `TerrainChunkManager` / `QuadtreeTerrainCube` dead fields** (`TerrainChunkManager.ts`, `QuadtreeTerrainCube.ts`, `AsteroidBuilder.ts`):
- Removed `emissivePool` and all emissive pool routing — `setEmissiveParams` was never called
- Removed `shadowsEnabled` field and `setShadowsEnabled` method — always false
- Removed `prunedConfig` ring-stripping destructure — those fields no longer exist on config
- Removed `renderAsPoints` field and constructor param — always `true`; hardcoded in `TerrainChunk` call
- Removed `ready` flag — was gating on ramps texture load which is gone; `isBusy()` simplified
- Removed `emissiveParams` field and `setEmissiveParams` method from `QuadtreeTerrainCube`
- Removed emissive-related `renderSig` suffix from `QuadtreeTerrainCube.setCameraPosition`
- `renderAsPoints` param removed from `QuadtreeTerrainCube` and `AsteroidBuilder` constructors

**Step 4 — `TerrainChunk` non-points branch** (`TerrainChunk.ts`):
- Removed `MeshStandardMaterial` constructor branch, `getOnBeforeCompile`, `applyOnBeforeCompile`, `makeExportable`
- Removed shadow/`MeshDepthMaterial`/`customDepthMaterial` setup
- Removed dead imports: `MeshStandardMaterial`, `MeshDepthMaterial`, `Vector2`, `RGBADepthPacking`
- Removed `_shadowsEnabled` and `_renderAsPoints` fields; `_pointsGeometry`, `_pointsMaterial`, `_points` made non-optional
- `ChunkParams` interface stripped of `shadowsEnabled` and `emissiveParams`
- `updateDerived` simplified to one line; `isReusable` returns `true` unconditionally
- `updateMaps` simplified — no branch, just the height displacement path
- `hide`/`show` bug fixed: now toggles both `_plane` and `_points` visibility (previously `_points` was always visible during LOD transitions)

**Step 5 — Misc dead fields** (`QuadtreeTerrainCube.ts`, `constants.ts`, `AsteroidConfig.ts`):
- Removed `emissiveParams` and `shadowsEnabled` from the `allocateChunk` call in `QuadtreeTerrainCube.processNextQueuedChange`
- Removed `SHADOWLESS_NORMAL_SCALE` from `constants.ts` (was only used by the dead `MeshStandardMaterial` branch)
- `CHUNK_RESOLUTION` kept — still used by `getExtraPasses` in `TerrainChunkUtils.ts`
- Removed `radiusNominal` from `AsteroidConfigData` interface and `toConfigData` — nothing reads it

## LOD Pop Mitigation

The point cloud rendering makes LOD transitions visually obvious: when a coarse face-chunk splits into 4 fine chunks, the point density jumps abruptly.

**Attempted: per-chunk point size scaling** — tried `size = k * sqrt(width / (2 * radius))` so coarser chunks compensate their lower density with bigger points. Reverted — not enough visual improvement to justify the added complexity. Point size stays fixed at `0.05`.

**Remaining options if this becomes a priority:**
- **Opacity crossfade** — on `show()`, ramp opacity 0→1 over ~10 frames while keeping the old chunk visible; requires per-chunk fade state and a per-frame update hook
- **Raise `MIN_CHUNK_SIZE`** — fewer LOD levels = less density contrast; trade-off is lower max detail
