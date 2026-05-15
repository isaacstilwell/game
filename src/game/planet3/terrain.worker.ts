import { computeHeight } from './computeHeight';

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
