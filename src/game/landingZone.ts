import * as THREE from 'three';
import { computeHeight } from './planet3/computeHeight';
import { _PLANET_RADIUS, _MIN_CELL_SIZE, _LOD_MULTIPLIER } from './planet3/quadtree';

export const LANDING_THETA  = 0.52;
export const LANDING_RECT_W = 2.5;
export const LANDING_RECT_H = 3.75;

const R            = 350;
const MIN_CELL_RES = 128;

// Actual quadtree chunk sizes: the face root is _PLANET_RADIUS*2 wide and halves each level.
// Resolution formula matches terrain.ts: max(16, floor(MIN_CELL_RES * _MIN_CELL_SIZE / chunkSize))
// A chunk of size S becomes visible when its PARENT (size 2S) splits, i.e. dist < 2S * LOD_MULT.
// The root (size _S) has no parent, so it's the fallback at any distance.
const _S = _PLANET_RADIUS * 2; // 700 — face root size
const LODS = [
  { chunkSize: _S / 16, resolution: Math.max(16, Math.floor(MIN_CELL_RES * _MIN_CELL_SIZE / (_S / 16))), distThreshold: (_S / 8 ) * _LOD_MULTIPLIER },
  { chunkSize: _S / 8,  resolution: Math.max(16, Math.floor(MIN_CELL_RES * _MIN_CELL_SIZE / (_S / 8 ))), distThreshold: (_S / 4 ) * _LOD_MULTIPLIER },
  { chunkSize: _S / 4,  resolution: Math.max(16, Math.floor(MIN_CELL_RES * _MIN_CELL_SIZE / (_S / 4 ))), distThreshold: (_S / 2 ) * _LOD_MULTIPLIER },
  { chunkSize: _S / 2,  resolution: Math.max(16, Math.floor(MIN_CELL_RES * _MIN_CELL_SIZE / (_S / 2 ))), distThreshold: (_S      ) * _LOD_MULTIPLIER },
  { chunkSize: _S,      resolution: Math.max(16, Math.floor(MIN_CELL_RES * _MIN_CELL_SIZE / (_S      ))), distThreshold: Infinity                      },
];

function _tangentFrame(theta: number) {
  const landSphere = new THREE.Vector3(0, -R * Math.cos(theta), R * Math.sin(theta));
  const landNormal = landSphere.clone().normalize();
  let t1 = new THREE.Vector3(1, 0, 0).cross(landNormal).normalize();
  if (t1.length() < 0.01) t1 = new THREE.Vector3(0, 1, 0).cross(landNormal).normalize();
  const t2 = landNormal.clone().cross(t1).normalize();
  return { landSphere, t1, t2 };
}

function _buildGeo(
  landSphere: THREE.Vector3, t1: THREE.Vector3, t2: THREE.Vector3,
  rectW: number, rectH: number, chunkSize: number, resolution: number,
): THREE.BufferGeometry {
  const spacing = chunkSize / resolution;
  const nx      = Math.ceil(rectW / spacing);
  const ny      = Math.ceil(rectH / spacing);
  const pts: number[] = [];
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const dx  = (i / nx - 0.5) * rectW;
      const dy  = (j / ny - 0.5) * rectH;
      const raw = landSphere.clone().addScaledVector(t1, dx).addScaledVector(t2, dy);
      const n   = raw.clone().normalize();
      const sp  = n.clone().multiplyScalar(R);
      const h   = Math.max(0, computeHeight(sp.x, sp.y, sp.z) || 0);
      pts.push(sp.x + n.x * (h + 0.5), sp.y + n.y * (h + 0.5), sp.z + n.z * (h + 0.5));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

const BEAM_H = 1.5;

const _beamVert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const _beamFrag = `
uniform vec3 uColor;
uniform float uMaxAlpha;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(uColor, (1.0 - vUv.y) * uMaxAlpha);
}
`;

// Builds one gradient plane for a single rectangle edge.
// (u0,v0) and (u1,v1) are the edge endpoints in normalized rect coords [-0.5, 0.5].
function _buildEdgePlane(
  landSphere: THREE.Vector3, t1: THREE.Vector3, t2: THREE.Vector3,
  u0: number, v0: number, u1: number, v1: number,
  rectW: number, rectH: number,
): THREE.Mesh {
  const makeBase = (u: number, v: number) => {
    const raw = landSphere.clone().addScaledVector(t1, u * rectW).addScaledVector(t2, v * rectH);
    const n   = raw.clone().normalize();
    const sp  = n.clone().multiplyScalar(R);
    const h   = Math.max(0, computeHeight(sp.x, sp.y, sp.z) || 0);
    return { pt: sp.addScaledVector(n, h + 0.2), n };
  };

  const a  = makeBase(u0, v0);
  const b  = makeBase(u1, v1);

  const bl = a.pt;
  const br = b.pt;
  // Use per-vertex normals so adjacent planes share an identical top-corner point.
  const tl = bl.clone().addScaledVector(a.n, BEAM_H);
  const tr = br.clone().addScaledVector(b.n, BEAM_H);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    bl.x, bl.y, bl.z,
    br.x, br.y, br.z,
    tr.x, tr.y, tr.z,
    tl.x, tl.y, tl.z,
  ]), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0,0, 1,0, 1,1, 0,1]), 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2, 0,2,3]), 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: _beamVert,
    fragmentShader: _beamFrag,
    uniforms: {
      uColor:    { value: new THREE.Color(0xffee88) },
      uMaxAlpha: { value: 0.22 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Mesh(geo, mat);
}

export interface LandingZone {
  points: THREE.Points[];
  mats: THREE.PointsMaterial[];
  center: THREE.Vector3;
  beams: THREE.Mesh[];
}

export function buildLandingZone(parent: THREE.Object3D): LandingZone {
  const { landSphere, t1, t2 } = _tangentFrame(LANDING_THETA);
  const points: THREE.Points[] = [];
  const mats: THREE.PointsMaterial[] = [];

  for (const lod of LODS) {
    const geo = _buildGeo(landSphere, t1, t2, LANDING_RECT_W, LANDING_RECT_H, lod.chunkSize, lod.resolution);
    const mat = new THREE.PointsMaterial({ color: 0xffff00, sizeAttenuation: true, size: 2 });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    parent.add(pts);
    points.push(pts);
    mats.push(mat);
  }

  const edgeEndpoints: [number, number, number, number][] = [
    [-0.5, -0.5,  0.5, -0.5],
    [ 0.5, -0.5,  0.5,  0.5],
    [ 0.5,  0.5, -0.5,  0.5],
    [-0.5,  0.5, -0.5, -0.5],
  ];
  const beams: THREE.Mesh[] = [];
  for (const [u0, v0, u1, v1] of edgeEndpoints) {
    const m = _buildEdgePlane(landSphere, t1, t2, u0, v0, u1, v1, LANDING_RECT_W, LANDING_RECT_H);
    parent.add(m);
    beams.push(m);
  }

  return { points, mats, center: landSphere.clone(), beams };
}

// Call each frame. distToCenter: distance from camera to landing zone center (same space as geometry).
// surfaceDist: camera height above planet surface.
export function updateLandingZone(lz: LandingZone, distToCenter: number, surfaceDist: number): void {
  const baseSize = Math.max(0.04, surfaceDist * 0.003 * (1.25 / _LOD_MULTIPLIER));

  let activeIdx = LODS.length - 1;
  for (let i = 0; i < LODS.length; i++) {
    if (distToCenter < LODS[i].distThreshold) { activeIdx = i; break; }
  }

  for (let i = 0; i < LODS.length; i++) {
    lz.points[i].visible = i === activeIdx;
    if (i === activeIdx) {
      lz.mats[i].size = Math.min(5, baseSize * (MIN_CELL_RES / LODS[i].resolution));
    }
  }
}

export function disposeLandingZone(parent: THREE.Object3D, lz: LandingZone): void {
  for (const p of lz.points) {
    parent.remove(p);
    p.geometry.dispose();
  }
  for (const m of lz.beams) {
    parent.remove(m);
    m.geometry.dispose();
    (m.material as THREE.ShaderMaterial).dispose();
  }
}
