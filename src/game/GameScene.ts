import * as THREE from 'three';
import { AsteroidBelt } from './AsteroidBelt';
import { InputController } from './InputController';
import { WaveManager } from './WaveManager';
import { ProjectileManager } from './ProjectileManager';
import { Wave2DodgeManager, SLICE_CENTER, SLICE_HALF } from './Wave2DodgeManager';
import { Wave3LandingManager } from './Wave3LandingManager';
import { hudBridge } from './hudBridge';
import { _PLANET_RADIUS } from './planet3/quadtree';
import type { Difficulty } from './difficulty';
import { spawnExplosion, type ExplosionHandle } from './labExplosion';

const WAVE1_COUNTS = {
  easy:   { pushers: 10, flankers:  3 },
  medium: { pushers: 15, flankers: 10 },
  hard:   { pushers: 25, flankers: 15 },
} as const;

const STRAFE_SPEED             = 0.45;
const STRAFE_MAX               = 150;
const MAX_HP                   = 100;
const MAX_SHIELD               = 50;
const SHIELD_DMG               = 10;
const HP_DMG                   = 10;
const ISAAC_INFO_IDLE_ROTATION = -0.00015;
const PLAYER_START_Z           = 120;
const PLAYER_FORWARD_SPEED     = 0.16;
const ZOOM_OUT_FRAMES          = 210;

export class GameScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private rafId = 0;
  private raycaster = new THREE.Raycaster();
  private container: HTMLDivElement;

  private input: InputController | null = null;
  private waves: WaveManager | null = null;
  private projectiles: ProjectileManager | null = null;
  private wave2: Wave2DodgeManager | null = null;
  private wave2CamActive   = false;
  private wave2ZoomingOut  = false;
  private wave2ZoomFrame   = 0;
  private wave2ZoomKills   = 0;
  private wave2ZoomIsDeath = false;
  private wave3: Wave3LandingManager | null = null;
  private wave3Active = false;
  private wave3RotTheta = 0;

  // Zoom-out state — shared by wave 2 and wave 3 (they never overlap)
  private wave3ZoomingOut  = false;
  private wave3ZoomFrame   = 0;
  private wave3ZoomKills   = 0;
  private wave3ZoomIsDeath  = false;
  private activeExplosions: ExplosionHandle[] = [];
  private _zoomStartPos    = new THREE.Vector3();
  private _zoomStartQuat   = new THREE.Quaternion();
  private _zoomEndPos      = new THREE.Vector3();
  private _zoomEndQuat     = new THREE.Quaternion();

  private planetSystem: THREE.Group;
  private isaacInfoViewRoot: THREE.Group;
  private belt: AsteroidBelt;
  private beltSliced = false;
  private terrainManager: import('@/game/planet3/terrain').TerrainChunkManager | null = null;
  private terrainLodCamera: THREE.PerspectiveCamera;
  private _lodCameraPos = new THREE.Vector3();

  private wave2RotTheta = 0;

  private playerX = 0;
  private playerZ = PLAYER_START_Z;
  private kills = 0;
  private ammo  = 100;
  private hp = MAX_HP;
  private shield = MAX_SHIELD;
  difficulty: Difficulty = 'medium';
  private isPlaying = false;

  constructor(container: HTMLDivElement) {
    this.container = container;

    this.scene = new THREE.Scene();

    const fov = GameScene.getFOV();
    this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.camera.position.set(0, 0, PLAYER_START_Z);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000);
    container.appendChild(this.renderer.domElement);

    this.isaacInfoViewRoot = new THREE.Group();
    this.isaacInfoViewRoot.matrix.copy(GameScene.getIsaacInfoViewMatrix());
    this.isaacInfoViewRoot.matrixAutoUpdate = false;
    this.isaacInfoViewRoot.matrixWorldNeedsUpdate = true;

    this.planetSystem = new THREE.Group();
    this.belt = new AsteroidBelt(this.planetSystem);

    this.terrainLodCamera = new THREE.PerspectiveCamera();
    this.terrainLodCamera.position.set(612, 612, 612);
    import('@/game/planet3/terrain').then(({ TerrainChunkManager }) => {
      this.terrainManager = new TerrainChunkManager({ camera: this.terrainLodCamera, parent: this.planetSystem });
    });
    this.isaacInfoViewRoot.add(this.planetSystem);
    this.scene.add(this.isaacInfoViewRoot);

    window.addEventListener('resize', this.handleResize);
    this.animate();
  }

  private static getFOV(): number {
    const w = window.innerWidth;
    if (w >= 1536) return 75;
    if (w >= 1280) return 80;
    if (w >= 1024) return 88;
    return 95;
  }

  private handleResize = (): void => {
    this.camera.fov = GameScene.getFOV();
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate);
    this.activeExplosions = this.activeExplosions.filter(e => e.tick());
    if (!this.wave2CamActive && !this.wave2ZoomingOut && !this.wave3Active && !this.wave3ZoomingOut) {
      this.planetSystem.rotation.z += ISAAC_INFO_IDLE_ROTATION;
    }
    if (this.isPlaying) this.tickGame();
    else if (this.wave2) this.tickWave2();
    else if (this.wave2ZoomingOut) this.tickWave2ZoomOut();
    else if (this.wave3Active) this.tickWave3();
    else if (this.wave3ZoomingOut) this.tickWave3ZoomOut();
    if (this.terrainManager) {
      this.planetSystem.updateWorldMatrix(true, false);
      this._lodCameraPos.set(0, 0, 0);
      this.planetSystem.worldToLocal(this._lodCameraPos);
      const displaySurfaceDist = Math.max(0, this._lodCameraPos.length() - _PLANET_RADIUS);
      if (this.wave2CamActive) {
        // Freeze LOD at level 3 (175-unit chunks) during wave 2 by fixing the LOD
        // camera 700 units above the surface, but pass the real camera dist for point sizing.
        this.terrainLodCamera.position.set(0, -1050, 0);
      } else {
        this.terrainLodCamera.position.copy(this._lodCameraPos);
      }
      this.terrainManager.Update(displaySurfaceDist);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private static getIsaacInfoViewMatrix(): THREE.Matrix4 {
    const referenceCamera = new THREE.PerspectiveCamera();
    referenceCamera.position.set(250, -1500, 500);
    referenceCamera.lookAt(0, 0, 0);
    referenceCamera.updateMatrixWorld(true);
    return referenceCamera.matrixWorldInverse.clone();
  }

  private applyWave2CameraMatrix(): void {
    const camInv = this.wave2!.getCameraMatrix();
    const rotInv = new THREE.Matrix4().makeRotationZ(-this.wave2RotTheta);
    this.isaacInfoViewRoot.matrix.multiplyMatrices(camInv, rotInv);
    this.isaacInfoViewRoot.matrixWorldNeedsUpdate = true;
  }

  private applyWave3CameraMatrix(): void {
    const camInv = this.wave3!.getCameraMatrix();
    const rotInv = new THREE.Matrix4().makeRotationZ(-this.wave3RotTheta);
    this.isaacInfoViewRoot.matrix.multiplyMatrices(camInv, rotInv);
    this.isaacInfoViewRoot.matrixWorldNeedsUpdate = true;
  }

  private tickGame(): void {
    if (!this.input || !this.waves || !this.projectiles) return;

    const strafeDir = this.input.getStrafeDir();
    this.playerX = THREE.MathUtils.clamp(
      this.playerX + strafeDir * STRAFE_SPEED,
      -STRAFE_MAX,
      STRAFE_MAX,
    );
    this.camera.position.x = this.playerX;

    const playerPos = this.camera.position.clone();

    if (this.input.tickShoot() && this.ammo > 0) {
      this.raycaster.setFromCamera(this.input.getMouseNDC(), this.camera);
      this.projectiles.spawnPlayerBullet(playerPos, this.raycaster.ray.direction);
      this.ammo--;
      hudBridge.emit({ type: 'ammo-update', value: this.ammo });
    }

    this.waves.tick(playerPos, (origin) => {
      this.projectiles!.spawnEnemyBullet(origin, playerPos);
    });

    const { playerHit, enemiesKilled } = this.projectiles.tick(playerPos, this.waves.getEnemies());

    if (playerHit && this.applyDamage()) return;

    if (enemiesKilled.length > 0) {
      let killedCount = 0;
      for (const e of enemiesKilled) {
        const color = e.type === 'pusher' ? { r: 1, g: 0, b: 0 } : { r: 1, g: 0.65, b: 0 };
        this.activeExplosions.push(spawnExplosion(this.scene, e.getPosition().clone(), color, 80, 65, 0.7));
        if (this.waves.killEnemy(e)) killedCount++;
      }
      this.kills += killedCount;
      hudBridge.emit({ type: 'kill-count', value: this.kills });
      if (this.syncEnemyRoster()) return;
    }

  }

  private tickWave2(): void {
    if (!this.wave2 || !this.wave2CamActive) return;

    this.applyWave2CameraMatrix();

    if (!this.wave2.isReady || !this.input) return;

    const shoot = this.input.tickShoot() && this.ammo > 0;
    let shootDir: THREE.Vector3 | undefined;
    if (shoot) {
      this.raycaster.setFromCamera(this.input.getMouseNDC(), this.camera);
      const inv = new THREE.Matrix4().copy(this.planetSystem.matrixWorld).invert();
      shootDir = this.raycaster.ray.direction.clone().transformDirection(inv).normalize();
      this.ammo--;
      hudBridge.emit({ type: 'ammo-update', value: this.ammo });
    }
    const { damaged, complete, hitPos, hitRadius, destroyed } = this.wave2.tick(this.input.getStrafeDir(), shoot, shootDir);

    if (destroyed.length > 0) {
      for (const d of destroyed) {
        const scale = Math.max(0.2, d.radius / 8);
        this.activeExplosions.push(
          spawnExplosion(this.planetSystem, d.pos, { r: 0.75, g: 0.65, b: 0.5 }, 80, 130, scale * 0.3),
        );
        this.kills++;
      }
      hudBridge.emit({ type: 'kill-count', value: this.kills });
    }

    if (damaged) {
      if (hitPos) {
        this.activeExplosions.push(
          spawnExplosion(this.planetSystem, hitPos, { r: 0x51/255, g: 0x5c/255, b: 0x63/255 }, 80, 65, 0.25),
        );
      }
      const r = hitRadius ?? 2;
      const dmg = r <= 3 ? 30 : r <= 5 ? 50 : r <= 7 ? 70 : 100;
      if (this.applyDamage(dmg)) return;
    }
    if (!this.wave2) return;

    this.applyWave2CameraMatrix();

    if (complete) {
      this._beginWave2ZoomOut();
    }
  }

  private tickWave3(): void {
    if (!this.wave3 || !this.wave3Active || !this.input) return;

    this.applyWave3CameraMatrix();

    if (this.input.tickShoot() && this.ammo > 0) {
      this.raycaster.setFromCamera(this.input.getMouseNDC(), this.camera);
      this.wave3.spawnPlayerBullet(this.raycaster.ray.direction);
      this.ammo--;
      hudBridge.emit({ type: 'ammo-update', value: this.ammo });
    }

    const { playerHit, gunsKilled, flankersKilledPos, complete, crashedOutside, alignWarning } = this.wave3.tick(this.input.getStrafeDir());
    hudBridge.emit({ type: 'align-warning', value: alignWarning });

    const totalKilled = gunsKilled.length + flankersKilledPos.length;
    if (totalKilled > 0) {
      for (const gun of gunsKilled) {
        this.activeExplosions.push(
          spawnExplosion(this.planetSystem, gun.localPos.clone(), { r: 1, g: 0.15, b: 0 }, 80, 65, 0.35),
        );
      }
      for (const pos of flankersKilledPos) {
        this.activeExplosions.push(
          spawnExplosion(this.planetSystem, pos, { r: 1, g: 0.65, b: 0 }, 80, 65, 0.35),
        );
      }
      this.kills += totalKilled;
      hudBridge.emit({ type: 'kill-count', value: this.kills });
      hudBridge.emit({ type: 'enemy-count', value: this.wave3.aliveEnemyCount });
    }

    if (crashedOutside) {
      this._beginZoomOut(true);
      return;
    }

    if (playerHit && this.applyDamage()) return;
    if (!this.wave3) return;

    this.applyWave3CameraMatrix();

    if (complete) {
      this._beginZoomOut();
    }
  }

  private _beginWave2ZoomOut(isDeath = false): void {
    const currentWorldMat = this.isaacInfoViewRoot.matrix.clone().invert();
    currentWorldMat.decompose(this._zoomStartPos, this._zoomStartQuat, new THREE.Vector3());

    const refWorldMat = GameScene.getIsaacInfoViewMatrix().clone().invert();
    refWorldMat.decompose(this._zoomEndPos, this._zoomEndQuat, new THREE.Vector3());

    this.wave2ZoomingOut  = true;
    this.wave2ZoomFrame   = 0;
    this.wave2ZoomKills   = this.kills;
    this.wave2ZoomIsDeath = isDeath;

    this.wave2?.clear();
    this.wave2 = null;
    this.wave2CamActive = false;
    this.input?.dispose();
    this.input = null;
    this.restoreBelt();
  }

  private tickWave2ZoomOut(): void {
    this.wave2ZoomFrame++;
    const t = Math.min(this.wave2ZoomFrame / ZOOM_OUT_FRAMES, 1);
    const s = t * t * (3 - 2 * t);

    const pos  = new THREE.Vector3().lerpVectors(this._zoomStartPos, this._zoomEndPos, s);
    const quat = new THREE.Quaternion().slerpQuaternions(this._zoomStartQuat, this._zoomEndQuat, s);
    const worldMat = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
    this.isaacInfoViewRoot.matrix.copy(worldMat.invert());
    this.isaacInfoViewRoot.matrixWorldNeedsUpdate = true;

    if (t >= 1) {
      this.isaacInfoViewRoot.matrix.copy(GameScene.getIsaacInfoViewMatrix());
      this.isaacInfoViewRoot.matrixWorldNeedsUpdate = true;
      this.wave2ZoomingOut = false;
      if (this.wave2ZoomIsDeath) {
        this.clearGameState();
        hudBridge.emit({ type: 'player-dead', kills: this.wave2ZoomKills });
      } else {
        hudBridge.emit({ type: 'asteroid-clear', kills: this.wave2ZoomKills });
      }
    }
  }

  private _beginZoomOut(isDeath = false): void {
    const kills = this.kills;
    this.wave3ZoomIsDeath = isDeath;

    // Extract the current world camera position/quat from isaacInfoViewRoot.matrix (which is the view matrix)
    const currentViewMat = this.isaacInfoViewRoot.matrix.clone();
    const currentWorldMat = currentViewMat.clone().invert();
    currentWorldMat.decompose(this._zoomStartPos, this._zoomStartQuat, new THREE.Vector3());

    // Target: the reference camera world matrix
    const refViewMat  = GameScene.getIsaacInfoViewMatrix();
    const refWorldMat = refViewMat.clone().invert();
    refWorldMat.decompose(this._zoomEndPos, this._zoomEndQuat, new THREE.Vector3());

    this.wave3ZoomingOut = true;
    this.wave3ZoomFrame  = 0;
    this.wave3ZoomKills  = kills;

    // Tear down gameplay systems but keep planetSystem intact
    this.wave3Active = false;
    this.input?.dispose();
    this.input = null;
    this.wave3?.dispose();
    this.wave3 = null;
    this.restoreBelt();
  }

  private tickWave3ZoomOut(): void {
    this.wave3ZoomFrame++;
    const t = Math.min(this.wave3ZoomFrame / ZOOM_OUT_FRAMES, 1);
    // Smooth ease-in-out
    const s = t * t * (3 - 2 * t);

    const pos  = new THREE.Vector3().lerpVectors(this._zoomStartPos, this._zoomEndPos, s);
    const quat = new THREE.Quaternion().slerpQuaternions(this._zoomStartQuat, this._zoomEndQuat, s);
    const scale = new THREE.Vector3(1, 1, 1);

    const worldMat = new THREE.Matrix4().compose(pos, quat, scale);
    this.isaacInfoViewRoot.matrix.copy(worldMat.invert());
    this.isaacInfoViewRoot.matrixWorldNeedsUpdate = true;

    if (t >= 1) {
      // Snap to exact reference view and emit win
      this.isaacInfoViewRoot.matrix.copy(GameScene.getIsaacInfoViewMatrix());
      this.isaacInfoViewRoot.matrixWorldNeedsUpdate = true;
      this.wave3ZoomingOut = false;
      if (this.wave3ZoomIsDeath) {
        this.clearGameState();
        hudBridge.emit({ type: 'player-dead', kills: this.wave3ZoomKills });
      } else {
        hudBridge.emit({ type: 'landing-complete', kills: this.wave3ZoomKills });
      }
    }
  }

  private syncEnemyRoster(): boolean {
    if (!this.waves) return false;
    hudBridge.emit({ type: 'enemy-count', value: this.waves.aliveCount });
    if (this.waves.aliveCount > 0) return false;

    this.clearGameState();
    hudBridge.emit({ type: 'wave-clear', kills: this.kills });
    return true;
  }

  private restoreBelt(): void {
    if (!this.beltSliced) return;
    this.belt.dispose();
    this.belt = new AsteroidBelt(this.planetSystem);
    this.beltSliced = false;
  }

  startWave3(): void {
    this.hp = MAX_HP;
    this.ammo = 100;
    hudBridge.emit({ type: 'hp-update',     value: this.hp });
    hudBridge.emit({ type: 'shield-update', value: this.shield });
    hudBridge.emit({ type: 'ammo-update',   value: this.ammo });

    this.wave3RotTheta = this.planetSystem.rotation.z;
    this.camera.position.set(0, 0, 0);
    this.camera.updateMatrixWorld(true);
    this.wave3 = new Wave3LandingManager(this.planetSystem, this.difficulty);
    this.input = new InputController();
    this.wave3Active = true;
    this.applyWave3CameraMatrix();
    setTimeout(() => hudBridge.emit({ type: 'enemy-count', value: this.wave3!.aliveEnemyCount }), 0);
  }

  prepareWave2(): void {
    this.wave2 = new Wave2DodgeManager(
      this.planetSystem,
      () => { hudBridge.emit({ type: 'wave2-ready' }); },
      (loaded, total) => { hudBridge.emit({ type: 'wave2-progress', loaded, total }); },
      this.difficulty,
    );
  }

  startWave2(): void {
    if (!this.wave2) return;

    this.hp = MAX_HP;
    this.ammo = 100;
    hudBridge.emit({ type: 'hp-update',     value: this.hp });
    hudBridge.emit({ type: 'shield-update', value: this.shield });
    hudBridge.emit({ type: 'ammo-update',   value: this.ammo });

    this.wave2RotTheta = this.planetSystem.rotation.z;

    this.belt.dispose();
    this.belt = new AsteroidBelt(this.planetSystem, { center: SLICE_CENTER, half: SLICE_HALF });
    this.beltSliced = true;

    this.camera.position.set(0, 0, 0);
    this.camera.updateMatrixWorld(true);

    this.input = new InputController();

    this.wave2CamActive = true;
    const count = this.wave2.count;
    setTimeout(() => hudBridge.emit({ type: 'enemy-count', value: count }), 0);
    this.applyWave2CameraMatrix();
  }

  private applyDamage(amount = HP_DMG): boolean {
    if (this.shield > 0) {
      this.shield = Math.max(0, this.shield - amount);
      hudBridge.emit({ type: 'shield-update', value: this.shield });
      return false;
    } else {
      this.hp = Math.max(0, this.hp - amount);
      hudBridge.emit({ type: 'hp-update', value: this.hp });
      if (this.hp <= 0) {
        if (this.wave3Active) {
          this._beginZoomOut(true);
        } else if (this.wave2CamActive) {
          this._beginWave2ZoomOut(true);
        } else {
          this.clearGameState();
          hudBridge.emit({ type: 'player-dead', kills: this.kills });
        }
        return true;
      }
    }
    return false;
  }

  startGame(difficulty: Difficulty = 'medium'): void {
    this.difficulty = difficulty;
    this.clearGameState();
    this.hp = MAX_HP;
    this.shield = MAX_SHIELD;
    this.kills = 0;

    this.playerX = 0;
    this.playerZ = PLAYER_START_Z;
    this.camera.position.set(0, 0, this.playerZ);

    this.input = new InputController();
    this.waves = new WaveManager(this.scene);
    this.projectiles = new ProjectileManager(this.scene);
    const { pushers, flankers } = WAVE1_COUNTS[this.difficulty];
    this.waves.spawnWave(pushers, flankers);
    this.isPlaying = true;

    this.ammo = 100;
    hudBridge.emit({ type: 'hp-update',     value: this.hp });
    hudBridge.emit({ type: 'shield-update', value: this.shield });
    hudBridge.emit({ type: 'ammo-update',   value: this.ammo });
    hudBridge.emit({ type: 'enemy-count',   value: this.waves.aliveCount });
    hudBridge.emit({ type: 'kill-count',    value: this.kills });
  }

  reset(): void {
    this.clearGameState();
    this.hp = MAX_HP;
    this.shield = MAX_SHIELD;
    this.kills = 0;

    this.playerX = 0;
    this.playerZ = PLAYER_START_Z;
    this.camera.position.set(0, 0, this.playerZ);
    this.isaacInfoViewRoot.matrix.copy(GameScene.getIsaacInfoViewMatrix());
    this.isaacInfoViewRoot.matrixWorldNeedsUpdate = true;
  }

  private clearGameState(): void {
    for (const e of this.activeExplosions) e.dispose();
    this.activeExplosions = [];
    this.isPlaying       = false;
    this.wave2CamActive  = false;
    this.wave2ZoomingOut = false;
    this.wave3Active     = false;
    this.wave3ZoomingOut = false;
    this.input?.dispose();
    this.input = null;
    this.waves?.clear();
    this.waves = null;
    this.projectiles?.clear();
    this.projectiles = null;
    this.wave2?.clear();
    this.wave2 = null;
    this.wave3?.dispose();
    this.wave3 = null;
    this.restoreBelt();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.clearGameState();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
