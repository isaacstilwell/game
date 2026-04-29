import * as THREE from 'three';
import type { EnemyShip } from './EnemyShip';

interface Bullet {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  isPlayer: boolean;
}

const PLAYER_GEO = new THREE.SphereGeometry(0.75, 6, 6);
const PLAYER_MAT = new THREE.MeshBasicMaterial({ color: 0x6dbdaf });
const ENEMY_GEO  = new THREE.SphereGeometry(0.65, 6, 6);
const ENEMY_MAT  = new THREE.MeshBasicMaterial({ color: 0xff4444 });

const PLAYER_SPEED = 5;
const ENEMY_SPEED  = 1.2;
const HIT_ENEMY    = 8;  // 3D sphere threshold: player bullet → enemy
const HIT_PLAYER   = 5;  // 3D sphere threshold: enemy bullet → player
const CULL_AHEAD   = 2200;
const CULL_BEHIND  = 120;

export class ProjectileManager {
  private bullets: Bullet[] = [];

  constructor(private scene: THREE.Scene) {}

  spawnPlayerBullet(origin: THREE.Vector3, dir: THREE.Vector3): void {
    const mesh = new THREE.Mesh(PLAYER_GEO, PLAYER_MAT);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.bullets.push({
      mesh,
      vel: dir.clone().normalize().multiplyScalar(PLAYER_SPEED),
      isPlayer: true,
    });
  }

  spawnEnemyBullet(origin: THREE.Vector3, playerPos: THREE.Vector3): void {
    const dir = new THREE.Vector3().subVectors(playerPos, origin).normalize();
    const mesh = new THREE.Mesh(ENEMY_GEO, ENEMY_MAT);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.bullets.push({
      mesh,
      vel: dir.multiplyScalar(ENEMY_SPEED),
      isPlayer: false,
    });
  }

  tick(
    playerPos: THREE.Vector3,
    enemies: EnemyShip[],
  ): { playerHit: boolean; enemiesKilled: EnemyShip[] } {
    const killed: EnemyShip[] = [];
    let playerHit = false;
    const toRemove: Bullet[] = [];

    for (const b of this.bullets) {
      b.mesh.position.add(b.vel);
      const playerRelativeZ = b.mesh.position.z - playerPos.z;

      if (
        playerRelativeZ < -CULL_AHEAD ||
        playerRelativeZ > (b.isPlayer ? CULL_BEHIND : 0)
      ) {
        toRemove.push(b);
        continue;
      }

      if (b.isPlayer) {
        for (const enemy of enemies) {
          if (killed.includes(enemy)) continue;
          if (b.mesh.position.distanceTo(enemy.getPosition()) < HIT_ENEMY) {
            killed.push(enemy);
            toRemove.push(b);
            break;
          }
        }
      } else {
        if (b.mesh.position.distanceTo(playerPos) < HIT_PLAYER) {
          playerHit = true;
          toRemove.push(b);
        }
      }
    }

    for (const b of toRemove) {
      this.scene.remove(b.mesh);
      const i = this.bullets.indexOf(b);
      if (i !== -1) this.bullets.splice(i, 1);
    }

    return { playerHit, enemiesKilled: killed };
  }

  clear(): void {
    for (const b of this.bullets) this.scene.remove(b.mesh);
    this.bullets = [];
  }
}
