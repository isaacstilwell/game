import * as THREE from 'three';

export class Planet {
  constructor(group: THREE.Group) {
    const planetRadius = 350;
    let planetHeight = -planetRadius;
    let planetRingRadius = 10;

    const material = new THREE.PointsMaterial({
      color: 0x515c63,
      size: 1,
      sizeAttenuation: false,
    });

    // Adapted from entities.js getPlanet — step increased for visible ring separation
    while (planetHeight <= planetRadius) {
      if (planetRingRadius > 0) {
        const pointCount = Math.floor(planetRingRadius / 2);
        const positions = new Float32Array(pointCount * 3);

        for (let i = 0; i < pointCount; i++) {
          const angle = (i / pointCount) * Math.PI * 2;
          positions[i * 3]     = Math.cos(angle) * planetRingRadius;
          positions[i * 3 + 1] = Math.sin(angle) * planetRingRadius;
          positions[i * 3 + 2] = planetHeight;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        group.add(new THREE.Points(geometry, material));
      }

      planetHeight += 15;
      planetRingRadius = Math.sqrt(Math.max(0, planetRadius ** 2 - planetHeight ** 2));
    }

    // Black occluder so back-side rings don't show through
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(planetRadius - 1, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    ));
  }
}
