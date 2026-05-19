import * as THREE from 'three';
import { buildFlankerGeometry, buildFlankerFillGeos } from './EnemyShip';
import type { Difficulty } from './difficulty';

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
const APPROACH_SPEEDS: Record<Difficulty, number> = { easy: 0.25, medium: 0.45, hard: 0.65 };
const STRAFE_SPEED     = 0.45;
const STRAFE_MAX       = 70;
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
  if (r < 0.72)  return 2 + Math.floor(Math.random() * 2); // 72% → 2–3
  if (r < 0.95)  return 4 + Math.floor(Math.random() * 2); // 23% → 4–5
  return 6 + Math.floor(Math.random() * 3);                 //  5% → 6–8
}

function hpForRadius(r: number): number {
  if (r <= 3) return 6;
  if (r <= 5) return 16;
  if (r <= 7) return 30;
  return 30;
}

// Player bullets in belt-local space
const BELT_BULLET_GEO      = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const BELT_BULLET_MAT      = new THREE.MeshBasicMaterial({ color: 0x6dbdaf });
const BELT_BULLET_SPEED    = 8;
const BELT_BULLET_HIT_MARGIN = 1.5;
const BELT_BULLET_CULL_AHEAD = 300;

const HIT_FLASH_DURATION = 18; // frames — quick fade-in / fade-out

function setFillColor(group: THREE.Group, r: number, g: number, b: number) {
  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      (child.material as THREE.MeshBasicMaterial).color.setRGB(r, g, b);
    }
  });
}

interface BeltBullet { pos: THREE.Vector3; vel: THREE.Vector3; mesh: THREE.Mesh; }
interface HitFlash  { group: THREE.Group; frame: number; }
interface BeltPos { x: number; y: number; z: number; radius: number; hp: number; }

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
  private approachSpeed = 0.25;
  private hitCooldown = 0;
  private disposed = false;
  private bullets: BeltBullet[] = [];
  private hitFlashes: HitFlash[] = [];

  isReady = false;
  get count(): number { return this.positions.length; }

  constructor(
    private planetSystem: THREE.Group,
    private onReady: () => void,
    private onProgress?: (loaded: number, total: number) => void,
    difficulty: Difficulty = 'medium',
  ) {
    this.approachSpeed = APPROACH_SPEEDS[difficulty];
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
        const aRadius = randRadius();
        this.positions.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          z: gaussianZ(),
          radius: aRadius,
          hp: hpForRadius(aRadius),
        });
      }

      radius += radiusStep;
    }

    while (this.positions.length < MIN_ASTEROIDS) {
      const angle = SLICE_CENTER - SLICE_HALF + Math.random() * SLICE_HALF * 2;
      const r = BELT_INNER + Math.random() * (EXTENDED_OUTER - BELT_INNER);
      const fRadius = randRadius();
      this.positions.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r, z: gaussianZ(), radius: fRadius, hp: hpForRadius(fRadius) });
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

  tick(strafeDir: number, shoot: boolean, shootDir?: THREE.Vector3): {
    damaged: boolean; complete: boolean; hitPos: THREE.Vector3 | null; hitRadius: number | null;
    destroyed: { pos: THREE.Vector3; radius: number }[];
  } {
    this.beltY += this.approachSpeed;
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

    // Spawn player bullet (straight forward in +Y)
    if (shoot) {
      const mesh = new THREE.Mesh(BELT_BULLET_GEO, BELT_BULLET_MAT);
      mesh.position.set(this.beltX, this.beltY, this.beltZ);
      mesh.rotation.z = Math.PI / 4;
      this.planetSystem.add(mesh);
      this.bullets.push({
        pos: new THREE.Vector3(this.beltX, this.beltY, this.beltZ),
        vel: (shootDir ?? new THREE.Vector3(0, 1, 0)).clone().normalize().multiplyScalar(BELT_BULLET_SPEED),
        mesh,
      });
    }

    // Move bullets and check asteroid hits
    const destroyed: { pos: THREE.Vector3; radius: number }[] = [];
    const bulletsToRemove: BeltBullet[] = [];
    for (const bullet of this.bullets) {
      bullet.pos.add(bullet.vel);
      bullet.mesh.position.copy(bullet.pos);
      if (bullet.pos.y - this.beltY > BELT_BULLET_CULL_AHEAD) {
        bulletsToRemove.push(bullet);
        continue;
      }
      let hit = false;
      for (let i = 0; i < this.groups.length; i++) {
        const gp = this.groups[i].position;
        if (bullet.pos.distanceTo(gp) < BELT_BULLET_HIT_MARGIN + this.positions[i].radius) {
          this.positions[i].hp--;
          if (this.positions[i].hp <= 0) {
            destroyed.push({ pos: gp.clone(), radius: this.positions[i].radius });
            this.hitFlashes = this.hitFlashes.filter(f => f.group !== this.groups[i]);
            this.planetSystem.remove(this.groups[i]);
            this.groups.splice(i, 1);
            this.positions.splice(i, 1);
            this.updateFns.splice(i, 1);
            this.velocities.splice(i, 1);
            this.angVels.splice(i, 1);
          } else {
            const existing = this.hitFlashes.find(f => f.group === this.groups[i]);
            if (existing) existing.frame = 0;
            else this.hitFlashes.push({ group: this.groups[i], frame: 0 });
          }
          hit = true;
          break;
        }
      }
      if (hit) bulletsToRemove.push(bullet);
    }
    for (const b of bulletsToRemove) {
      this.planetSystem.remove(b.mesh);
      const i = this.bullets.indexOf(b);
      if (i !== -1) this.bullets.splice(i, 1);
    }

    let damaged = false;
    let hitPos: THREE.Vector3 | null = null;
    let hitRadius: number | null = null;
    if (this.hitCooldown > 0) {
      this.hitCooldown--;
    } else {
      for (let i = 0; i < this.groups.length; i++) {
        const gp = this.groups[i].position;
        const dx = this.beltX - gp.x, dy = this.beltY - gp.y, dz = this.beltZ - gp.z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < PLAYER_RADIUS + this.positions[i].radius) {
          this.hitCooldown = HIT_COOLDOWN;
          damaged = true;
          hitPos    = gp.clone();
          hitRadius = this.positions[i].radius;
          this.planetSystem.remove(this.groups[i]);
          this.groups.splice(i, 1);
          this.positions.splice(i, 1);
          this.updateFns.splice(i, 1);
          this.velocities.splice(i, 1);
          this.angVels.splice(i, 1);
          break;
        }
      }
    }

    this.hitFlashes = this.hitFlashes.filter(flash => {
      flash.frame++;
      const intensity = 0.28 * Math.sin(Math.PI * flash.frame / HIT_FLASH_DURATION);
      setFillColor(flash.group, intensity, 0, 0);
      if (flash.frame >= HIT_FLASH_DURATION) {
        setFillColor(flash.group, 0, 0, 0);
        return false;
      }
      return true;
    });

    return { damaged, complete: this.beltY > -(BELT_INNER - 50), hitPos, hitRadius, destroyed };
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
    for (const b of this.bullets) this.planetSystem.remove(b.mesh);
    for (const f of this.hitFlashes) setFillColor(f.group, 0, 0, 0);
    this.groups = [];
    this.updateFns = [];
    this.velocities = [];
    this.angVels = [];
    this.bullets = [];
  }
}
