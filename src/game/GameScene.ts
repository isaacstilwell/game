import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { StarField } from './StarField';
import { Planet } from './Planet';
import { AsteroidBelt } from './AsteroidBelt';

const PLANET_Z = -2000;

export class GameScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private rafId: number = 0;
  private controls: OrbitControls;
  private starField: StarField;
  private container: HTMLDivElement;

  constructor(container: HTMLDivElement) {
    this.container = container;

    this.scene = new THREE.Scene();

    const fov = GameScene.getFOV();
    this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.camera.position.set(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000);
    container.appendChild(this.renderer.domElement);

    this.starField = new StarField(this.scene);

    // Planet + belt share a group so they're in the same coordinate space
    const planetSystem = new THREE.Group();
    planetSystem.position.set(0, 0, PLANET_Z);
    new Planet(planetSystem);
    new AsteroidBelt(planetSystem);
    this.scene.add(planetSystem);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 0, PLANET_Z);
    this.controls.update();

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
    this.controls.update();
    this.starField.followCamera(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
