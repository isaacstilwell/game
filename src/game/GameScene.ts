import * as THREE from 'three';
import { AsteroidBelt } from './AsteroidBelt';
import { InputController } from './InputController';
import { WaveManager } from './WaveManager';
import { ProjectileManager } from './ProjectileManager';
import { Wave2DodgeManager, SLICE_CENTER, SLICE_HALF } from './Wave2DodgeManager';
import { hudBridge } from './hudBridge';

const STRAFE_SPEED             = 0.75;
const STRAFE_MAX               = 150;
const MAX_HP                   = 100;
const MAX_SHIELD               = 50;
const SHIELD_DMG               = 10;
const HP_DMG                   = 10;
const ISAAC_INFO_IDLE_ROTATION = -0.00015;
const PLAYER_START_Z           = 120;
const PLAYER_FORWARD_SPEED     = 0.16;

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
  private wave2CamActive = false;

  private planetSystem: THREE.Group;
  private isaacInfoViewRoot: THREE.Group;
  private belt: AsteroidBelt;
  private beltSliced = false;
  private terrainManager: import('@/game/planet3/terrain').TerrainChunkManager | null = null;

  // Captured planetSystem.rotation.z when wave 2 activates, used to compensate
  // the virtual camera matrix so belt-local positions map correctly to screen.
  private wave2RotTheta = 0;

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

    this.isaacInfoViewRoot = new THREE.Group();
    this.isaacInfoViewRoot.matrix.copy(GameScene.getIsaacInfoViewMatrix());
    this.isaacInfoViewRoot.matrixAutoUpdate = false;
    this.isaacInfoViewRoot.matrixWorldNeedsUpdate = true;

    this.planetSystem = new THREE.Group();
    this.belt = new AsteroidBelt(this.planetSystem);

    // Fixed virtual camera for terrain LOD — orbit distance in planetSystem local space.
    // Matches the planet3 lab orbit starting position so detail levels are consistent.
    const terrainLodCamera = new THREE.PerspectiveCamera();
    terrainLodCamera.position.set(612, 612, 612);
    import('@/game/planet3/terrain').then(({ TerrainChunkManager }) => {
      this.terrainManager = new TerrainChunkManager({ camera: terrainLodCamera, parent: this.planetSystem });
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
    if (!this.wave2CamActive) this.planetSystem.rotation.z += ISAAC_INFO_IDLE_ROTATION;
    if (this.isPlaying) this.tickGame();
    else if (this.wave2) this.tickWave2();
    this.terrainManager?.Update();
    this.renderer.render(this.scene, this.camera);
  };

  private static getIsaacInfoViewMatrix(): THREE.Matrix4 {
    const referenceCamera = new THREE.PerspectiveCamera();
    referenceCamera.position.set(250, -1500, 500);
    referenceCamera.lookAt(0, 0, 0);
    referenceCamera.updateMatrixWorld(true);
    return referenceCamera.matrixWorldInverse.clone();
  }

  // Sets isaacInfoViewRoot.matrix so belt-local space is viewed from the
  // wave2 virtual camera, accounting for accumulated planetSystem rotation.
  private applyWave2CameraMatrix(): void {
    const camInv = this.wave2!.getCameraMatrix();
    const rotInv = new THREE.Matrix4().makeRotationZ(-this.wave2RotTheta);
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
    this.playerZ -= PLAYER_FORWARD_SPEED;
    this.camera.position.z = this.playerZ;

    const playerPos = this.camera.position.clone();

    if (this.despawnPassedEnemies(playerPos.z) && this.syncEnemyRoster()) return;

    if (this.input.tickShoot()) {
      this.raycaster.setFromCamera(this.input.getMouseNDC(), this.camera);
      this.projectiles.spawnPlayerBullet(playerPos, this.raycaster.ray.direction);
    }

    this.waves.tick(playerPos, (origin) => {
      this.projectiles!.spawnEnemyBullet(origin, playerPos);
    });

    const { playerHit, enemiesKilled } = this.projectiles.tick(playerPos, this.waves.getEnemies());

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

  private tickWave2(): void {
    if (!this.wave2 || !this.wave2CamActive) return;

    // Keep the approach view updated every frame
    this.applyWave2CameraMatrix();

    if (!this.wave2.isReady || !this.input) return;

    const { damaged, complete } = this.wave2.tick(this.input.getStrafeDir());

    if (damaged && this.applyDamage()) return;
    if (!this.wave2) return; // applyDamage may have called clearGameState

    this.applyWave2CameraMatrix();

    if (complete) {
      this.wave2.clear();
      this.wave2 = null;
      this.wave2CamActive = false;
      this.input.dispose();
      this.input = null;
      this.restoreBelt();
      hudBridge.emit({ type: 'asteroid-clear', kills: this.kills });
    }
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

    // Wave 1 complete — tear everything down and show the wave-clear screen
    this.clearGameState();
    hudBridge.emit({ type: 'wave-clear', kills: this.kills, escaped: this.escaped });
    return true;
  }

  private restoreBelt(): void {
    if (!this.beltSliced) return;
    this.belt.dispose();
    this.belt = new AsteroidBelt(this.planetSystem);
    this.beltSliced = false;
  }

  /** Phase 1 — called when the player clicks Continue after wave 1.
   *  Kicks off async asteroid generation while keeping the normal background view. */
  prepareWave2(): void {
    this.wave2 = new Wave2DodgeManager(
      this.planetSystem,
      () => { hudBridge.emit({ type: 'wave2-ready' }); },
      (loaded, total) => { hudBridge.emit({ type: 'wave2-progress', loaded, total }); },
    );
  }

  /** Phase 2 — called by GamePage when wave2-ready fires.
   *  Activates the belt camera and starts gameplay. */
  startWave2(): void {
    if (!this.wave2) return;

    // Capture the belt's current rotation so the virtual camera can compensate
    this.wave2RotTheta = this.planetSystem.rotation.z;

    // Swap the full belt for a version with the slice cut out
    this.belt.dispose();
    this.belt = new AsteroidBelt(this.planetSystem, { center: SLICE_CENTER, half: SLICE_HALF });
    this.beltSliced = true;

    // Reset the THREE camera to origin — wave 2 drives view via isaacInfoViewRoot.matrix
    this.camera.position.set(0, 0, 0);
    this.camera.updateMatrixWorld(true);

    // Input for strafing during dodge
    this.input = new InputController();

    // Activate belt camera and notify HUD
    this.wave2CamActive = true;
    const count = this.wave2.count;
    // Defer one tick so the HUD re-mounts and subscribes before receiving the event
    setTimeout(() => hudBridge.emit({ type: 'enemy-count', value: count }), 0);
    this.applyWave2CameraMatrix();
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
    this.isaacInfoViewRoot.matrix.copy(GameScene.getIsaacInfoViewMatrix());
    this.isaacInfoViewRoot.matrixWorldNeedsUpdate = true;
  }

  private clearGameState(): void {
    this.isPlaying = false;
    this.wave2CamActive = false;
    this.input?.dispose();
    this.input = null;
    this.waves?.clear();
    this.waves = null;
    this.projectiles?.clear();
    this.projectiles = null;
    this.wave2?.clear();
    this.wave2 = null;
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
