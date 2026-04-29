import * as THREE from 'three';

export class InputController {
  private mouseNDC = new THREE.Vector2(0, 0);
  private left = false;
  private right = false;
  private shooting = false;
  private cooldown = 0;
  private readonly COOLDOWN = 12;

  constructor() {
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseNDC.y = -((e.clientY / window.innerHeight) * 2 - 1);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')  this.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.right = true;
    if (e.code === 'Space') this.shooting = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')  this.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.right = false;
    if (e.code === 'Space') this.shooting = false;
  };

  private onMouseDown = (): void => { this.shooting = true; };
  private onMouseUp   = (): void => { this.shooting = false; };

  getMouseNDC(): THREE.Vector2 { return this.mouseNDC; }

  getStrafeDir(): number {
    return (this.left ? -1 : 0) + (this.right ? 1 : 0);
  }

  tickShoot(): boolean {
    if (this.cooldown > 0) { this.cooldown--; return false; }
    if (this.shooting) { this.cooldown = this.COOLDOWN; return true; }
    return false;
  }

  dispose(): void {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
}
