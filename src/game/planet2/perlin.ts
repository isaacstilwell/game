// Perlin noise implementation (ported from Stefan Gustavson's public domain code)
const perm = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,
  20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,
  230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,
  169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,
  147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,
  44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,
  104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,
  192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,
  29,24,72,243,141,128,195,78,66,215,61,156,180,
];
// doubled to avoid index wrapping
const p = [...perm, ...perm];

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t: number, a: number, b: number) { return a + t * (b - a); }
function grad(hash: number, x: number, y: number, z: number) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14) ? x : z;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x) & 0xff;
  const iy = Math.floor(y) & 0xff;
  const iz = Math.floor(z) & 0xff;
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const fz = z - Math.floor(z);

  const r = fade(fz);
  const t = fade(fy);
  const s = fade(fx);

  const n000 = grad(p[ix + p[iy + p[iz]]], fx, fy, fz);
  const n001 = grad(p[ix + p[iy + p[iz + 1]]], fx, fy, fz - 1);
  const n010 = grad(p[ix + p[iy + 1 + p[iz]]], fx, fy - 1, fz);
  const n011 = grad(p[ix + p[iy + 1 + p[iz + 1]]], fx, fy - 1, fz - 1);
  const n100 = grad(p[ix + 1 + p[iy + p[iz]]], fx - 1, fy, fz);
  const n101 = grad(p[ix + 1 + p[iy + p[iz + 1]]], fx - 1, fy, fz - 1);
  const n110 = grad(p[ix + 1 + p[iy + 1 + p[iz]]], fx - 1, fy - 1, fz);
  const n111 = grad(p[ix + 1 + p[iy + 1 + p[iz + 1]]], fx - 1, fy - 1, fz - 1);

  const nx0 = lerp(r, n000, n001);
  const nx1 = lerp(r, n010, n011);
  const nx2 = lerp(r, n100, n101);
  const nx3 = lerp(r, n110, n111);
  const ny0 = lerp(t, nx0, nx1);
  const ny1 = lerp(t, nx2, nx3);
  const n = lerp(s, ny0, ny1);

  return (1 + 0.936 * n) / 2;
}
