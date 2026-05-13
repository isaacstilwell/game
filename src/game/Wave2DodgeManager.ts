import * as THREE from 'three';
import { buildFlankerGeometry, buildFlankerFillGeos } from './EnemyShip';

// HUD teal — matches the UI color palette
const PLAYER_COLOR = 0x6DBDAF;

// Belt parameters — must match AsteroidBelt.ts
const BELT_INNER          = 550;
const BELT_OUTER          = 800;
const EXTENDED_OUTER      = 950; // asteroid corridor extends past belt outer edge
export const SLICE_CENTER = (3 * Math.PI) / 2; // angle 270°: points toward –Y
export const SLICE_HALF   = Math.PI / 24;        // ±7.5°, 15° total

const MIN_ASTEROIDS         = 300;
const MAX_ASTEROIDS         = 500;
const Z_SIGMA               = 2;

// Asteroid motion — scaled by 1/radius so smaller rocks move faster
// DRIFT_BASE / radius: r=4 → 0.03, r=1 → 0.12
const DRIFT_BASE = 0.12;
// ANG_BASE / radius: r=4 → 0.008, r=1 → 0.032
const ANG_BASE   = 0.032;

// Player movement through belt-local space
const APPROACH_START_Y = -(EXTENDED_OUTER + 20);
const APPROACH_START_Z = 0;
const APPROACH_SPEED   = 0.25;
const STRAFE_SPEED     = 0.9;
const STRAFE_MAX       = 120;
const PLAYER_RADIUS    = 0.8;
const HIT_COOLDOWN     = 90;

function gaussianZ(): number {
  const u = Math.random(), v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * Z_SIGMA;
}

function angleDist(a: number, b: number): number {
  return Math.abs(((a - b + Math.PI) % (2 * Math.PI)) - Math.PI);
}

function randRadius(): number {
  const r = Math.random();
  if (r < 0.90)  return 1;
  if (r < 0.995) return 2 + Math.floor(Math.random() * 2); // 9.5% → 2–3
  return 4 + Math.floor(Math.random() * 2);                 // 0.5% → 4–5
}

interface BeltPos { x: number; y: number; z: number; radius: number; }

export class Wave2DodgeManager {
  private positions: BeltPos[] = [];
  private groups: THREE.Group[] = [];
  private updateFns: ((pos: THREE.Vector3) => void)[] = [];
  private velocities: THREE.Vector3[] = [];
  private angVels: THREE.Vector3[] = [];
  private playerShip: THREE.Group;

  private beltX = 0;
  private beltY = APPROACH_START_Y;
  private readonly beltZ = APPROACH_START_Z;
  private hitCooldown = 0;
  private disposed = false;

  isReady = false;
  get count(): number { return this.positions.length; }

  constructor(
    private planetSystem: THREE.Group,
    private onReady: () => void,
    private onProgress?: (loaded: number, total: number) => void,
  ) {
    this.playerShip = this.buildPlayerShip();
    this.generatePositions();
    this.buildAsteroids().catch(console.error);
  }

  private buildPlayerShip(): THREE.Group {
    const mat = new THREE.PointsMaterial({ color: PLAYER_COLOR, size: 0.015, sizeAttenuation: true });
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      side: THREE.FrontSide,
    });
    const group = new THREE.Group();
    group.add(new THREE.Points(buildFlankerGeometry(), mat));
    for (const geo of buildFlankerFillGeos()) group.add(new THREE.Mesh(geo, fillMat));
    // nose (+Z local) → +Y (forward in belt), cockpit (+Y local) → +Z (up in belt)
    group.rotation.set(Math.PI / 2, Math.PI, 0);
    group.scale.setScalar(0.25);
    group.position.set(this.beltX, this.beltY, this.beltZ);
    this.planetSystem.add(group);
    return group;
  }

  private generatePositions() {
    let radius = BELT_INNER, radiusStep = 3, stepVelocity = 0;
    const cfg = {
      momentumFactor: 0.5, baseVariance: 2.5, oscillationBias: 1.5,
      minStep: 1, maxStep: 100, baseDensity: 100,
    };

    while (radius < EXTENDED_OUTER) {
      const reversalPull = -stepVelocity * cfg.oscillationBias;
      const randomChange = (Math.random() - 0.5) * cfg.baseVariance;
      const stepChange = stepVelocity * cfg.momentumFactor + reversalPull + randomChange;
      stepVelocity = stepChange;
      radiusStep += stepChange;
      radiusStep = Math.max(cfg.minStep, Math.min(cfg.maxStep, radiusStep));
      if (radiusStep === cfg.minStep || radiusStep === cfg.maxStep) stepVelocity *= -0.5;

      const density = Math.max(0.4, 1.0 + (radius - BELT_INNER) * 0.02);
      const pointCount = Math.floor(cfg.baseDensity * density);

      const sliceIndices: number[] = [];
      for (let i = 0; i < pointCount; i++) {
        if (angleDist((i / pointCount) * Math.PI * 2, SLICE_CENTER) <= SLICE_HALF) {
          sliceIndices.push(i);
        }
      }
      for (let k = sliceIndices.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [sliceIndices[k], sliceIndices[j]] = [sliceIndices[j], sliceIndices[k]];
      }

      // Adaptive count: budget remaining divided by estimated rings remaining
      const ringsRemaining = Math.max(1, (EXTENDED_OUTER - radius) / radiusStep);
      const needed = MAX_ASTEROIDS - this.positions.length;
      const count = Math.min(Math.round(needed / ringsRemaining), sliceIndices.length);

      for (let k = 0; k < count; k++) {
        const i = sliceIndices[k];
        const angle = (i / pointCount) * Math.PI * 2;
        const radialNoise = (Math.random() - 0.5) * 3.0;
        const r = radius + radialNoise;
        this.positions.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          z: gaussianZ(),
          radius: randRadius(),
        });
      }

      radius += radiusStep;
    }

    while (this.positions.length < MIN_ASTEROIDS) {
      const angle = SLICE_CENTER - SLICE_HALF + Math.random() * SLICE_HALF * 2;
      const r = BELT_INNER + Math.random() * (EXTENDED_OUTER - BELT_INNER);
      this.positions.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r, z: gaussianZ(), radius: randRadius() });
    }
  }

  private async buildAsteroids() {
    const { buildAsteroid } = await import('./asteroid/AsteroidBuilder');
    if (this.disposed) return;

    let loaded = 0;
    const total = this.positions.length;
    const results = await Promise.all(
      this.positions.map((pos, i) =>
        buildAsteroid(60000 + i, 16, pos.radius).then(r => {
          loaded++;
          this.onProgress?.(loaded, total);
          return r;
        }),
      ),
    );
    if (this.disposed) return;

    for (let i = 0; i < results.length; i++) {
      const { group, update } = results[i];
      const pos = this.positions[i];
      group.position.set(pos.x, pos.y, pos.z);
      this.planetSystem.add(group);
      this.groups.push(group);
      this.updateFns.push(update);

      const driftXY = DRIFT_BASE / pos.radius;
      const driftZ  = driftXY * 0.5;
      const angVel  = ANG_BASE / pos.radius;
      this.velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * driftXY,
        (Math.random() - 0.5) * driftXY,
        (Math.random() - 0.5) * driftZ,
      ));
      this.angVels.push(new THREE.Vector3(
        (Math.random() - 0.5) * angVel,
        (Math.random() - 0.5) * angVel,
        (Math.random() - 0.5) * angVel,
      ));
    }

    this.isReady = true;
    this.onReady();
  }

  tick(strafeDir: number): { damaged: boolean; complete: boolean } {
    this.beltY += APPROACH_SPEED;
    this.beltX = THREE.MathUtils.clamp(
      this.beltX + strafeDir * STRAFE_SPEED,
      -STRAFE_MAX,
      STRAFE_MAX,
    );

    this.playerShip.position.set(this.beltX, this.beltY, this.beltZ);

    const playerPos = new THREE.Vector3(this.beltX, this.beltY, this.beltZ);
    for (let i = 0; i < this.groups.length; i++) {
      const g = this.groups[i];
      g.position.addScaledVector(this.velocities[i], 1);
      g.rotation.x += this.angVels[i].x;
      g.rotation.y += this.angVels[i].y;
      g.rotation.z += this.angVels[i].z;
      this.updateFns[i](playerPos.clone().sub(g.position));
    }

    let damaged = false;
    if (this.hitCooldown > 0) {
      this.hitCooldown--;
    } else {
      for (let i = 0; i < this.groups.length; i++) {
        const gp = this.groups[i].position;
        const dx = this.beltX - gp.x, dy = this.beltY - gp.y, dz = this.beltZ - gp.z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < PLAYER_RADIUS + this.positions[i].radius) {
          this.hitCooldown = HIT_COOLDOWN;
          damaged = true;
          break;
        }
      }
    }

    return { damaged, complete: this.beltY > -(BELT_INNER - 50) };
  }

  getCameraMatrix(): THREE.Matrix4 {
    const cam = new THREE.PerspectiveCamera();
    cam.up.set(0, 0, 1);
    // Chase cam: close behind and slightly above, looking at ship
    cam.position.set(this.beltX, this.beltY - 6, this.beltZ + 1.5);
    cam.lookAt(this.beltX, this.beltY, this.beltZ);
    cam.updateMatrixWorld(true);
    return cam.matrixWorldInverse.clone();
  }

  clear(): void {
    this.disposed = true;
    this.playerShip.parent?.remove(this.playerShip);
    for (const g of this.groups) g.parent?.remove(g);
    this.groups = [];
    this.updateFns = [];
    this.velocities = [];
    this.angVels = [];
  }
}
