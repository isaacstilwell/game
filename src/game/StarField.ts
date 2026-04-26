import * as THREE from 'three';

export class StarField {
  private points: THREE.Points;

  constructor(scene: THREE.Scene) {
    const count = 1000;
    const positions = new Float32Array(count * 3);
    const radius = 5000;

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.5 + Math.random() * 0.5);

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: 0x515c63,
      size: 1.5,
      sizeAttenuation: false,
    }));

    scene.add(this.points);
  }

  // Call each frame so stars never parallax regardless of camera position
  followCamera(cameraPosition: THREE.Vector3): void {
    this.points.position.copy(cameraPosition);
  }
}
