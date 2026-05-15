import * as THREE from 'three';
import { SurfaceGun } from './SurfaceGun';
import { computeBaseHeight } from './planet3/computeHeight';
import { buildLandingZone, updateLandingZone, disposeLandingZone, LANDING_RECT_W, type LandingZone } from './landingZone';
import { buildFlankerGeometry, buildFlankerFillGeos } from './EnemyShip';
import type { Difficulty } from './difficulty';

const R                   = 350;
const H_START             = 61;
const DESCENT_RATE        = 0.011;
const THETA_START         = 0.084;
const ANGULAR_SPEED       = 0.00008;
const LOOK_DIST           = 30;
const LOOK_DOWN           = 30;
const STRAFE_MAX          = 40;
const STRAFE_SPEED        = 0.3;
const GUN_HIT_RADIUS      = 2.5;
const PLAYER_HIT_RADIUS   = 4;
const FLANKER_HIT_RADIUS  = 5;
const PLANET_BULLET_SPEED = 0.8;
const PLAYER_BULLET_SPEED = 4.0;
const CULL_DIST           = 200;
const FLANKER_FIRE_RATE   = 260;

// Dot-product threshold for the FOV gate — only guns whose direction from camera
// has at least this alignment with camera forward are allowed to fire (~46° half-angle).
const FOV_COS = 0.7;

// Two sentinel guns sit at the near edge of the ravine (the crossing rift at θ≈0.22).
// Everything else is distributed before them.
const RAVINE_GUNS = [
  { thetaOffset: 0.09, gunX: -8 },
  { thetaOffset: 0.10, gunX: +8 },
] as const;

// Regular guns are spread between FIRST and LAST, all AFTER the ravine sentinels
// (higher thetaOffset = further from player spawn = closer to landing zone).
const GUN_THETA_FIRST = 0.12;
const GUN_THETA_LAST  = 0.38;

type DiffConf = { guns: number; flankers: number; xMax: number };
const DIFF_CONF: Record<Difficulty, DiffConf> = {
  easy:   { guns: 10, flankers: 0, xMax: 22 },
  medium: { guns: 15, flankers: 2, xMax: 25 },
  hard:   { guns: 20, flankers: 4, xMax: 25 },
};

function makeGunConfigs(count: number, xMax: number): Array<{ thetaOffset: number; gunX: number }> {
  const regularCount = count - RAVINE_GUNS.length;
  const out: Array<{ thetaOffset: number; gunX: number }> = [];
  for (const cfg of RAVINE_GUNS) out.push({ ...cfg });
  for (let i = 0; i < regularCount; i++) {
    const t           = regularCount <= 1 ? 0 : i / (regularCount - 1);
    const thetaOffset = GUN_THETA_FIRST + t * (GUN_THETA_LAST - GUN_THETA_FIRST);
    const side        = i % 2 === 0 ? -1 : 1;
    const mag         = 0.3 + 0.7 * ((i * 7 + 3) % 11) / 10;
    out.push({ thetaOffset, gunX: side * mag * xMax });
  }
  return out;
}

// Returns lateral X offsets for escort flankers (alternating sides).
// Forward arc offset handles most of the ~13 unit range; xOffset adds lateral spread.
const FLANKER_THETA_AHEAD  = 0.28;   // rad ahead of player on arc ≈ 98 units forward
const FLANKER_ORBIT_R      = 3;      // orbit radius around anchor (units)
const FLANKER_ORBIT_SPEED  = 0.018;  // rad/frame
const FLANKER_DRIFT_AMP    = 5;      // lateral oscillation amplitude (units)
const FLANKER_DRIFT_SPEED  = 0.008;  // oscillation speed (rad/frame)

function makeFlankerOffsets(count: number): number[] {
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const dist = 6 + Math.floor(i / 2) * 5;
    offsets.push(side * dist);
  }
  return offsets;
}

// ── Escort Flanker ────────────────────────────────────────────────────────────
// Flies alongside the player at a fixed lateral offset, matching the player's
// theta and descending altitude. Uses computeBaseHeight for terrain-aware
// positioning so it skims the surface just like the player does.

const FLANKER_POINT_MAT = new THREE.PointsMaterial({
  color: new THREE.Color(1, 0.65, 0),
  size: 0.035,
  sizeAttenuation: true,
});
const FLANKER_FILL_MAT = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

class Wave3EscortFlanker {
  localPos = new THREE.Vector3();
  alive    = true;

  private group:     THREE.Group;
  private phi:       number;
  private driftPhi: number;

  constructor(
    private readonly planetSystem: THREE.Group,
    private readonly xOffset: number,
    phaseOffset: number,
  ) {
    this.phi      = phaseOffset;
    this.driftPhi = phaseOffset * 1.3; // different starting phase for drift vs orbit
    this.group = new THREE.Group();
    this.group.add(new THREE.Points(buildFlankerGeometry(), FLANKER_POINT_MAT));
    for (const geo of buildFlankerFillGeos()) {
      this.group.add(new THREE.Mesh(geo, FLANKER_FILL_MAT.clone()));
    }
    this.group.scale.setScalar(0.35);
    planetSystem.add(this.group);
  }

  tick(theta: number, h: number, camLocalPos: THREE.Vector3): void {
    if (!this.alive) return;
    this.phi += FLANKER_ORBIT_SPEED;

    this.driftPhi += FLANKER_DRIFT_SPEED;
    const myX      = this.xOffset + FLANKER_DRIFT_AMP * Math.sin(this.driftPhi);
    const flTheta  = theta + FLANKER_THETA_AHEAD;
    const spherePt = new THREE.Vector3(myX, -R * Math.cos(flTheta), R * Math.sin(flTheta));
    const normal   = spherePt.clone().normalize();
    const terrainH = Math.max(0, computeBaseHeight(myX, spherePt.y, spherePt.z) ?? 0);

    // Anchor position, then orbit around it in the right/up plane.
    const anchor = spherePt.clone().addScaledVector(normal, terrainH + 13);
    const right  = new THREE.Vector3(1, 0, 0);
    this.localPos.copy(anchor)
      .addScaledVector(right,  FLANKER_ORBIT_R * Math.cos(this.phi))
      .addScaledVector(normal, FLANKER_ORBIT_R * Math.sin(this.phi));
    this.group.position.copy(this.localPos);

    // Orient so local +Z faces the player.
    const zAxis = camLocalPos.clone().sub(this.localPos).normalize();
    const up    = this.localPos.clone().normalize(); // surface normal as up reference
    const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize();
    if (xAxis.lengthSq() < 0.001) xAxis.set(1, 0, 0);
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    this.group.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis),
    );
  }

  shouldFire(frame: number, idx: number): boolean {
    return this.alive && (frame + idx * 43) % FLANKER_FIRE_RATE === 0;
  }

  kill(): void {
    this.alive = false;
    this.planetSystem.remove(this.group);
  }
}

// ── Bullets ──────────────────────────────────────────────────────────────────

interface PlanetBullet {
  localPos: THREE.Vector3;
  localVel: THREE.Vector3;
  mesh: THREE.Mesh;
  isPlayer: boolean;
}

const BULLET_GEO        = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const BULLET_MAT_PLAYER = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const BULLET_MAT_ENEMY  = new THREE.MeshBasicMaterial({ color: 0xff4400 });

// ── Manager ───────────────────────────────────────────────────────────────────

export class Wave3LandingManager {
  private theta      = THETA_START;
  private h          = H_START;
  private camX       = 0;
  private frame      = 0;
  private crashFired = false;

  private guns:     SurfaceGun[]         = [];
  private flankers: Wave3EscortFlanker[] = [];
  private bullets:  PlanetBullet[]       = [];
  private lz:       LandingZone;

  get aliveEnemyCount(): number {
    return this.guns.filter(g => g.alive).length + this.flankers.filter(f => f.alive).length;
  }

  constructor(private readonly planetSystem: THREE.Group, difficulty: Difficulty = 'medium') {
    const conf    = DIFF_CONF[difficulty];
    const configs = makeGunConfigs(conf.guns, conf.xMax);

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      this.guns.push(new SurfaceGun(planetSystem, THETA_START + cfg.thetaOffset, cfg.gunX, i * 23));
    }

    const offsets = makeFlankerOffsets(conf.flankers);
    for (let i = 0; i < offsets.length; i++) {
      this.flankers.push(new Wave3EscortFlanker(planetSystem, offsets[i], (i / offsets.length) * Math.PI * 2));
    }

    this.lz = buildLandingZone(planetSystem);
  }

  private get _spherePt(): THREE.Vector3 {
    return new THREE.Vector3(this.camX, -R * Math.cos(this.theta), R * Math.sin(this.theta));
  }

  get camLocalPos(): THREE.Vector3 {
    const spherePt = this._spherePt;
    const normal   = spherePt.clone().normalize();
    const terrainH = Math.max(0, computeBaseHeight(spherePt.x, spherePt.y, spherePt.z) || 0);
    return spherePt.addScaledVector(normal, terrainH + this.h);
  }

  getCameraMatrix(): THREE.Matrix4 {
    const cam = new THREE.PerspectiveCamera();
    const pos = this.camLocalPos;
    cam.position.copy(pos);
    const surfaceNormal = this._spherePt.normalize();
    cam.up.copy(surfaceNormal);
    const lookAt = pos.clone()
      .add(new THREE.Vector3(0, Math.sin(this.theta), Math.cos(this.theta)).multiplyScalar(LOOK_DIST))
      .addScaledVector(surfaceNormal, -LOOK_DOWN);
    cam.lookAt(lookAt);
    cam.updateMatrixWorld(true);
    return cam.matrixWorldInverse.clone();
  }

  spawnPlayerBullet(worldDir: THREE.Vector3): void {
    this.planetSystem.updateWorldMatrix(true, false);
    const localDir = worldDir.clone().transformDirection(this.planetSystem.matrixWorld.clone().invert());
    const mesh     = new THREE.Mesh(BULLET_GEO, BULLET_MAT_PLAYER);
    const start    = this.camLocalPos;
    mesh.position.copy(start);
    mesh.rotation.z = Math.PI / 4;
    this.planetSystem.add(mesh);
    this.bullets.push({
      localPos: start.clone(),
      localVel: localDir.multiplyScalar(PLAYER_BULLET_SPEED),
      mesh,
      isPlayer: true,
    });
  }

  tick(strafeDir: number): {
    playerHit: boolean;
    gunsKilled: SurfaceGun[];
    flankersKilledPos: THREE.Vector3[];
    complete: boolean;
    crashedOutside: boolean;
  } {
    this.theta += ANGULAR_SPEED;
    this.h      = Math.max(0, this.h - DESCENT_RATE);
    this.camX   = THREE.MathUtils.clamp(this.camX + strafeDir * STRAFE_SPEED, -STRAFE_MAX, STRAFE_MAX);
    this.frame++;

    const camLocal   = this.camLocalPos;
    const camForward = new THREE.Vector3(0, Math.sin(this.theta), Math.cos(this.theta));

    const gunsKilled: SurfaceGun[]        = [];
    const flankersKilledPos: THREE.Vector3[] = [];
    let   playerHit = false;

    for (const gun of this.guns) gun.tickAim(camLocal);
    for (let i = 0; i < this.flankers.length; i++) {
      this.flankers[i].tick(this.theta, this.h, camLocal);
    }

    // Gun fire — gated by FOV
    for (const gun of this.guns) {
      if (!gun.alive || gun.theta < this.theta) continue;
      const toGun = gun.localPos.clone().sub(camLocal).normalize();
      if (toGun.dot(camForward) < FOV_COS) continue;
      if (!gun.shouldFire(this.frame, this.theta)) continue;

      const dir  = camLocal.clone().sub(gun.localPos).normalize();
      const mesh = new THREE.Mesh(BULLET_GEO, BULLET_MAT_ENEMY);
      mesh.position.copy(gun.localPos);
      mesh.rotation.z = Math.PI / 4;
      this.planetSystem.add(mesh);
      this.bullets.push({
        localPos: gun.localPos.clone(),
        localVel: dir.multiplyScalar(PLANET_BULLET_SPEED),
        mesh, isPlayer: false,
      });
    }

    // Flanker fire
    for (let i = 0; i < this.flankers.length; i++) {
      const fl = this.flankers[i];
      if (!fl.shouldFire(this.frame, i)) continue;
      const dir  = camLocal.clone().sub(fl.localPos).normalize();
      const mesh = new THREE.Mesh(BULLET_GEO, BULLET_MAT_ENEMY);
      mesh.position.copy(fl.localPos);
      mesh.rotation.z = Math.PI / 4;
      this.planetSystem.add(mesh);
      this.bullets.push({
        localPos: fl.localPos.clone(),
        localVel: dir.multiplyScalar(PLANET_BULLET_SPEED),
        mesh, isPlayer: false,
      });
    }

    // Tick bullets
    const toRemove: PlanetBullet[] = [];
    for (const b of this.bullets) {
      b.localPos.add(b.localVel);
      b.mesh.position.copy(b.localPos);

      if (b.localPos.distanceTo(camLocal) > CULL_DIST) { toRemove.push(b); continue; }

      if (b.isPlayer) {
        let hit = false;
        for (const gun of this.guns) {
          if (gun.alive && b.localPos.distanceTo(gun.localPos) < GUN_HIT_RADIUS) {
            gun.kill();
            gunsKilled.push(gun);
            toRemove.push(b);
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const fl of this.flankers) {
            if (fl.alive && b.localPos.distanceTo(fl.localPos) < FLANKER_HIT_RADIUS) {
              flankersKilledPos.push(fl.localPos.clone());
              fl.kill();
              toRemove.push(b);
              break;
            }
          }
        }
      } else {
        if (b.localPos.distanceTo(camLocal) < PLAYER_HIT_RADIUS) {
          playerHit = true;
          toRemove.push(b);
        }
      }
    }

    for (const b of toRemove) {
      this.planetSystem.remove(b.mesh);
      this.bullets.splice(this.bullets.indexOf(b), 1);
    }

    updateLandingZone(this.lz, camLocal.distanceTo(this.lz.center), this.h);

    const onGround = this.h <= 1;
    const inZone   = Math.abs(this.camX) <= LANDING_RECT_W / 2;
    let crashedOutside = false;
    if (onGround && !inZone && !this.crashFired) {
      this.crashFired = true;
      crashedOutside  = true;
    }

    return { playerHit, gunsKilled, flankersKilledPos, complete: onGround && inZone, crashedOutside };
  }

  dispose(): void {
    for (const gun of this.guns)    gun.kill();
    for (const fl  of this.flankers) fl.kill();
    for (const b   of this.bullets) this.planetSystem.remove(b.mesh);
    this.bullets = [];
    disposeLandingZone(this.planetSystem, this.lz);
  }
}
