import { NoiseGenerator } from './noise';
import { noise3 } from './perlin';

const _noise = new NoiseGenerator({
  octaves: 7,
  persistence: 1.2,
  lacunarity: 2.0,
  exponentiation: 2.8,
  height: 55.0,
  scale: 175.0,
  seed: 1,
});

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
    _canyonCarve(x, y, z,   0,   0, -350,            0.5,           0.866, 0, 9.2) +
    // crossing rift on the landing approach at θ≈0.22, runs along X so the player flies over it
    _canyonCarve(x, y, z,   0, -342,   76,              1,             0,   0, 7.3)
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
    _mountainRange(x, y, z, -210, -280,    0,  0,   0,   1, 280, 5.9) +
    // wall of mountains on the horizon beyond the landing zone (θ≈0.67)
    _mountainRange(x, y, z,    0, -275,  218,  1,   0,   0, 300, 11.3)
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
    _hoodooSpire(x, y, z,    0, -332,  110, 4.2) +
    // equatorial band
    _hoodooSpire(x, y, z,    0,  350,    0, 40.3) +
    _hoodooSpire(x, y, z, -350,    0,    0, 41.8) +
    _hoodooSpire(x, y, z,    0, -350,    0, 43.1) +
    _hoodooSpire(x, y, z,  248, -248,    0, 44.6) +
    _hoodooSpire(x, y, z, -248, -248,    0, 45.3) +
    _hoodooSpire(x, y, z,  200,  290,    0, 50.4) +
    _hoodooSpire(x, y, z, -200,  290,    0, 49.7) +
    _hoodooSpire(x, y, z,  130, -330,    0, 63.6) +
    _hoodooSpire(x, y, z, -130, -330,    0, 64.3) +
    // northern hemisphere (z > 0)
    _hoodooSpire(x, y, z,    0,    0,  350, 47.5) +
    _hoodooSpire(x, y, z,    0,  290,  200, 48.2) +
    _hoodooSpire(x, y, z,  150,    0,  320, 48.9) +
    _hoodooSpire(x, y, z, -150,    0,  320, 47.4) +
    _hoodooSpire(x, y, z,    0, -150,  320, 49.3) +
    _hoodooSpire(x, y, z,  180,  200,  250, 66.1) +
    _hoodooSpire(x, y, z, -180,  200,  250, 67.4) +
    _hoodooSpire(x, y, z,  100, -230,  260, 68.9) +
    _hoodooSpire(x, y, z, -100, -230,  260, 69.2) +
    // southern hemisphere (z < 0)
    _hoodooSpire(x, y, z,    0,    0, -350, 46.8) +
    _hoodooSpire(x, y, z,    0,  340,  -90, 51.9) +
    _hoodooSpire(x, y, z,  260,    0, -240, 53.1) +
    _hoodooSpire(x, y, z, -260,    0, -240, 52.6) +
    _hoodooSpire(x, y, z,    0, -260, -230, 54.8) +
    _hoodooSpire(x, y, z,  170,  170, -250, 55.5) +
    _hoodooSpire(x, y, z, -170,  170, -250, 56.2) +
    _hoodooSpire(x, y, z,  230, -170, -200, 57.7) +
    _hoodooSpire(x, y, z, -230, -170, -200, 58.4) +
    _hoodooSpire(x, y, z,   80, -290, -190, 59.1) +
    _hoodooSpire(x, y, z,  -80, -290, -190, 60.6) +
    // approach side, off the direct line and beyond landing zone
    _hoodooSpire(x, y, z,  160, -300,  140, 61.3) +
    _hoodooSpire(x, y, z, -160, -300,  140, 62.8) +
    _hoodooSpire(x, y, z,    0, -290,  195, 60.7) +
    _hoodooSpire(x, y, z,  220, -250,   90, 65.2) +
    _hoodooSpire(x, y, z, -220, -250,   90, 65.9)
  );
}

// Returns the height delta for a single impact crater (negative inside bowl, positive rim).
function _craterImpact(
  x: number, y: number, z: number,
  cx: number, cy: number, cz: number,
  radius: number, depth: number,
  seed: number,
): number {
  const dx = x - cx, dy = y - cy, dz = z - cz;
  const outerR = radius * 1.4;
  if (dx * dx + dy * dy + dz * dz > outerR * outerR) return 0;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < radius) {
    const t = d / radius;
    const bowl = -depth * (1 - t * t) * (1 - t * t * 0.2);
    const floorNoise = (noise3(x / 6, y / 6, z / 6 + seed * 0.01) * 2 - 1) * depth * 0.08;
    return bowl + floorNoise;
  }
  const t = (d - radius) / (outerR - radius);
  return depth * 0.18 * (1 - t) * (1 - t);
}

function _craterAdd(x: number, y: number, z: number): number {
  return (
    // global scatter — landing zone (0,-304,174) kept clear of all craters
    _craterImpact(x, y, z,    0,  350,    0,  18, 9, 30.1) +
    _craterImpact(x, y, z, -280,  200,    0,  12, 6, 31.8) +
    _craterImpact(x, y, z,  200,  280,    0,  10, 5, 32.5) +
    _craterImpact(x, y, z,    0,  250,  250,  20,10, 33.2) +
    _craterImpact(x, y, z, -200,  210,  200,   8, 4, 34.9) +
    _craterImpact(x, y, z,    0,    0,  350,  22,11, 35.6) +
    _craterImpact(x, y, z,    0,    0, -350,  15, 7, 36.3) +
    _craterImpact(x, y, z,  300, -180,    0,  14, 7, 37.8) +
    _craterImpact(x, y, z, -300,  180,    0,   9, 4, 38.5) +
    // was (0,-310,160) r=22 — moved; that position was 15 units from the landing zone
    _craterImpact(x, y, z,   80, -323,  110,  22,11, 39.2) +
    _craterImpact(x, y, z,  200, -200, -250,  11, 5, 40.7) +
    _craterImpact(x, y, z, -250, -150,  220,  14, 7, 41.4) +
    _craterImpact(x, y, z,  240,  200, -180,  16, 8, 42.1) +
    _craterImpact(x, y, z, -150,  320,   90,   9, 4, 43.6) +
    _craterImpact(x, y, z,  170, -280, -160,  13, 6, 44.3) +
    _craterImpact(x, y, z, -100,  100, -340,  10, 5, 45.8) +
    _craterImpact(x, y, z,  280,  -80,  190,  17, 8, 46.5) +
    _craterImpact(x, y, z,    0, -200, -290,  12, 6, 47.2) +
    _craterImpact(x, y, z, -220,  -90,  270,   8, 3, 48.7)
  );
}

// Base noise only — used for camera altitude so landmarks don't bob the ship.
export function computeBaseHeight(x: number, y: number, z: number): number {
  return _noise.Get(x, y, z);
}

export function computeHeight(x: number, y: number, z: number): number {
  return _noise.Get(x, y, z) - _canyonAdd(x, y, z) + _mountainAdd(x, y, z) + _hoodooAdd(x, y, z) + _craterAdd(x, y, z);
}
