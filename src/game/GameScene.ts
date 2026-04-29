import * as THREE from 'three';
import { Planet } from './Planet';
import { AsteroidBelt } from './AsteroidBelt';
import { InputController } from './InputController';
import { WaveManager } from './WaveManager';
import { ProjectileManager } from './ProjectileManager';
import { hudBridge } from './hudBridge';

const STRAFE_SPEED              = 0.75;
const STRAFE_MAX                = 150;
const MAX_HP                    = 100;
const MAX_SHIELD                = 50;
const SHIELD_DMG                = 10;
const HP_DMG                    = 10;
const ISAAC_INFO_IDLE_ROTATION  = -0.00015;
const PLAYER_START_Z            = 120;
const PLAYER_FORWARD_SPEED      = 0.08;

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
  private planetSystem: THREE.Group;

  private playerX = 0;
  private playerZ = PLAYER_START_Z;
  private kills = 0;
  private escaped = 0;
  private hp = MAX_HP;
  private shield = MAX_SHIELD;
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

    const isaacInfoViewRoot = new THREE.Group();
    isaacInfoViewRoot.matrix.copy(GameScene.getIsaacInfoViewMatrix());
    isaacInfoViewRoot.matrixAutoUpdate = false;
    isaacInfoViewRoot.matrixWorldNeedsUpdate = true;

    this.planetSystem = new THREE.Group();
    new Planet(this.planetSystem);
    new AsteroidBelt(this.planetSystem);
    isaacInfoViewRoot.add(this.planetSystem);
    this.scene.add(isaacInfoViewRoot);

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
    this.planetSystem.rotation.z += ISAAC_INFO_IDLE_ROTATION;
    if (this.isPlaying) this.tickGame();
    this.renderer.render(this.scene, this.camera);
  };

  private static getIsaacInfoViewMatrix(): THREE.Matrix4 {
    const referenceCamera = new THREE.PerspectiveCamera();
    referenceCamera.position.set(250, -1500, 500);
    referenceCamera.lookAt(0, 0, 0);
    referenceCamera.updateMatrixWorld(true);
    return referenceCamera.matrixWorldInverse.clone();
  }

  private tickGame(): void {
    if (!this.input || !this.waves || !this.projectiles) return;

    // Strafe
    const strafeDir = this.input.getStrafeDir();
    this.playerX = THREE.MathUtils.clamp(
      this.playerX + strafeDir * STRAFE_SPEED,
      -STRAFE_MAX,
      STRAFE_MAX,
    );
    this.camera.position.x = this.playerX;
    this.playerZ -= PLAYER_FORWARD_SPEED;
    this.camera.position.z = this.playerZ;

    const playerPos = this.camera.position.clone();

    if (this.despawnPassedEnemies(playerPos.z) && this.syncEnemyRoster()) return;

    // Shoot
    if (this.input.tickShoot()) {
      this.raycaster.setFromCamera(this.input.getMouseNDC(), this.camera);
      this.projectiles.spawnPlayerBullet(playerPos, this.raycaster.ray.direction);
    }

    // Enemies tick + fire
    this.waves.tick(playerPos, (origin) => {
      this.projectiles!.spawnEnemyBullet(origin, playerPos);
    });

    // Bullets tick
    const { playerHit, enemiesKilled } = this.projectiles.tick(
      playerPos,
      this.waves.getEnemies(),
    );

    if (playerHit && this.applyDamage()) return;

    if (enemiesKilled.length > 0) {
      let killedCount = 0;
      for (const e of enemiesKilled) {
        if (this.waves.killEnemy(e)) killedCount++;
      }
      this.kills += killedCount;
      hudBridge.emit({ type: 'kill-count', value: this.kills });
      if (this.syncEnemyRoster()) return;
    }

    if (this.despawnPassedEnemies(playerPos.z)) this.syncEnemyRoster();
  }

  private despawnPassedEnemies(playerZ: number): boolean {
    if (!this.waves) return false;
    const despawned = this.waves.despawnPassedEnemies(playerZ);
    this.escaped += despawned;
    return despawned > 0;
  }

  private syncEnemyRoster(): boolean {
    if (!this.waves) return false;
    hudBridge.emit({ type: 'enemy-count', value: this.waves.aliveCount });
    if (this.waves.aliveCount > 0) return false;

    this.clearGameState();
    hudBridge.emit({ type: 'wave-clear', kills: this.kills, escaped: this.escaped });
    return true;
  }

  private applyDamage(): boolean {
    if (this.shield > 0) {
      this.shield = Math.max(0, this.shield - SHIELD_DMG);
      hudBridge.emit({ type: 'shield-update', value: this.shield });
      return false;
    } else {
      this.hp = Math.max(0, this.hp - HP_DMG);
      hudBridge.emit({ type: 'hp-update', value: this.hp });
      if (this.hp <= 0) {
        this.clearGameState();
        hudBridge.emit({ type: 'player-dead', kills: this.kills });
        return true;
      }
    }

    return false;
  }

  startGame(): void {
    this.clearGameState();
    this.hp = MAX_HP;
    this.shield = MAX_SHIELD;
    this.kills = 0;
    this.escaped = 0;
    this.playerX = 0;
    this.playerZ = PLAYER_START_Z;
    this.camera.position.set(0, 0, this.playerZ);

    this.input = new InputController();
    this.waves = new WaveManager(this.scene);
    this.projectiles = new ProjectileManager(this.scene);
    this.waves.spawnWave();
    this.isPlaying = true;

    hudBridge.emit({ type: 'hp-update',     value: this.hp });
    hudBridge.emit({ type: 'shield-update', value: this.shield });
    hudBridge.emit({ type: 'enemy-count',   value: this.waves.aliveCount });
    hudBridge.emit({ type: 'kill-count',    value: this.kills });
  }

  reset(): void {
    this.clearGameState();
    this.hp = MAX_HP;
    this.shield = MAX_SHIELD;
    this.kills = 0;
    this.escaped = 0;
    this.playerX = 0;
    this.playerZ = PLAYER_START_Z;
    this.camera.position.set(0, 0, this.playerZ);
  }

  private clearGameState(): void {
    this.isPlaying = false;
    this.input?.dispose();
    this.input = null;
    this.waves?.clear();
    this.waves = null;
    this.projectiles?.clear();
    this.projectiles = null;
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.clearGameState();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
