import * as THREE from 'three';

export interface ExplosionHandle {
  tick(): boolean;
  dispose(): void;
}

const PARTICLE_GEO = new THREE.BoxGeometry(0.24, 0.24, 0.24);

export function spawnExplosion(
  scene: THREE.Object3D,
  origin: THREE.Vector3,
  color: { r: number; g: number; b: number },
  count         = 80,
  lifetime      = 130,
  particleRadius = 0.12,
  speed         = 0.09,
): ExplosionHandle {
  const scale = particleRadius / 0.12;
  const fadeStart = Math.floor(lifetime * 0.5);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color.r, color.g, color.b),
    transparent: true,
    opacity: 1,
  });

  const meshes: THREE.Mesh[]       = [];
  const velocities: THREE.Vector3[] = [];

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const s     = (0.06 + Math.random() * 0.30) * (speed / 0.36);
    velocities.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * s,
      Math.sin(phi) * Math.sin(theta) * s,
      Math.cos(phi) * s,
    ));
    const m = new THREE.Mesh(PARTICLE_GEO, mat);
    m.position.copy(origin);
    m.scale.setScalar(scale);
    scene.add(m);
    meshes.push(m);
  }

  let frame = 0;
  let done  = false;

  function cleanup() {
    if (done) return;
    done = true;
    meshes.forEach(m => scene.remove(m) );
    mat.dispose();
  }

  return {
    tick() {
      if (done) return false;
      frame++;
      for (let i = 0; i < meshes.length; i++) {
        meshes[i].position.add(velocities[i]);
      }
      if (frame >= fadeStart) {
        mat.opacity = 1 - (frame - fadeStart) / (lifetime - fadeStart);
      }
      if (frame >= lifetime) { cleanup(); return false; }
      return true;
    },
    dispose: cleanup,
  };
}
