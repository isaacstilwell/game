import * as THREE from 'three';

interface SliceExclude { center: number; half: number; }

function angleDist(a: number, b: number): number {
  return Math.abs(((a - b + Math.PI) % (2 * Math.PI)) - Math.PI);
}

// Ported from entities.js getRings
export class AsteroidBelt {
  private readonly ownGroup: THREE.Group;

  constructor(parent: THREE.Group, sliceExclude?: SliceExclude) {
    this.ownGroup = new THREE.Group();
    parent.add(this.ownGroup);
    this.generate(sliceExclude);
  }

  private generate(sliceExclude?: SliceExclude) {
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

    const material = new THREE.PointsMaterial({ color: 0x515c63, size: 1 });

    while (radius < maxRadius) {
      const reversalPull = -stepVelocity * ringConfig.oscillationBias;
      const randomChange = (Math.random() - 0.5) * ringConfig.baseVariance;
      const stepChange = stepVelocity * ringConfig.momentumFactor + reversalPull + randomChange;
      stepVelocity = stepChange;
      radiusStep += stepChange;
      radiusStep = Math.max(ringConfig.minStep, Math.min(ringConfig.maxStep, radiusStep));
      if (radiusStep === ringConfig.minStep || radiusStep === ringConfig.maxStep) stepVelocity *= -0.5;

      const density = 1.0 + (radius - 550) * 0.02;
      const pointCount = Math.floor(ringConfig.baseDensity * density);
      const positions: number[] = [];

      for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * Math.PI * 2;
        if (sliceExclude && angleDist(angle, sliceExclude.center) <= sliceExclude.half) continue;
        const radialNoise = (Math.random() - 0.5) * 3.0;
        const effectiveRadius = radius + radialNoise;
        positions.push(
          Math.cos(angle) * effectiveRadius,
          Math.sin(angle) * effectiveRadius,
          (Math.random() - 0.5) * 2.5 * Math.exp(-Math.abs(radialNoise) * 5),
        );
      }

      if (positions.length > 0) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        this.ownGroup.add(new THREE.Points(geometry, material));
      }

      radius += radiusStep;
    }
  }

  dispose(): void {
    this.ownGroup.parent?.remove(this.ownGroup);
  }
}
