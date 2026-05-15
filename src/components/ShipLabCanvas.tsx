'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EnemyType } from '@/game/EnemyShip';
import { spawnExplosion, type ExplosionHandle } from '@/game/labExplosion';

interface Props {
  type: EnemyType;
}

// ─── geometry helpers ────────────────────────────────────────────────────────

type V3 = [number, number, number];

/** Sample n+1 evenly-spaced points along segment a→b, push into out. */
function seg(a: V3, b: V3, n: number, out: number[]) {
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    );
  }
}

/** Build a closure that writes to both pts and cols arrays, with settable color.
 *  density scales every segment's point count (e.g. 0.5 = half as many points). */
function makeColoredSeg(pts: number[], cols: number[], density = 1.0) {
  let r = 1, g = 1, b = 1;
  function setColor(cr: number, cg: number, cb: number) { r = cr; g = cg; b = cb; }
  function cseg(a: V3, bv: V3, n: number) {
    const steps = Math.max(1, Math.round(n * density));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push(a[0]+(bv[0]-a[0])*t, a[1]+(bv[1]-a[1])*t, a[2]+(bv[2]-a[2])*t);
      cols.push(r, g, b);
    }
  }
  return { cseg, setColor };
}

// ─── flanker ─────────────────────────────────────────────────────────────────
function buildFlankerGeometry(): THREE.BufferGeometry {
  const pts: number[] = [];
  const cols: number[] = [];
  const { cseg, setColor } = makeColoredSeg(pts, cols, 0.65);
  setColor(1, 0.65, 0);

  const N:   V3 = [ 0,    0,    4.0];
  const LT:  V3 = [-4.6,  0,   -5.0];
  const RT:  V3 = [ 4.6,  0,   -5.0];
  const LIT: V3 = [-3.7,  0.7, -5.0];
  const RIT: V3 = [ 3.7,  0.7, -5.0];
  cseg(N,   LT,  55);
  cseg(N,   RT,  55);
  cseg(N,   LIT, 62);
  cseg(N,   RIT, 62);
  cseg(LT,  LIT, 10);
  cseg(RT,  RIT, 10);
  cseg(LT,  RT,  55);
  cseg(LIT, RIT, 44);

  const FHF = 0.75;  // front top height
  const FHB = 1.35;  // back top height (same angle, both lowered by 0.25)
  const FGY = 0.7;  // gold line height (matches LIT/RIT y)
  // y of YELLOW/CYAN bevel at z=1.5: bevel goes N=(0,0,4)→LIT=(±3.7,0.7,-5), y=0.7*(4-z)/9
  const FFY = 0.7 * (4 - 1.5) / 9;
  const FFL:  V3 = [-0.5, FFY,  1.5];
  const FFR:  V3 = [ 0.5, FFY,  1.5];
  const FGBL: V3 = [-0.5, FGY, -5.0];  // back-left at gold height
  const FGBR: V3 = [ 0.5, FGY, -5.0];  // back-right at gold height
  const FTBL: V3 = [-0.5, FHB, -5.0];  // top-back-left (lifted)
  const FTBR: V3 = [ 0.5, FHB, -5.0];  // top-back-right (lifted)
  const FTFL: V3 = [-0.5, FHF,  0.0];
  const FTFR: V3 = [ 0.5, FHF,  0.0];

  cseg(FFL,  FFR,  10);
  cseg(FTBL, FTBR, 10);
  cseg(FTBL, FTFL, 36);
  cseg(FTBR, FTFR, 36);
  cseg(FTFL, FTFR, 10);
  cseg(FFL,  FTFL,  8);
  cseg(FFR,  FTFR,  8);
  cseg(FFL,  FGBL, 36);
  cseg(FFR,  FGBR, 36);
  cseg(FGBL, FTBL,  5);
  cseg(FGBR, FTBR,  5);

  // Rectangular gun pod pointing along z. Front face is flat. Back face is a
  // diagonal cut: z_back differs per x-face, set to where the inner bevel
  // (N→LIT/RIT) crosses that x, so no part of the gun passes through the bevel.
  function addGun(side: 1 | -1): void {
    const gw = 0.45;  // gun width (outward)
    const gh = 0.35;  // gun height
    const zf = -1.5;  // front z

    const xi = side * 2.7;          // inner face x
    const xo = side * (2.7 + gw);   // outer face x

    // z where bevel N=(0,0,4)→(±3.7,0.7,-5) crosses each x:
    // |x| = 3.7*(4-z)/9  →  z = 4 - 9*|x|/3.7
    const zbi = 4 - 9 * 2.7 / 3.7;
    const zbo = 4 - 9 * (2.7 + gw) / 3.7;

    const ifb: V3 = [xi, 0,  zf ];  const ift: V3 = [xi, gh, zf ];
    const ibb: V3 = [xi, 0,  zbi];  const ibt: V3 = [xi, gh, zbi];
    const ofb: V3 = [xo, 0,  zf ];  const oft: V3 = [xo, gh, zf ];
    const obb: V3 = [xo, 0,  zbo];  const obt: V3 = [xo, gh, zbo];

    cseg(ifb, ift,  3);  cseg(ofb, oft,  3);   // front verticals only
    cseg(ift, oft,  4);                          // front face top only
    cseg(ibt, obt,  6);                          // back face top only
    cseg(ift, ibt, 14);  cseg(oft, obt, 20);   // top rails only

    // bottom clipped at outer diagonal (N→RT/LT): z = 4 - 9*|x|/4.6
    // inner bottom rail is fully inside the wing body — omit it
    // outer bottom: draw only the portion outside the wing, then close with diagonal clip edge
    const z_do    = 4 - 9 * Math.abs(xo) / 4.6;   // diagonal z at outer face ≈ -2.163
    const x_clip  = side * 4.6 * (4 - zf) / 9;    // x where diagonal crosses z=zf ≈ ±2.811
    const clip_bf: V3 = [x_clip, 0, zf];   // clip point on front face bottom
    const clip_ob: V3 = [xo,     0, z_do]; // clip point on outer bottom rail
    cseg(clip_bf, ofb,     3);   // partial front bottom: clip-x → outer corner
    cseg(ofb,     clip_ob, 5);   // outer bottom rail: front → diagonal
    cseg(clip_bf, clip_ob, 6);   // clip edge running along wing outer diagonal
  }

  addGun(-1);
  addGun( 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(cols, 3));
  return geo;
}

// ─── flanker fill bodies ──────────────────────────────────────────────────────
function buildFlankerFillMeshes(mat: THREE.Material): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  // wing body: 3D solid with 5 vertices (N, LT, RT, LIT, RIT)
  // Faces: flat bottom at y=0, inner top ramp N→LIT→RIT, two outer slants, back quad
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
     0,   0,   4.0,   // 0 N
    -4.6, 0,  -5.0,   // 1 LT
     4.6, 0,  -5.0,   // 2 RT
    -3.7, 0.7,-5.0,   // 3 LIT
     3.7, 0.7,-5.0,   // 4 RIT
  ], 3));
  wingGeo.setIndex([
    0,2,1,         // bottom: N-RT-LT (flat at y=0)
    1,3,4, 1,4,2,  // back quad: LT-LIT-RIT-RT
    0,1,3,         // left outer slant: N-LT-LIT
    0,4,2,         // right outer slant: N-RIT-RT
    0,3,4,         // inner top: N-LIT-RIT
  ]);
  meshes.push(new THREE.Mesh(wingGeo, mat));

  // fuselage: 8-vertex prism matching the point-cloud box
  const FFY = 0.7 * 2.5 / 9;   // y of YELLOW/CYAN bevel at z=1.5 — must match buildFlankerGeometry
  const fusGeo = new THREE.BufferGeometry();
  fusGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, FFY,  1.5,   // 0 FFL  front-left-bottom
     0.5, FFY,  1.5,   // 1 FFR  front-right-bottom
    -0.5, 0.75, 0.0,   // 2 FTFL top-front-left
     0.5, 0.75, 0.0,   // 3 FTFR top-front-right
    -0.5, 0.70,-5.0,   // 4 FGBL back-left-bottom
     0.5, 0.70,-5.0,   // 5 FGBR back-right-bottom
    -0.5, 1.35,-5.0,   // 6 FTBL top-back-left
     0.5, 1.35,-5.0,   // 7 FTBR top-back-right
  ], 3));
  fusGeo.setIndex([
    0,1,3, 0,3,2,   // front face
    5,4,6, 5,6,7,   // back face
    0,4,6, 0,6,2,   // left side
    1,3,7, 1,7,5,   // right side
    2,3,7, 2,7,6,   // top
    0,1,5, 0,5,4,   // bottom
  ]);
  meshes.push(new THREE.Mesh(fusGeo, mat));

  // gun barrels: hexahedra with diagonal back face matching the bevel cut
  function addGunFill(side: 1 | -1): void {
    const gw = 0.45, gh = 0.35, zf = -1.5;
    const xi = side * 2.7;
    const xo = side * (2.7 + gw);
    const zbi = 4 - 9 * 2.7 / 3.7;
    const zbo = 4 - 9 * (2.7 + gw) / 3.7;
    const gunGeo = new THREE.BufferGeometry();
    gunGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      xi, 0,  zf,    // 0 ifb inner-front-bottom
      xi, gh, zf,    // 1 ift inner-front-top
      xi, 0,  zbi,   // 2 ibb inner-back-bottom
      xi, gh, zbi,   // 3 ibt inner-back-top
      xo, 0,  zf,    // 4 ofb outer-front-bottom
      xo, gh, zf,    // 5 oft outer-front-top
      xo, 0,  zbo,   // 6 obb outer-back-bottom
      xo, gh, zbo,   // 7 obt outer-back-top
    ], 3));
    gunGeo.setIndex([
      0,4,5, 0,5,1,   // front face
      2,3,7, 2,7,6,   // back face (diagonal)
      0,1,3, 0,3,2,   // inner face
      4,6,7, 4,7,5,   // outer face
      1,5,7, 1,7,3,   // top
      0,2,6, 0,6,4,   // bottom
    ]);
    meshes.push(new THREE.Mesh(gunGeo, mat));
  }
  addGunFill(-1);
  addGunFill( 1);

  return meshes;
}

// ─── pusher ──────────────────────────────────────────────────────────────────
function buildPusherGeometry(): THREE.BufferGeometry {
  const pts: number[] = [];
  const cols: number[] = [];
  const { cseg, setColor } = makeColoredSeg(pts, cols, 0.65);
  setColor(1, 0, 0);
  // ── outer silhouette ─────────────────────────────────────
  const N:  V3 = [ 0,    0,    3.0];
  const LW:  V3 = [-4.5,  0,    0.5];
  const RW:  V3 = [ 4.5,  0,    0.5];
  const LT:  V3 = [-1.5,  0,   -3.0];
  const RT:  V3 = [ 1.5,  0,   -3.0];
  // Shortened RED/GREEN endpoints — MAROON/NAVY connect here instead of LW/RW
  const LWS: V3 = [-3.0,  0,    1.33];
  const RWS: V3 = [ 3.0,  0,    1.33];
  // ORANGE/CYAN stop here (on LW→LT and RW→RT lines; also MAGENTA/BLUE endpoints)
  const LSR: V3 = [-3.39, 0,   -0.8];
  const RSR: V3 = [ 3.39, 0,   -0.8];

  cseg(N,  LWS, 30);
  cseg(N,  RWS, 30);
  cseg(LT, LSR, 20);
  cseg(RT, RSR, 20);
  cseg(LT, RT,  20);

  // ── center ridge ─────────────────────────────────────────
  const NR:  V3 = [ 0,    1.3,  2.6];
  const TR:  V3 = [ 0,    0.7, -2.8];
  const LTR: V3 = [-0.8,  0.7, -2.8];
  const RTR: V3 = [ 0.8,  0.7, -2.8];

  cseg(N,   NR,    8);
  cseg(NR,  TR,   52);
  cseg(TR,  LTR,   6);
  cseg(TR,  RTR,   6);
  cseg(LTR, LT,   18);
  cseg(RTR, RT,   18);

  // ── wing slope upper edges ────────────────────────────────
  const LSF: V3 = [-1.4,  1.05,  2.0];
  const RSF: V3 = [ 1.4,  1.05,  2.0];

  cseg(NR,  LSF,  12);
  cseg(LSF, LSR,  28);
  cseg(NR,  RSF,  12);
  cseg(RSF, RSR,  28);
  cseg(LSF, LWS,  20);
  cseg(RSF, RWS,  20);
  cseg(RWS, RSR,  15);
  cseg(LWS, LSR,  15);
  cseg(RSF, RTR,  30);
  cseg(LSF, LTR,  30);

  // ── cockpit box ───────────────────────────────────────────
  const cByR = 1.30;  const cTyR = 1.90;  // rear face center y
  const cByF = 1.15;  const cTyF = 1.75;  // front face center y (angled, 0.15 lower)
  const cFz = 2.05;   const cRz = 1.25;
  const cHw = 0.48;
  // outer edges slope down from center on both top and bottom — matches LIME/CORAL (0.25/1.4)
  const cSlope = 0.25 / 1.4;
  const cTeR = cTyR - cSlope * cHw;  // rear outer top y
  const cTeF = cTyF - cSlope * cHw;  // front outer top y
  const cBeR = cByR - cSlope * cHw;  // rear outer bottom y
  const cBeF = cByF - cSlope * cHw;  // front outer bottom y

  const cFLb: V3 = [-cHw, cBeR, cFz];  const cFRb: V3 = [ cHw, cBeR, cFz];
  const cRLb: V3 = [-cHw, cBeF, cRz];  const cRRb: V3 = [ cHw, cBeF, cRz];
  const cFLt: V3 = [-cHw, cTeR, cFz];  const cFRt: V3 = [ cHw, cTeR, cFz];
  const cRLt: V3 = [-cHw, cTeF, cRz];  const cRRt: V3 = [ cHw, cTeF, cRz];
  const cFCb: V3 = [   0, cByR, cFz];  // rear center bottom
  const cRCb: V3 = [   0, cByF, cRz];  // front center bottom
  const cFCt: V3 = [   0, cTyR, cFz];  // rear center top peak
  const cRCt: V3 = [   0, cTyF, cRz];  // front center top peak

  cseg(cFLb, cFCb, 4);
  cseg(cFCb, cFRb, 4);
  cseg(cRLb, cRCb, 4);
  cseg(cRCb, cRRb, 4);
  cseg(cFCb, cRCb, 6);
  cseg(cFLb, cRLb, 6);
  cseg(cFRb, cRRb, 6);
  cseg(cFLt, cFCt, 4);
  cseg(cFCt, cFRt, 4);
  cseg(cRLt, cRCt, 4);
  cseg(cRCt, cRRt, 4);
  cseg(cFCt, cRCt, 6);
  cseg(cFLt, cRLt, 6);
  cseg(cFRt, cRRt, 6);
  cseg(cFLb, cFLt, 5);
  cseg(cFRb, cFRt, 5);
  cseg(cRLb, cRLt, 5);
  cseg(cRRb, cRRt, 5);

  // ── gun barrels ───────────────────────────────────────────
  function addGun(cx: number, cy: number): void {
    const hw  = 0.14;  const gh = 0.20;
    const bz  = -1.55;  // barrel tip (display-front)
    // back z per face follows BLUE/MAGENTA line: z = 2.0 - 2.8*(|x|-1.4)/1.99
    const lineZ = (x: number) => 2.0 - 2.8 * (Math.abs(x) - 1.4) / 1.99;
    const flz = lineZ(cx - hw);
    const frz = lineZ(cx + hw);
    const fl:  V3 = [cx - hw, cy,      flz];
    const fr:  V3 = [cx + hw, cy,      frz];
    const rl:  V3 = [cx - hw, cy,      bz];
    const rr:  V3 = [cx + hw, cy,      bz];
    const tfl: V3 = [cx - hw, cy + gh, flz];
    const tfr: V3 = [cx + hw, cy + gh, frz];
    const trl: V3 = [cx - hw, cy + gh, bz];
    const trr: V3 = [cx + hw, cy + gh, bz];
    cseg(fl,  fr,   3);  cseg(rl,  rr,   3);
    cseg(fl,  rl,  14);  cseg(fr,  rr,  14);
    cseg(tfl, tfr,  3);  cseg(trl, trr,  3);
    cseg(tfl, trl, 14);  cseg(tfr, trr, 14);
    cseg(fl,  tfl,  3);  cseg(fr,  tfr,  3);
    cseg(rl,  trl,  3);  cseg(rr,  trr,  3);
  }

  addGun(-2.5, 0.196);
  addGun( 2.5, 0.196);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(cols, 3));
  return geo;
}

// ─── pusher fill bodies ───────────────────────────────────────────────────────
function buildPusherFillMeshes(mat: THREE.Material): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  // Wing base: flat 7-gon at y=0 covering the full silhouette
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
     0,    0,    3.0,   // 0 N
    -3.0,  0,    1.33,  // 1 LWS
     3.0,  0,    1.33,  // 2 RWS
    -3.39, 0,   -0.8,   // 3 LSR
     3.39, 0,   -0.8,   // 4 RSR
    -1.5,  0,   -3.0,   // 5 LT
     1.5,  0,   -3.0,   // 6 RT
  ], 3));
  wingGeo.setIndex([
    0,2,1,        // front: N-RWS-LWS
    1,2,4, 1,4,3, // mid
    3,4,6, 3,6,5, // back
  ]);
  meshes.push(new THREE.Mesh(wingGeo, mat));

  // Ridge body: 3D spine above the wing, bounded by the slope/ridge wire edges
  const ridgeGeo = new THREE.BufferGeometry();
  ridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute([
     0,    0,    3.0,   // 0  N
    -3.0,  0,    1.33,  // 1  LWS
     3.0,  0,    1.33,  // 2  RWS
    -3.39, 0,   -0.8,   // 3  LSR
     3.39, 0,   -0.8,   // 4  RSR
    -1.5,  0,   -3.0,   // 5  LT
     1.5,  0,   -3.0,   // 6  RT
     0,    1.3,  2.6,   // 7  NR
    -1.4,  1.05, 2.0,   // 8  LSF
     1.4,  1.05, 2.0,   // 9  RSF
     0,    0.7, -2.8,   // 10 TR
    -0.8,  0.7, -2.8,   // 11 LTR
     0.8,  0.7, -2.8,   // 12 RTR
  ], 3));
  ridgeGeo.setIndex([
    // front-left outer: N-NR-LSF, N-LSF-LWS
    0,7,8, 0,8,1,
    // front-right outer: N-RSF-NR, N-RWS-RSF
    0,9,7, 0,2,9,
    // upper-left: NR-LSF-LTR, NR-LTR-TR
    7,8,11, 7,11,10,
    // upper-right: NR-TR-RTR, NR-RTR-RSF
    7,10,12, 7,12,9,
    // left outer triangle: LSF-LWS-LSR (MAROON/STEEL/MAGENTA)
    8,1,3,
    // left inner quad: LSF-LSR-LT-LTR (MAGENTA/ORANGE/TEAL/VERMILLION)
    8,3,5, 8,5,11,
    // right outer triangle: RSF-RWS-RSR (NAVY/ROSE/BLUE)
    9,2,4,
    // right inner quad: RSF-RSR-RT-RTR (BLUE/CYAN/SKYBLUE/GRASS)
    9,4,6, 9,6,12,
    // back face: LTR-RTR-RT-LT
    11,12,6, 11,6,5,
  ]);
  meshes.push(new THREE.Mesh(ridgeGeo, mat));

  // Cockpit box: peaked top and valleyed bottom (12 vertices)
  const cByR = 1.30, cTyR = 1.90;
  const cByF = 1.15, cTyF = 1.75;
  const cFz  = 2.05, cRz  = 1.25;
  const cHw  = 0.48;
  const cSlope = 0.25 / 1.4;
  const cTeR = cTyR - cSlope * cHw;
  const cTeF = cTyF - cSlope * cHw;
  const cBeR = cByR - cSlope * cHw;
  const cBeF = cByF - cSlope * cHw;

  const cockGeo = new THREE.BufferGeometry();
  cockGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -cHw, cBeR, cFz,  //  0 cFLb
     cHw, cBeR, cFz,  //  1 cFRb
       0, cByR, cFz,  //  2 cFCb
    -cHw, cTeR, cFz,  //  3 cFLt
     cHw, cTeR, cFz,  //  4 cFRt
       0, cTyR, cFz,  //  5 cFCt
    -cHw, cBeF, cRz,  //  6 cRLb
     cHw, cBeF, cRz,  //  7 cRRb
       0, cByF, cRz,  //  8 cRCb
    -cHw, cTeF, cRz,  //  9 cRLt
     cHw, cTeF, cRz,  // 10 cRRt
       0, cTyF, cRz,  // 11 cRCt
  ], 3));
  cockGeo.setIndex([
    // rear face (cFz): fan from center
    0,2,5, 0,5,3,    // left half
    2,1,4, 2,4,5,    // right half
    // front face (cRz)
    6,8,11, 6,11,9,  // left half
    8,7,10, 8,10,11, // right half
    // left side
    0,3,9, 0,9,6,
    // right side
    1,7,10, 1,10,4,
    // top-left ridge
    3,5,11, 3,11,9,
    // top-right ridge
    4,10,11, 4,11,5,
    // bottom-left valley
    0,6,8, 0,8,2,
    // bottom-right valley
    1,2,8, 1,8,7,
  ]);
  meshes.push(new THREE.Mesh(cockGeo, mat));

  // Gun barrels: back face is diagonal (follows BLUE/MAGENTA slope), front is flat
  function addGunFill(cx: number, cy: number): void {
    const hw = 0.14, gh = 0.20, bz = -1.55;
    const lineZ = (x: number) => 2.0 - 2.8 * (Math.abs(x) - 1.4) / 1.99;
    const flz = lineZ(cx - hw);
    const frz = lineZ(cx + hw);
    const gunGeo = new THREE.BufferGeometry();
    gunGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      cx-hw, cy,    flz,  // 0 fl
      cx+hw, cy,    frz,  // 1 fr
      cx-hw, cy,    bz,   // 2 rl
      cx+hw, cy,    bz,   // 3 rr
      cx-hw, cy+gh, flz,  // 4 tfl
      cx+hw, cy+gh, frz,  // 5 tfr
      cx-hw, cy+gh, bz,   // 6 trl
      cx+hw, cy+gh, bz,   // 7 trr
    ], 3));
    gunGeo.setIndex([
      0,1,5, 0,5,4,  // back face (slanted)
      2,6,7, 2,7,3,  // front face (flat)
      0,2,6, 0,6,4,  // left side
      1,5,7, 1,7,3,  // right side
      4,6,7, 4,7,5,  // top
      0,1,3, 0,3,2,  // bottom
    ]);
    meshes.push(new THREE.Mesh(gunGeo, mat));
  }
  addGunFill(-2.5, 0.196);
  addGunFill( 2.5, 0.196);

  return meshes;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function ShipLabCanvas({ type }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [exploded, setExploded] = useState(false);
  const actionsRef = useRef<{ explode: () => void; reset: () => void } | null>(null);

  useEffect(() => {
    setExploded(false);
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AxesHelper(2));

    const geo = type === 'pusher' ? buildPusherGeometry() : buildFlankerGeometry();
    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.1,
      sizeAttenuation: true,
    });

    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const objectGroup = new THREE.Group();
    if (type === 'pusher') objectGroup.rotation.y = Math.PI;
    scene.add(objectGroup);

    const points = new THREE.Points(geo, mat);
    objectGroup.add(points);

    const fillMeshes = type === 'pusher' ? buildPusherFillMeshes(fillMat) : buildFlankerFillMeshes(fillMat);
    fillMeshes.forEach(m => objectGroup.add(m));

    let rafId: number;
    let currentExplosion: ExplosionHandle | null = null;

    const shipColor = type === 'pusher'
      ? { r: 1, g: 0, b: 0 }
      : { r: 1, g: 0.65, b: 0 };

    actionsRef.current = {
      explode() {
        objectGroup.visible = false;
        currentExplosion?.dispose();
        currentExplosion = spawnExplosion(scene, new THREE.Vector3(0, 0, 0), shipColor);
        setExploded(true);
      },
      reset() {
        currentExplosion?.dispose();
        currentExplosion = null;
        objectGroup.visible = true;
        setExploded(false);
      },
    };

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      if (currentExplosion && !currentExplosion.tick()) currentExplosion = null;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      actionsRef.current = null;
      currentExplosion?.dispose();
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      geo.dispose();
      mat.dispose();
      fillMeshes.forEach(m => m.geometry.dispose());
      fillMat.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [type]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
        {!exploded ? (
          <button
            onClick={() => actionsRef.current?.explode()}
            className="font-mono text-xs text-white/70 border border-white/20 bg-white/5 px-4 py-1.5 hover:bg-white/10 cursor-pointer tracking-widest"
          >
            EXPLODE
          </button>
        ) : (
          <button
            onClick={() => actionsRef.current?.reset()}
            className="font-mono text-xs text-white/70 border border-white/20 bg-white/5 px-4 py-1.5 hover:bg-white/10 cursor-pointer tracking-widest"
          >
            PUT BACK
          </button>
        )}
      </div>
    </div>
  );
}
