import * as THREE from 'three';
import { EnemyShip } from './EnemyShip';

const PUSHER_SPREAD  = 120;
const FLANKER_SPREAD = 100;

export class WaveManager {
  private enemies: EnemyShip[] = [];
  private activePusher: EnemyShip | null = null;

  constructor(private scene: THREE.Scene) {}

  spawnWave(pusherCount: number, flankerCount: number): void {
    for (let i = 0; i < pusherCount; i++) {
      const t = pusherCount === 1 ? 0 : (i / (pusherCount - 1)) * 2 - 1;
      const x = t * PUSHER_SPREAD;
      const y = ((i % 3) - 1) * 20;
      this.enemies.push(new EnemyShip(this.scene, 'pusher', x, y));
    }
    for (let i = 0; i < flankerCount; i++) {
      const t = flankerCount === 1 ? 0 : (i / (flankerCount - 1)) * 2 - 1;
      const x = t * FLANKER_SPREAD;
      const y = i % 2 === 0 ? 40 : -40;
      this.enemies.push(new EnemyShip(this.scene, 'flanker', x, y));
    }
    this.startNextPusherCharge();
  }

  private getPushers(): EnemyShip[] {
    return this.enemies.filter(e => e.type === 'pusher');
  }

  private startNextPusherCharge(): void {
    const pushers = this.getPushers();
    if (pushers.length === 0) return;

    let nextIdx = 0;
    if (this.activePusher !== null) {
      const cur = pushers.indexOf(this.activePusher);
      if (cur !== -1) nextIdx = (cur + 1) % pushers.length;
    }

    this.activePusher = pushers[nextIdx];
    this.activePusher.onCycleComplete = () => this.startNextPusherCharge();
    this.activePusher.startCharge();
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
    const wasActive = enemy === this.activePusher;
    if (!this.removeEnemy(enemy)) return false;
    if (wasActive) {
      this.activePusher = null;
      this.startNextPusherCharge();
    }
    return true;
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
