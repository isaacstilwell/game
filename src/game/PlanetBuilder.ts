import * as THREE from 'three';
import { LessDepth } from 'three';
import { rebuildChunkGeometry } from './asteroid/TerrainChunkUtils';
import QuadtreeTerrainCube from './asteroid/QuadtreeTerrainCube';
import type { AsteroidConfigData } from './asteroid/AsteroidConfig';

export const PLANET_RADIUS = 350;

function makePlanetConfig(): AsteroidConfigData {
  return {
    craterCut: 0.0,
    craterFalloff: 1.5,
    craterPasses: 0,
    craterPersist: 0.0,
    craterSteep: 1.0,
    dispFreq: 0.35,
    dispPasses: 6,
    dispPersist: 0.5,
    dispWeight: 0.12,
    maxExtraPasses: 3,
    featuresFreq: 1.5,
    featuresSharpness: 0.85,
    fineDispFraction: 0.4,
    radius: PLANET_RADIUS,
    ridgeWeight: 0.5,
    rimVariation: 0.0,
    rimWeight: 0.0,
    rimWidth: 0.0,
    seed: new THREE.Vector3(0.3, 0.7, 0.5),
    stretch: new THREE.Vector3(1, 1, 1),
    topoDetail: 5,
    topoFreq: 1.5,
    topoWeight: 0.35,
  };
}

// Synchronous in-main-thread worker stub (same pattern as AsteroidBuilder).
let _asteroidCache: any = {};
const workerPool = {
  processInBackground: (message: any, callback: (result: any) => void) => {
    if (message.asteroid) _asteroidCache = message.asteroid;
    const chunkData = { ..._asteroidCache, ...message.chunk };
    chunkData.offset = new THREE.Vector3(chunkData.offset[0], chunkData.offset[1], chunkData.offset[2]);
    chunkData.stretch = new THREE.Vector3(chunkData.stretch[0], chunkData.stretch[1], chunkData.stretch[2]);
    callback(rebuildChunkGeometry(chunkData));
  },
  broadcast: () => {},
  cancelBackgroundProcesses: () => {},
};

export interface PlanetHandle {
  group: THREE.Group;
  update: (cameraPosition: THREE.Vector3) => void;
  dispose: () => void;
}

export async function buildPlanet(res = 16): Promise<PlanetHandle> {
  const config = makePlanetConfig();

  const materialOverrides = {
    color: 0x515c63,
    size: 2.5,
    sizeAttenuation: true,
    hideFill: true,
  };

  const qtc = new QuadtreeTerrainCube(0, config, res, workerPool, materialOverrides);
  const group = new THREE.Group();

  // Single continuous fill sphere — no per-chunk fill meshes to avoid T-junction seams
  // at LOD boundaries. Ocean points masked to (0,0,0) are occluded by this sphere.
  const fillSphere = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS * 0.99, 64, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000, depthFunc: LessDepth }),
  );
  group.add(fillSphere);

  qtc.groups.forEach((g: THREE.Group) => group.add(g));

  // Start from very far away so the initial pass uses the coarsest LOD.
  qtc.setCameraPosition(new THREE.Vector3(0, 0, 1e11));

  await new Promise<void>((resolve) => {
    const tick = () => {
      if (qtc.builder.isUpdating()) {
        if (qtc.builder.isWaitingOnMaps()) {
          qtc.builder.updateMaps();
        } else {
          qtc.builder.update();
          resolve();
          return;
        }
      } else {
        qtc.processNextQueuedChange();
      }
      setTimeout(tick, 50);
    };
    tick();
  });

  function update(cameraPosition: THREE.Vector3) {
    qtc.setCameraPosition(cameraPosition);
    if (qtc.builder.isUpdating()) {
      if (qtc.builder.isWaitingOnMaps()) {
        qtc.builder.updateMaps();
      } else {
        qtc.builder.update();
      }
    } else {
      qtc.processNextQueuedChange();
    }
  }

  return { group, update, dispose: () => qtc.dispose() };
}
