import * as THREE from 'three';
import { EnemyShip } from './EnemyShip';

export class WaveManager {
  private enemies: EnemyShip[] = [];

  constructor(private scene: THREE.Scene) {}

  spawnWave(): void {
    // 3 pushers spread in X
    for (const x of [-80, 0, 80]) {
      this.enemies.push(new EnemyShip(this.scene, 'pusher', x, 0));
    }
    // 2 flankers with Y offset
    this.enemies.push(new EnemyShip(this.scene, 'flanker', -60,  40));
    this.enemies.push(new EnemyShip(this.scene, 'flanker',  60, -40));
  }

  tick(
    playerPos: THREE.Vector3,
    onEnemyFire: (origin: THREE.Vector3) => void,
  ): void {
    for (const enemy of this.enemies) {
      const { wantsToFire } = enemy.tick(playerPos);
      if (wantsToFire) onEnemyFire(enemy.getPosition().clone());
    }
  }

  getEnemies(): EnemyShip[] {
    return this.enemies;
  }

  killEnemy(enemy: EnemyShip): boolean {
    return this.removeEnemy(enemy);
  }

  despawnPassedEnemies(playerZ: number): number {
    const passedEnemies = this.enemies.filter(enemy => enemy.getPosition().z > playerZ);
    for (const enemy of passedEnemies) this.removeEnemy(enemy);
    return passedEnemies.length;
  }

  private removeEnemy(enemy: EnemyShip): boolean {
    const i = this.enemies.indexOf(enemy);
    if (i === -1) return false;
    enemy.removeFromScene(this.scene);
    this.enemies.splice(i, 1);
    return true;
  }

  get aliveCount(): number {
    return this.enemies.length;
  }

  clear(): void {
    for (const e of this.enemies) e.removeFromScene(this.scene);
    this.enemies = [];
  }
}
