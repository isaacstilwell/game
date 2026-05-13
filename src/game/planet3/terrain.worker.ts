import { NoiseGenerator } from './noise';
import { noise3 } from './perlin';

// Noise params match TerrainChunkManager constants (hardcoded to avoid serialising them per request)
const _noise = new NoiseGenerator({
  octaves: 7,
  persistence: 1.2,
  lacunarity: 2.0,
  exponentiation: 2.8,
  height: 55.0,
  scale: 175.0,
  seed: 1,
});

// ---- Height feature functions (mirror of terrain.ts) ----

function _canyonCarve(
  x: number, y: number, z: number,
  cx: number, cy: number, cz: number,
  ax: number, ay: number, az: number,
  seed: number,
): number {
  const dvx = x - cx, dvy = y - cy, dvz = z - cz;
  if (dvx * dvx + dvy * dvy + dvz * dvz > 330 * 330) return 0;

  const amag = Math.sqrt(ax * ax + ay * ay + az * az);
  const anx = ax / amag, any = ay / amag, anz = az / amag;
  const cmag = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const snx = cx / cmag, sny = cy / cmag, snz = cz / cmag;
  let ppx = any * snz - anz * sny;
  let ppy = anz * snx - anx * snz;
  let ppz = anx * sny - any * snx;
  let pmag = Math.sqrt(ppx * ppx + ppy * ppy + ppz * ppz);
  if (pmag < 0.01) { ppx = any; ppy = -anx; ppz = 0; pmag = Math.sqrt(ppx * ppx + ppy * ppy + ppz * ppz); }
  const pnx = ppx / pmag, pny = ppy / pmag, pnz = ppz / pmag;

  const halfLength    = 180 + noise3(seed, 0.1, 0.5) * 120;
  const baseHalfWidth =  14 + noise3(seed, 0.2, 0.5) * 18;
  const minHalfWidth  =   5 + noise3(seed, 0.3, 0.5) * 7;
  const depth         =  10 + noise3(seed, 0.4, 0.5) * 14;
  const meanderStr    =  25 + noise3(seed, 0.5, 0.5) * 30;

  const aRaw    = dvx * anx + dvy * any + dvz * anz;
  const distRaw = dvx * pnx + dvy * pny + dvz * pnz;

  const roughU  = Math.abs(aRaw) / halfLength;
  const roughLT = roughU < 1 ? 1 - roughU * roughU * (3 - 2 * roughU) : 0;
  const warpAmt = meanderStr * roughLT;

  const a    = aRaw    + warpAmt * (noise3(aRaw / 180, distRaw / 180, seed + 5.1) * 2 - 1);
  const dist = Math.abs(distRaw + warpAmt * (noise3(aRaw / 180 + 17.3, distRaw / 180 + 31.7, seed + 5.1) * 2 - 1));

  const clampedAlong  = Math.max(-halfLength, Math.min(halfLength, a));
  const dAlong        = a - clampedAlong;
  const effectiveDist = Math.sqrt(dAlong * dAlong + dist * dist);

  const u          = Math.abs(clampedAlong) / halfLength;
  const lengthT    = 1 - u * u * (3 - 2 * u);
  const widthNoise = noise3(clampedAlong / 50, seed + 11.3, 0.3);
  const halfWidth  = minHalfWidth + (baseHalfWidth - minHalfWidth) * lengthT * (0.5 + widthNoise);

  if (effectiveDist >= halfWidth) return 0;

  const t      = 1 - effectiveDist / halfWidth;
  const smooth = depth * lengthT * t * t * (3 - 2 * t);
  const rockyAmt = t * depth * 0.7;
  const rocky  = (noise3(x / 10, y / 10, z / 10) * 2 - 1) * rockyAmt
               + (noise3(x / 4,  y / 4,  z / 4)  * 2 - 1) * rockyAmt * 0.4;
  return smooth - rocky;
}

function _canyonAdd(x: number, y: number, z: number): number {
  return (
    _canyonCarve(x, y, z,   0,   0,  350, Math.sin(0.15), Math.cos(0.15), 0, 5.1) +
    _canyonCarve(x, y, z,   0,   0, -350,            0.5,           0.866, 0, 9.2)
  );
}

function _mountainRange(
  x: number, y: number, z: number,
  cx: number, cy: number, cz: number,
  ax: number, ay: number, az: number,
  length: number,
  seed: number,
): number {
  const dvx = x - cx, dvy = y - cy, dvz = z - cz;
  if (dvx * dvx + dvy * dvy + dvz * dvz > 330 * 330) return 0;

  const amag = Math.sqrt(ax * ax + ay * ay + az * az);
  const anx = ax / amag, any = ay / amag, anz = az / amag;
  const cmag = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const snx = cx / cmag, sny = cy / cmag, snz = cz / cmag;
  let ppx = any * snz - anz * sny;
  let ppy = anz * snx - anx * snz;
  let ppz = anx * sny - any * snx;
  let pmag = Math.sqrt(ppx * ppx + ppy * ppy + ppz * ppz);
  if (pmag < 0.01) {
    ppx = any * 1 - anz * 0; ppy = anz * 0 - anx * 1; ppz = anx * 0 - any * 0;
    pmag = Math.sqrt(ppx * ppx + ppy * ppy + ppz * ppz);
  }
  const pnx = ppx / pmag, pny = ppy / pmag, pnz = ppz / pmag;

  const a    = dvx * anx + dvy * any + dvz * anz;
  const dist = dvx * pnx + dvy * pny + dvz * pnz;
  const aClamped = Math.max(-length / 2, Math.min(length / 2, a));

  const baseHW = 35 + noise3(seed, 0.1, 0.5) * 35;
  const hwVary = noise3(aClamped / 110, seed + 1, 0.5);
  const halfW  = baseHW * (0.45 + hwVary * 0.9);
  if (Math.abs(dist) >= halfW) return 0;

  const tDistRaw  = 1 - Math.abs(dist) / halfW;
  const hasCliff  = noise3(seed + 11, 0.5, 0.5) > 0.45;
  const cliffSide = noise3(seed + 12, 0.5, 0.5) > 0.5 ? 1.0 : -1.0;
  let tDist: number;
  if (hasCliff) {
    tDist = dist * cliffSide >= 0 ? Math.pow(tDistRaw, 0.35) : Math.pow(tDistRaw, 1.8);
  } else {
    tDist = tDistRaw;
  }

  const uAlong   = Math.abs(aClamped) / (length / 2);
  const tAlong   = 1 - uAlong * uAlong * (3 - 2 * uAlong);
  const envelope = tAlong * tDist * tDist;

  const baseH      = 12 + noise3(seed, 0.3, 0.5) * 13;
  const peakNoise  = noise3(aClamped / 42, dist / 42, seed + 2);
  const hasRidges  = noise3(seed + 17, 0.5, 0.5) > 0.60;
  const shapedNoise = hasRidges
    ? Math.pow(1 - Math.abs(peakNoise * 2 - 1), 2)
    : peakNoise;
  let h = baseH * envelope * (0.35 + shapedNoise * 0.65);

  const butteNoise = noise3(aClamped / 85, dist / 85, seed + 5);
  if (butteNoise > 0.70) {
    const capHeight = baseH * (0.5 + noise3(seed + 6, aClamped / 200, 0.5) * 0.3);
    h = Math.min(h, capHeight);
  }

  h += (noise3(x / 7, y / 7, z / 7) * 2 - 1) * baseH * 0.055;

  const hasCave = noise3(seed + 8, 0.5, 0.5) > 0.75;
  if (hasCave) {
    const caveN = noise3(aClamped / 55, dist / 15, seed + 9);
    if (caveN < 0.22 && Math.abs(dist) > halfW * 0.3) {
      h *= 0.3 + (caveN / 0.22) * 0.7;
    }
  }
  return Math.max(0, h);
}

function _mountainAdd(x: number, y: number, z: number): number {
  return (
    _mountainRange(x, y, z,    0,  334,  104,  1,   0,   0, 280, 2.7) +
    _mountainRange(x, y, z,  313,  157,    0,  0,   0,   1, 280, 4.1) +
    _mountainRange(x, y, z, -306,  153,  -76,  0, 0.3,   1, 280, 6.5) +
    _mountainRange(x, y, z,  143, -286, -143,  1,   0,   0, 280, 8.9) +
    _mountainRange(x, y, z, -210, -280,    0,  0,   0,   1, 280, 5.9)
  );
}

function _hoodooSpire(
  x: number, y: number, z: number,
  cx: number, cy: number, cz: number,
  seed: number,
): number {
  const dx = x - cx, dy = y - cy, dz = z - cz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= 7.5 * 7.5) return 0;
  const d = Math.sqrt(d2);
  const rCap   = 4.5 + noise3(seed, 1.1, 0.5) * 3.0;
  const rNeck  = 1.8 + noise3(seed, 2.2, 0.5) * 1.2;
  const totalH = 6   + noise3(seed, 3.3, 0.5) * 6;
  const capFrac = 0.25 + noise3(seed, 4.4, 0.5) * 0.2;
  if (d >= rCap) return 0;
  const hCap    = totalH * capFrac;
  const hPillar = totalH - hCap;
  const tNeck   = Math.max(0, 1 - d / rNeck);
  const pillar  = hPillar * tNeck * tNeck * tNeck;
  const tCap    = Math.max(0, 1 - d / rCap);
  const cap     = hCap * tCap * tCap;
  return pillar + cap;
}

function _hoodooAdd(x: number, y: number, z: number): number {
  return (
    _hoodooSpire(x, y, z,  248,  248,    0, 3.7) +
    _hoodooSpire(x, y, z, -248,  248,    0, 4.8) +
    _hoodooSpire(x, y, z,    0,  248,  248, 6.1) +
    _hoodooSpire(x, y, z,  202,  202,  202, 5.5) +
    _hoodooSpire(x, y, z, -202,  202,  202, 9.8) +
    _hoodooSpire(x, y, z,    0,  248, -248, 10.5) +
    _hoodooSpire(x, y, z,  202,  202, -202, 6.8) +
    _hoodooSpire(x, y, z, -202,  202, -202, 1.4) +
    _hoodooSpire(x, y, z,  350,    0,    0, 11.2) +
    _hoodooSpire(x, y, z,  248,    0,  248, 7.4) +
    _hoodooSpire(x, y, z, -248,    0,  248, 8.7) +
    _hoodooSpire(x, y, z,  248,    0, -248, 7.7) +
    _hoodooSpire(x, y, z, -248,    0, -248, 8.2) +
    _hoodooSpire(x, y, z,    0, -248,  248, 2.3) +
    _hoodooSpire(x, y, z,  202, -202,  202, 1.9) +
    _hoodooSpire(x, y, z, -202, -202,  202, 3.1) +
    _hoodooSpire(x, y, z,    0, -248, -248, 9.1) +
    _hoodooSpire(x, y, z, -202, -202, -202, 12.3) +
    _hoodooSpire(x, y, z,    0, -332,  110, 4.2)
  );
}

function computeHeight(x: number, y: number, z: number): number {
  return _noise.Get(x, y, z) - _canyonAdd(x, y, z) + _mountainAdd(x, y, z) + _hoodooAdd(x, y, z);
}

// ---- Geometry builder ----
// Replicates TerrainChunk._Rebuild() without THREE.js.
// Matrix m is a column-major Float32 array (THREE.Matrix4.elements).
function buildChunk(
  m: number[],
  ox: number, oy: number, oz: number,
  width: number,
  resolution: number,
  radius: number,
): {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  fillPositions: Float32Array;
} {
  const n    = resolution + 1;
  const half = width / 2;

  const positions = new Float32Array(n * n * 3);
  const normals   = new Float32Array(n * n * 3);
  const uvs       = new Float32Array(n * n * 2);

  for (let xi = 0; xi < n; xi++) {
    const xp = width * xi / resolution;
    for (let yi = 0; yi < n; yi++) {
      const yp = width * yi / resolution;

      // Place point on face quad, then project onto sphere
      let px = xp - half + ox;
      let py = yp - half + oy;
      let pz = radius + oz;

      const plen = Math.sqrt(px * px + py * py + pz * pz);
      const dx = px / plen, dy = py / plen, dz = pz / plen;  // sphere-surface normal

      // Sphere surface in face-local space (_P.multiplyScalar(radius); _P.z -= radius)
      px = dx * radius;
      py = dy * radius;
      pz = dz * radius - radius;

      // Transform to world space for height sampling (column-major matrix)
      const wx = m[0] * px + m[4] * py + m[8]  * pz + m[12];
      const wy = m[1] * px + m[5] * py + m[9]  * pz + m[13];
      const wz = m[2] * px + m[6] * py + m[10] * pz + m[14];

      const height = computeHeight(wx, wy, wz);

      px += dx * height;
      py += dy * height;
      pz += dz * height;

      const vi = (xi * n + yi) * 3;
      positions[vi]     = px;
      positions[vi + 1] = py;
      positions[vi + 2] = pz;

      normals[vi]     = dx;
      normals[vi + 1] = dy;
      normals[vi + 2] = dz;

      const ui = (xi * n + yi) * 2;
      uvs[ui]     = px / 10;
      uvs[ui + 1] = py / 10;
    }
  }

  // Index generation
  const nTris  = resolution * resolution * 2;
  const indices = new Uint32Array(nTris * 3);
  let ii = 0;
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      indices[ii++] = i * n + j;
      indices[ii++] = (i + 1) * n + j + 1;
      indices[ii++] = i * n + j + 1;
      indices[ii++] = (i + 1) * n + j;
      indices[ii++] = (i + 1) * n + j + 1;
      indices[ii++] = i * n + j;
    }
  }

  // Normal accumulation from face normals
  for (let k = 0; k < nTris * 3; k += 3) {
    const i1 = indices[k]     * 3;
    const i2 = indices[k + 1] * 3;
    const i3 = indices[k + 2] * 3;

    const d1x = positions[i3]     - positions[i2];
    const d1y = positions[i3 + 1] - positions[i2 + 1];
    const d1z = positions[i3 + 2] - positions[i2 + 2];
    const d2x = positions[i1]     - positions[i2];
    const d2y = positions[i1 + 1] - positions[i2 + 1];
    const d2z = positions[i1 + 2] - positions[i2 + 2];

    const nx = d1y * d2z - d1z * d2y;
    const ny = d1z * d2x - d1x * d2z;
    const nz = d1x * d2y - d1y * d2x;

    normals[i1]     += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz;
    normals[i2]     += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz;
    normals[i3]     += nx; normals[i3 + 1] += ny; normals[i3 + 2] += nz;
  }

  // Normalize normals
  for (let k = 0; k < normals.length; k += 3) {
    const len = Math.sqrt(normals[k] * normals[k] + normals[k + 1] * normals[k + 1] + normals[k + 2] * normals[k + 2]);
    if (len > 0) { normals[k] /= len; normals[k + 1] /= len; normals[k + 2] /= len; }
  }

  // Fill mesh: 99.5% scale + z offset (matches terrain-chunk.ts formula)
  const fillPositions = new Float32Array(positions.length);
  for (let k = 0; k < positions.length; k += 3) {
    fillPositions[k]     = positions[k]     * 0.995;
    fillPositions[k + 1] = positions[k + 1] * 0.995;
    fillPositions[k + 2] = positions[k + 2] * 0.995 - 0.005 * radius;
  }

  return { positions, normals, uvs, indices, fillPositions };
}

// ---- Worker message handler ----
interface WorkerCtx {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(data: unknown, transfer: Transferable[]): void;
}
const ctx = self as unknown as WorkerCtx;

ctx.onmessage = (e: MessageEvent) => {
  const { id, matrix, ox, oy, oz, width, resolution, radius } = e.data as {
    id: number;
    matrix: number[];
    ox: number; oy: number; oz: number;
    width: number;
    resolution: number;
    radius: number;
  };

  try {
    const result = buildChunk(matrix, ox, oy, oz, width, resolution, radius);

    ctx.postMessage(
      { id, ...result },
      [
        result.positions.buffer,
        result.normals.buffer,
        result.uvs.buffer,
        result.indices.buffer,
        result.fillPositions.buffer,
      ],
    );
  } catch (err) {
    // Re-throw so the pool's onerror handler fires and decrements _pending.
    throw err;
  }
};
