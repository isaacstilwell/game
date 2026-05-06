import * as THREE from 'three';

export type EnemyType = 'pusher' | 'flanker';

// ── geometry helpers ──────────────────────────────────────────────────────────
type V3 = [number, number, number];

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

// ── flanker (delta-wing, yellow) ──────────────────────────────────────────────
function buildFlankerGeometry(): THREE.BufferGeometry {
  const pts: number[] = [], cols: number[] = [];
  const { cseg, setColor } = makeColoredSeg(pts, cols, 0.65);
  setColor(1, 0.65, 0);

  const N:   V3 = [ 0,    0,    4.0];
  const LT:  V3 = [-4.6,  0,   -5.0];
  const RT:  V3 = [ 4.6,  0,   -5.0];
  const LIT: V3 = [-3.7,  0.7, -5.0];
  const RIT: V3 = [ 3.7,  0.7, -5.0];
  cseg(N, LT, 55);  cseg(N, RT, 55);
  cseg(N, LIT, 62); cseg(N, RIT, 62);
  cseg(LT, LIT, 10); cseg(RT, RIT, 10);
  cseg(LT, RT, 55);  cseg(LIT, RIT, 44);

  const FFY  = 0.7 * (4 - 1.5) / 9;
  const FFL: V3 = [-0.5, FFY,  1.5];  const FFR: V3 = [ 0.5, FFY,  1.5];
  const FGBL:V3 = [-0.5, 0.7, -5.0]; const FGBR:V3 = [ 0.5, 0.7, -5.0];
  const FTBL:V3 = [-0.5, 1.35,-5.0]; const FTBR:V3 = [ 0.5, 1.35,-5.0];
  const FTFL:V3 = [-0.5, 0.75, 0.0]; const FTFR:V3 = [ 0.5, 0.75, 0.0];
  cseg(FFL, FFR, 10);   cseg(FTBL, FTBR, 10);
  cseg(FTBL, FTFL, 36); cseg(FTBR, FTFR, 36);
  cseg(FTFL, FTFR, 10);
  cseg(FFL, FTFL, 8);   cseg(FFR, FTFR, 8);
  cseg(FFL, FGBL, 36);  cseg(FFR, FGBR, 36);
  cseg(FGBL, FTBL, 5);  cseg(FGBR, FTBR, 5);

  function addGun(side: 1 | -1): void {
    const gw = 0.45, gh = 0.35, zf = -1.5;
    const xi = side * 2.7, xo = side * (2.7 + gw);
    const zbi = 4 - 9 * 2.7 / 3.7, zbo = 4 - 9 * (2.7 + gw) / 3.7;
    const ifb: V3=[xi,0,zf];  const ift: V3=[xi,gh,zf];
    const ibt: V3=[xi,gh,zbi];
    const ofb: V3=[xo,0,zf];  const oft: V3=[xo,gh,zf];
    const obt: V3=[xo,gh,zbo];
    cseg(ifb,ift,3); cseg(ofb,oft,3);
    cseg(ift,oft,4); cseg(ibt,obt,6);
    cseg(ift,ibt,14); cseg(oft,obt,20);
    const z_do   = 4 - 9 * Math.abs(xo) / 4.6;
    const x_clip = side * 4.6 * (4 - zf) / 9;
    const clip_bf: V3=[x_clip,0,zf], clip_ob: V3=[xo,0,z_do];
    cseg(clip_bf,ofb,3); cseg(ofb,clip_ob,5); cseg(clip_bf,clip_ob,6);
  }
  addGun(-1); addGun(1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(cols, 3));
  return geo;
}

function buildFlankerFillGeos(): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];

  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
     0,   0,   4.0,  -4.6, 0,  -5.0,   4.6, 0,  -5.0,
    -3.7, 0.7,-5.0,   3.7, 0.7,-5.0,
  ], 3));
  wingGeo.setIndex([0,2,1, 1,3,4,1,4,2, 0,1,3, 0,4,2, 0,3,4]);
  geos.push(wingGeo);

  const FFY = 0.7 * 2.5 / 9;
  const fusGeo = new THREE.BufferGeometry();
  fusGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5,FFY, 1.5,  0.5,FFY, 1.5,  -0.5,0.75,0.0,  0.5,0.75,0.0,
    -0.5,0.70,-5.0, 0.5,0.70,-5.0, -0.5,1.35,-5.0,  0.5,1.35,-5.0,
  ], 3));
  fusGeo.setIndex([
    0,1,3,0,3,2, 5,4,6,5,6,7, 0,4,6,0,6,2, 1,3,7,1,7,5, 2,3,7,2,7,6, 0,1,5,0,5,4,
  ]);
  geos.push(fusGeo);

  function addGunGeo(side: 1 | -1) {
    const gw=0.45,gh=0.35,zf=-1.5;
    const xi=side*2.7, xo=side*(2.7+gw);
    const zbi=4-9*2.7/3.7, zbo=4-9*(2.7+gw)/3.7;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      xi,0,zf, xi,gh,zf, xi,0,zbi, xi,gh,zbi,
      xo,0,zf, xo,gh,zf, xo,0,zbo, xo,gh,zbo,
    ], 3));
    g.setIndex([0,4,5,0,5,1, 2,3,7,2,7,6, 0,1,3,0,3,2, 4,6,7,4,7,5, 1,5,7,1,7,3, 0,2,6,0,6,4]);
    geos.push(g);
  }
  addGunGeo(-1); addGunGeo(1);
  return geos;
}

// ── pusher (ridge/cockpit, red) ───────────────────────────────────────────────
function buildPusherGeometry(): THREE.BufferGeometry {
  const pts: number[] = [], cols: number[] = [];
  const { cseg, setColor } = makeColoredSeg(pts, cols, 0.65);
  setColor(1, 0, 0);

  const N:   V3 = [ 0,    0,    3.0];
  const LT:  V3 = [-1.5,  0,   -3.0];
  const RT:  V3 = [ 1.5,  0,   -3.0];
  const LWS: V3 = [-3.0,  0,    1.33];
  const RWS: V3 = [ 3.0,  0,    1.33];
  const LSR: V3 = [-3.39, 0,   -0.8];
  const RSR: V3 = [ 3.39, 0,   -0.8];
  cseg(N,LWS,30); cseg(N,RWS,30);
  cseg(LT,LSR,20); cseg(RT,RSR,20); cseg(LT,RT,20);

  const NR:  V3 = [ 0,   1.3,  2.6];
  const TR:  V3 = [ 0,   0.7, -2.8];
  const LTR: V3 = [-0.8, 0.7, -2.8];
  const RTR: V3 = [ 0.8, 0.7, -2.8];
  cseg(N,NR,8); cseg(NR,TR,52);
  cseg(TR,LTR,6); cseg(TR,RTR,6);
  cseg(LTR,LT,18); cseg(RTR,RT,18);

  const LSF: V3 = [-1.4, 1.05,  2.0];
  const RSF: V3 = [ 1.4, 1.05,  2.0];
  cseg(NR,LSF,12); cseg(LSF,LSR,28);
  cseg(NR,RSF,12); cseg(RSF,RSR,28);
  cseg(LSF,LWS,20); cseg(RSF,RWS,20);
  cseg(RWS,RSR,15); cseg(LWS,LSR,15);
  cseg(RSF,RTR,30); cseg(LSF,LTR,30);

  const cByR=1.30,cTyR=1.90,cByF=1.15,cTyF=1.75;
  const cFz=2.05,cRz=1.25,cHw=0.48,cSlope=0.25/1.4;
  const cTeR=cTyR-cSlope*cHw, cTeF=cTyF-cSlope*cHw;
  const cBeR=cByR-cSlope*cHw, cBeF=cByF-cSlope*cHw;
  const cFLb:V3=[-cHw,cBeR,cFz], cFRb:V3=[cHw,cBeR,cFz];
  const cRLb:V3=[-cHw,cBeF,cRz], cRRb:V3=[cHw,cBeF,cRz];
  const cFLt:V3=[-cHw,cTeR,cFz], cFRt:V3=[cHw,cTeR,cFz];
  const cRLt:V3=[-cHw,cTeF,cRz], cRRt:V3=[cHw,cTeF,cRz];
  const cFCb:V3=[0,cByR,cFz], cRCb:V3=[0,cByF,cRz];
  const cFCt:V3=[0,cTyR,cFz], cRCt:V3=[0,cTyF,cRz];
  cseg(cFLb,cFCb,4); cseg(cFCb,cFRb,4);
  cseg(cRLb,cRCb,4); cseg(cRCb,cRRb,4);
  cseg(cFCb,cRCb,6); cseg(cFLb,cRLb,6); cseg(cFRb,cRRb,6);
  cseg(cFLt,cFCt,4); cseg(cFCt,cFRt,4);
  cseg(cRLt,cRCt,4); cseg(cRCt,cRRt,4);
  cseg(cFCt,cRCt,6); cseg(cFLt,cRLt,6); cseg(cFRt,cRRt,6);
  cseg(cFLb,cFLt,5); cseg(cFRb,cFRt,5);
  cseg(cRLb,cRLt,5); cseg(cRRb,cRRt,5);

  function addGun(cx: number, cy: number): void {
    const hw=0.14,gh=0.20,bz=-1.55;
    const lineZ=(x:number)=>2.0-2.8*(Math.abs(x)-1.4)/1.99;
    const flz=lineZ(cx-hw), frz=lineZ(cx+hw);
    const fl:V3=[cx-hw,cy,flz],   fr:V3=[cx+hw,cy,frz];
    const rl:V3=[cx-hw,cy,bz],    rr:V3=[cx+hw,cy,bz];
    const tfl:V3=[cx-hw,cy+gh,flz],tfr:V3=[cx+hw,cy+gh,frz];
    const trl:V3=[cx-hw,cy+gh,bz], trr:V3=[cx+hw,cy+gh,bz];
    cseg(fl,fr,3);   cseg(rl,rr,3);
    cseg(fl,rl,14);  cseg(fr,rr,14);
    cseg(tfl,tfr,3); cseg(trl,trr,3);
    cseg(tfl,trl,14);cseg(tfr,trr,14);
    cseg(fl,tfl,3);  cseg(fr,tfr,3);
    cseg(rl,trl,3);  cseg(rr,trr,3);
  }
  addGun(-2.5,0.196); addGun(2.5,0.196);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(cols, 3));
  return geo;
}

function buildPusherFillGeos(): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];

  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
     0,    0,    3.0,  -3.0,  0,   1.33,  3.0,  0,   1.33,
    -3.39, 0,   -0.8,   3.39, 0,  -0.8,
    -1.5,  0,   -3.0,   1.5,  0,  -3.0,
  ], 3));
  wingGeo.setIndex([0,2,1, 1,2,4,1,4,3, 3,4,6,3,6,5]);
  geos.push(wingGeo);

  const ridgeGeo = new THREE.BufferGeometry();
  ridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute([
     0,    0,    3.0,  -3.0,  0,    1.33,  3.0,  0,    1.33,
    -3.39, 0,   -0.8,   3.39, 0,   -0.8,  -1.5,  0,   -3.0,   1.5,  0,   -3.0,
     0,    1.3,  2.6,  -1.4,  1.05, 2.0,   1.4,  1.05, 2.0,
     0,    0.7, -2.8,  -0.8,  0.7, -2.8,   0.8,  0.7, -2.8,
  ], 3));
  ridgeGeo.setIndex([
    0,7,8,0,8,1,  0,9,7,0,2,9,
    7,8,11,7,11,10, 7,10,12,7,12,9,
    8,1,3, 8,3,5,8,5,11,
    9,2,4, 9,4,6,9,6,12,
    11,12,6,11,6,5,
  ]);
  geos.push(ridgeGeo);

  const cByR=1.30,cTyR=1.90,cByF=1.15,cTyF=1.75;
  const cFz=2.05,cRz=1.25,cHw=0.48,cSlope=0.25/1.4;
  const cTeR=cTyR-cSlope*cHw, cTeF=cTyF-cSlope*cHw;
  const cBeR=cByR-cSlope*cHw, cBeF=cByF-cSlope*cHw;
  const cockGeo = new THREE.BufferGeometry();
  cockGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -cHw,cBeR,cFz,  cHw,cBeR,cFz,    0,cByR,cFz,
    -cHw,cTeR,cFz,  cHw,cTeR,cFz,    0,cTyR,cFz,
    -cHw,cBeF,cRz,  cHw,cBeF,cRz,    0,cByF,cRz,
    -cHw,cTeF,cRz,  cHw,cTeF,cRz,    0,cTyF,cRz,
  ], 3));
  cockGeo.setIndex([
    0,2,5,0,5,3, 2,1,4,2,4,5,
    6,8,11,6,11,9, 8,7,10,8,10,11,
    0,3,9,0,9,6, 1,7,10,1,10,4,
    3,5,11,3,11,9, 4,10,11,4,11,5,
    0,6,8,0,8,2, 1,2,8,1,8,7,
  ]);
  geos.push(cockGeo);

  function addGunGeo(cx: number, cy: number) {
    const hw=0.14,gh=0.20,bz=-1.55;
    const lineZ=(x:number)=>2.0-2.8*(Math.abs(x)-1.4)/1.99;
    const flz=lineZ(cx-hw), frz=lineZ(cx+hw);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      cx-hw,cy,flz,  cx+hw,cy,frz,  cx-hw,cy,bz,    cx+hw,cy,bz,
      cx-hw,cy+gh,flz, cx+hw,cy+gh,frz, cx-hw,cy+gh,bz, cx+hw,cy+gh,bz,
    ], 3));
    g.setIndex([0,1,5,0,5,4, 2,6,7,2,7,3, 0,2,6,0,6,4, 1,5,7,1,7,3, 4,6,7,4,7,5, 0,1,3,0,3,2]);
    geos.push(g);
  }
  addGunGeo(-2.5,0.196); addGunGeo(2.5,0.196);
  return geos;
}

// ── shared module-level resources (built once) ────────────────────────────────
const FLANKER_GEO       = buildFlankerGeometry();
const PUSHER_GEO        = buildPusherGeometry();
const FLANKER_FILL_GEOS = buildFlankerFillGeos();
const PUSHER_FILL_GEOS  = buildPusherFillGeos();

const FLANKER_MAT = new THREE.PointsMaterial({ vertexColors: true, size: 0.12, sizeAttenuation: true });
const PUSHER_MAT  = new THREE.PointsMaterial({ vertexColors: true, size: 0.12, sizeAttenuation: true });
const FILL_MAT    = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

// ── enemy constants ───────────────────────────────────────────────────────────
const FLANKER_FORWARD_SPEED = 0.12;
const FLANKER_ORBIT_SPEED   = 0.006;
const FLANKER_ORBIT_RADIUS  = 40;

export class EnemyShip {
  readonly mesh: THREE.Group;
  readonly type: EnemyType;
  private fireTimer: number;
  private readonly FIRE_INTERVAL: number;

  // pusher state
  private retreating = false;

  // flanker state
  private anchor     = new THREE.Vector3();
  private orbitAngle = 0;

  constructor(scene: THREE.Scene, type: EnemyType, spawnX: number, spawnY: number) {
    this.type = type;

    const geo      = type === 'pusher' ? PUSHER_GEO       : FLANKER_GEO;
    const ptsMat   = type === 'pusher' ? PUSHER_MAT        : FLANKER_MAT;
    const fillGeos = type === 'pusher' ? PUSHER_FILL_GEOS  : FLANKER_FILL_GEOS;

    this.mesh = new THREE.Group();
    this.mesh.add(new THREE.Points(geo, ptsMat));
    for (const fg of fillGeos) this.mesh.add(new THREE.Mesh(fg, FILL_MAT));

    this.FIRE_INTERVAL = type === 'pusher' ? 360 : 240;
    this.fireTimer = Math.floor(Math.random() * this.FIRE_INTERVAL);

    this.mesh.position.set(spawnX, spawnY, -250);

    if (type === 'flanker') {
      this.anchor.set(spawnX, spawnY, -250);
      this.orbitAngle = Math.random() * Math.PI * 2;
    }

    scene.add(this.mesh);
  }

  tick(playerPos: THREE.Vector3): { wantsToFire: boolean } {
    if (this.type === 'pusher') {
      this.tickPusher(playerPos);
    } else {
      this.tickFlanker(playerPos);
    }

    this.fireTimer++;
    const wantsToFire = this.fireTimer >= this.FIRE_INTERVAL;
    if (wantsToFire) this.fireTimer = 0;
    return { wantsToFire };
  }

  private tickPusher(playerPos: THREE.Vector3): void {
    const pos = this.mesh.position;

    if (!this.retreating && pos.z > -60) this.retreating = true;

    if (this.retreating) {
      pos.z -= 0.4;
      if (pos.z <= -150) this.retreating = false;
    } else {
      const dir = new THREE.Vector3().subVectors(playerPos, pos).normalize();
      pos.addScaledVector(dir, 0.8);
    }
  }

  private tickFlanker(playerPos: THREE.Vector3): void {
    this.anchor.z += FLANKER_FORWARD_SPEED;
    if (this.anchor.z > -60) {
      this.anchor.set(playerPos.x, playerPos.y, -200);
      this.orbitAngle = Math.random() * Math.PI * 2;
    }

    this.orbitAngle += FLANKER_ORBIT_SPEED;
    this.mesh.position.x = this.anchor.x + Math.cos(this.orbitAngle) * FLANKER_ORBIT_RADIUS;
    this.mesh.position.y = this.anchor.y + Math.sin(this.orbitAngle) * FLANKER_ORBIT_RADIUS;
    this.mesh.position.z = this.anchor.z;
  }

  getPosition(): THREE.Vector3 {
    return this.mesh.position;
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.mesh);
  }
}
