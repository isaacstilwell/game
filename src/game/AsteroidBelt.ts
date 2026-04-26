import * as THREE from 'three';

// Ported from entities.js getRings — replacement-point logic removed
export class AsteroidBelt {
  constructor(group: THREE.Group) {
    let radius = 550;
    let radiusStep = 3;
    let stepVelocity = 0;
    const maxRadius = 800;

    const ringConfig = {
      momentumFactor: 0.5,
      baseVariance: 2.5,
      oscillationBias: 1.5,
      minStep: 1,
      maxStep: 100,
      baseDensity: 100,
    };

    const material = new THREE.PointsMaterial({
      color: 0x515c63,
      size: 1,
      sizeAttenuation: false,
    });

    while (radius < maxRadius) {
      const reversalPull = -stepVelocity * ringConfig.oscillationBias;
      const randomChange = (Math.random() - 0.5) * ringConfig.baseVariance;
      const stepChange = stepVelocity * ringConfig.momentumFactor + reversalPull + randomChange;

      stepVelocity = stepChange;
      radiusStep += stepChange;
      radiusStep = Math.max(ringConfig.minStep, Math.min(ringConfig.maxStep, radiusStep));

      if (radiusStep === ringConfig.minStep || radiusStep === ringConfig.maxStep) {
        stepVelocity *= -0.5;
      }

      const density = 1.0 + (radius - 550) * 0.02;
      const pointCount = Math.floor(ringConfig.baseDensity * density);
      const positions = new Float32Array(pointCount * 3);

      for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * Math.PI * 2;
        const radialNoise = (Math.random() - 0.5) * 3.0;
        const effectiveRadius = radius + radialNoise;

        positions[i * 3]     = Math.cos(angle) * effectiveRadius;
        positions[i * 3 + 1] = Math.sin(angle) * effectiveRadius;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2.5 * Math.exp(-Math.abs(radialNoise) * 5);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      group.add(new THREE.Points(geometry, material));

      radius += radiusStep;
    }
  }
}
