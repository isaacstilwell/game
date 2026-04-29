import * as THREE from 'three';

export class Planet {
  constructor(group: THREE.Group) {
    let planetHeight = -350;
    let planetRingRadius = 10;
    const planetRadius = 350;

    const material = new THREE.PointsMaterial({
      color: 0x515c63,
      size: 2.5,
    });

    // Direct port of isaac.info/src/entities.js getPlanet.
    while (planetHeight <= planetRadius) {
      const pointCount = Math.floor(planetRingRadius / 5);
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

      planetHeight += 5;
      planetRingRadius = Math.sqrt(planetRadius ** 2 - planetHeight ** 2);
    }

    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(planetRadius - 1),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    ));
  }
}
