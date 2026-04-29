import * as THREE from 'three';

export type EnemyType = 'pusher' | 'flanker';

const GEO        = new THREE.BoxGeometry(3, 0.5, 1.5);
const MAT_PUSHER = new THREE.MeshBasicMaterial({ color: 0xff3333 });
const MAT_FLANKER = new THREE.MeshBasicMaterial({ color: 0xff9900 });
const FLANKER_FORWARD_SPEED = 0.12;
const FLANKER_ORBIT_SPEED = 0.006;
const FLANKER_ORBIT_RADIUS = 40;

export class EnemyShip {
  readonly mesh: THREE.Mesh;
  readonly type: EnemyType;
  private fireTimer: number;
  private readonly FIRE_INTERVAL: number;

  // pusher state
  private retreating = false;

  // flanker state
  private anchor = new THREE.Vector3();
  private orbitAngle = 0;

  constructor(scene: THREE.Scene, type: EnemyType, spawnX: number, spawnY: number) {
    this.type = type;
    this.mesh = new THREE.Mesh(GEO, type === 'pusher' ? MAT_PUSHER : MAT_FLANKER);
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

    // Trigger retreat when within 60 units of player Z
    if (!this.retreating && pos.z > -60) {
      this.retreating = true;
    }

    if (this.retreating) {
      pos.z -= 0.4;
      if (pos.z <= -150) this.retreating = false;
    } else {
      // Move toward player in 3D at 0.8 units/frame
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
