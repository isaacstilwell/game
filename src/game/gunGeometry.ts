import * as THREE from 'three';

type V3 = [number, number, number];

export const GUN_BASE_H    = 2.25;   // pivot y (local): base/frustum seam
export const GUN_PITCH_MAX =  Math.PI / 4;  // +45° upward
export const GUN_PITCH_MIN = -Math.PI / 6;  // -30° downward

function makeColoredSeg(pts: number[], cols: number[], density = 1.0) {
  let r = 1, g = 1, b = 1;
  function setColor(cr: number, cg: number, cb: number) { r = cr; g = cg; b = cb; }
  function cseg(a: V3, bv: V3, n: number) {
    const steps = Math.max(1, Math.round(n * density));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push(a[0] + (bv[0] - a[0]) * t, a[1] + (bv[1] - a[1]) * t, a[2] + (bv[2] - a[2]) * t);
      cols.push(r, g, b);
    }
  }
  return { cseg, setColor };
}

// ─── base (static, y 0 → 2.25) ───────────────────────────────────────────────

export function buildBaseGeometry(): THREE.BufferGeometry {
  const pts: number[] = [];
  const cols: number[] = [];
  const { cseg, setColor } = makeColoredSeg(pts, cols, 0.65);
  setColor(1, 0, 0);

  const b0: V3 = [-1.0, 0.00, -1.0];  const b1: V3 = [ 1.0, 0.00, -1.0];
  const b2: V3 = [-1.0, 0.00,  1.0];  const b3: V3 = [ 1.0, 0.00,  1.0];
  const b4: V3 = [-1.0, 2.25, -1.0];  const b5: V3 = [ 1.0, 2.25, -1.0];
  const b6: V3 = [-1.0, 2.25,  1.0];  const b7: V3 = [ 1.0, 2.25,  1.0];

  cseg(b0, b1, 12); cseg(b2, b3, 12);
  cseg(b0, b2, 12); cseg(b1, b3, 12);
  cseg(b4, b5, 12); cseg(b6, b7, 12);
  cseg(b4, b6, 12); cseg(b5, b7, 12);
  cseg(b0, b4, 15); cseg(b1, b5, 15);
  cseg(b2, b6, 15); cseg(b3, b7, 15);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(cols, 3));
  return geo;
}

// ─── turret (pitched): bottom at y=0 fixed, top shears by z·tan(pitch) ───────

export function buildTurretGeometry(pitch: number): THREE.BufferGeometry {
  const t = Math.tan(pitch);
  const pts: number[] = [];
  const cols: number[] = [];
  const { cseg, setColor } = makeColoredSeg(pts, cols, 0.65);
  setColor(1, 0, 0);

  const f0: V3 = [-0.90, 0.00,                -0.85];
  const f1: V3 = [ 0.90, 0.00,                -0.85];
  const f2: V3 = [-0.90, 0.00,                 0.85];
  const f3: V3 = [ 0.90, 0.00,                 0.85];
  const f4: V3 = [-0.58, 1.20 + (-0.55) * t, -0.55];
  const f5: V3 = [ 0.58, 1.20 + (-0.55) * t, -0.55];
  const f6: V3 = [-0.58, 1.20 + ( 0.55) * t,  0.55];
  const f7: V3 = [ 0.58, 1.20 + ( 0.55) * t,  0.55];

  cseg(f0, f1, 11); cseg(f2, f3, 11);
  cseg(f0, f2, 11); cseg(f1, f3, 11);
  cseg(f4, f5,  7); cseg(f6, f7,  7);
  cseg(f4, f6,  7); cseg(f5, f7,  7);
  cseg(f0, f4,  6); cseg(f1, f5,  6);
  cseg(f2, f6,  6); cseg(f3, f7,  6);

  function addBarrel(cx: number): void {
    const hw = 0.10;
    const zb = -0.55; const zf = 1.50;
    const ybl = 0.85 + zb * t;  const ybf = 0.85 + zf * t;
    const ytl = 1.05 + zb * t;  const ytf = 1.05 + zf * t;

    const ll: V3 = [cx - hw, ybl, zb];  const lr: V3 = [cx + hw, ybl, zb];
    const lf: V3 = [cx - hw, ybf, zf];  const lfr: V3 = [cx + hw, ybf, zf];
    const ul: V3 = [cx - hw, ytl, zb];  const ur: V3 = [cx + hw, ytl, zb];
    const uf: V3 = [cx - hw, ytf, zf];  const ufr: V3 = [cx + hw, ytf, zf];

    setColor(1, 0.85, 0);
    cseg(ll, lr, 1); cseg(lf, lfr, 1);
    cseg(ul, ur, 1); cseg(uf, ufr, 1);
    cseg(ll, ul, 2); cseg(lr, ur, 2);
    cseg(lf, uf, 2); cseg(lfr, ufr, 2);

    setColor(1, 0, 0);
    cseg(ll, lf, 12); cseg(lr, lfr, 12);
    cseg(ul, uf, 12); cseg(ur, ufr, 12);
  }

  addBarrel(-0.28);
  addBarrel( 0.28);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(cols, 3));
  return geo;
}

// ─── fill bodies ─────────────────────────────────────────────────────────────

const STD_IDX = [
  0,2,3, 0,3,1,
  4,5,7, 4,7,6,
  0,4,6, 0,6,2,
  1,3,7, 1,7,5,
  0,1,5, 0,5,4,
  2,6,7, 2,7,3,
];

function box8(verts: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(STD_IDX);
  return g;
}

export function buildBaseFill(mat: THREE.Material): THREE.Mesh[] {
  return [new THREE.Mesh(box8([
    -1.0, 0.00, -1.0,   1.0, 0.00, -1.0,
    -1.0, 0.00,  1.0,   1.0, 0.00,  1.0,
    -1.0, 2.25, -1.0,   1.0, 2.25, -1.0,
    -1.0, 2.25,  1.0,   1.0, 2.25,  1.0,
  ]), mat)];
}

export function buildTurretFill(pitch: number, mat: THREE.Material): THREE.Mesh[] {
  const t = Math.tan(pitch);
  const meshes: THREE.Mesh[] = [];

  meshes.push(new THREE.Mesh(box8([
    -0.90, 0.00,                -0.85,   0.90, 0.00,                -0.85,
    -0.90, 0.00,                 0.85,   0.90, 0.00,                 0.85,
    -0.58, 1.20 + (-0.55) * t, -0.55,   0.58, 1.20 + (-0.55) * t, -0.55,
    -0.58, 1.20 + ( 0.55) * t,  0.55,   0.58, 1.20 + ( 0.55) * t,  0.55,
  ]), mat));

  for (const cx of [-0.28, 0.28]) {
    const hw = 0.10, zb = -0.55, zf = 1.50;
    const ybl = 0.85 + zb * t, ybf = 0.85 + zf * t;
    const ytl = 1.05 + zb * t, ytf = 1.05 + zf * t;
    meshes.push(new THREE.Mesh(box8([
      cx-hw, ybl, zb,  cx+hw, ybl, zb,
      cx-hw, ybf, zf,  cx+hw, ybf, zf,
      cx-hw, ytl, zb,  cx+hw, ytl, zb,
      cx-hw, ytf, zf,  cx+hw, ytf, zf,
    ]), mat));
  }

  return meshes;
}
