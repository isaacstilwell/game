# Mountain Range Rewrite Plan

## Problem with current approach
Individual spires placed in a loop look like a grid. We want noise to naturally produce peaks, width variation, and buttes — no explicit per-peak loop.

## New approach: noise field inside a capsule SDF

### Function signature (unchanged)
```ts
function _mountainRange(
  x, y, z,            // query point (world space, on sphere surface)
  cx, cy, cz,         // range center on sphere
  ax, ay, az,         // along direction (will be normalized internally)
  length,             // full extent of range
  seed,               // drives all randomisation
): number
```

### Step 1 — Local coordinate frame inside the range

Normalize `along = (ax,ay,az)`.

Compute perpendicular tangent: `perp = normalize(cross(along, normalize(cx,cy,cz)))`.

For query point `dv = (x-cx, y-cy, z-cz)`:
```
a    = dot(dv, along)           // position along the spine
dist = dot(dv, perp)            // signed cross-axis offset
```

Capsule SDF clamp (for endpoint tapering):
```
aClamped = clamp(a, -length/2, length/2)
```

### Step 2 — Variable half-width along the spine

```ts
const baseHW  = 35 + noise3(seed, 0.1, 0.5) * 35;   // 35–70, overall width
const hwVary  = noise3(aClamped / 110, seed + 1, 0.5); // low-freq, 0–1
const halfW   = baseHW * (0.45 + hwVary * 0.9);       // varies 45%–135% of base
```

If `Math.abs(dist) >= halfW` → return 0 (outside range entirely).

### Step 3 — Envelope (taper + cross-section)

```ts
const tDist  = 1 - Math.abs(dist) / halfW;            // 0 at edge, 1 at spine
const uAlong = Math.abs(aClamped) / (length / 2);     // 0 at center, 1 at endpoints
const tAlong = 1 - uAlong * uAlong * (3 - 2 * uAlong); // smooth taper to 0 at ends
const envelope = tAlong * tDist * tDist;               // base envelope shape
```

### Step 4 — Peak noise (creates individual summits naturally)

Medium frequency noise along the spine creates 4–7 peaks across a 280-unit range:

```ts
const baseH    = 12 + noise3(seed, 0.3, 0.5) * 13;   // overall height 12–25
const peakNoise = noise3(aClamped / 42, dist / 42, seed + 2); // 0–1
const h        = baseH * envelope * (0.35 + peakNoise * 0.65);
```

The noise frequency (÷42) naturally produces ~4–6 summits in a 280-unit range.
Changing the divisor changes apparent peak count: smaller = more peaks, larger = fewer broader peaks.

### Step 5 — Butte capping (rare flat tops)

Low-frequency noise decides whether a local area gets flattened to a mesa/butte:

```ts
const butteNoise = noise3(aClamped / 85, dist / 85, seed + 5); // low freq
const capHeight  = baseH * (0.5 + noise3(seed + 6, aClamped / 200, 0.5) * 0.3);
// Only cap if butteNoise is high AND the terrain is already near a peak
if (butteNoise > 0.70) {
  h = Math.min(h, capHeight);  // flatten tall areas → butte
}
```

`> 0.70` means roughly 30% of range area could be capped, but since it only affects already-tall terrain (near peaks), effective butte frequency is lower — maybe 1 butte per 2–3 ranges on average.

### Step 6 — Surface roughness

```ts
h += (noise3(x / 7, y / 7, z / 7) * 2 - 1) * baseH * 0.055;
```

### Step 7 — Cave alcoves (optional, ~25% of ranges)

```ts
const hasCave = noise3(seed + 8, 0.5, 0.5) > 0.75;
if (hasCave) {
  // Low-freq noise dips carved into one flank of the range
  const caveN = noise3(aClamped / 55, dist / 15, seed + 9);
  if (caveN < 0.22 && Math.abs(dist) > halfW * 0.3) {
    h *= 0.3 + caveN / 0.22 * 0.7; // hollow out the flank, smoothly
  }
}
```

## What to remove
- `_butteSpire` — replaced entirely by noise field
- The `numPeaks` loop and all per-peak seed arithmetic
- `_BUTTES` array (already gone)

## What stays the same
- `_mountainAdd` calls `_mountainRange(x, y, z, 0, 334, 104, 1, 0, 0, 280, 2.7)`
- `MOUNT_CAM / MOUNT_TARGET` in Planet3LabCanvas.tsx
- `HeightGenerator.Get` — `_mountainAdd` is still the hook

## Notes / watchouts
- The perpendicular vector `cross(along, sphere_normal)` degenerates if `along` is parallel to the sphere normal at the center. In practice this won't happen for horizontal ranges, but worth checking: if `pmag < 0.01`, fall back to `cross(along, (0,1,0))`.
- All noise samples use `(aClamped, dist, seed+N)` coordinates — not raw world XYZ — so the feature is defined in range-local space and doesn't bleed across unrelated parts of the sphere.
- The `seed` parameter shifts all noise samples in the z-axis of noise space, giving each range a unique character without changing the frequency structure.
