import * as THREE from 'three';
import { rebuildChunkGeometry } from './TerrainChunkUtils';
import QuadtreeTerrainCube from './QuadtreeTerrainCube';
import Config from './AsteroidConfig';
import constants from './constants';

let asteroidCache: any = {};

const workerPool = {
  processInBackground: (message: any, callback: (result: any) => void) => {
    if (message.asteroid) asteroidCache = message.asteroid;
    const chunkData = { ...asteroidCache, ...message.chunk };
    chunkData.offset = new THREE.Vector3(chunkData.offset[0], chunkData.offset[1], chunkData.offset[2]);
    chunkData.stretch = new THREE.Vector3(chunkData.stretch[0], chunkData.stretch[1], chunkData.stretch[2]);
    callback(rebuildChunkGeometry(chunkData));
  },
  broadcast: () => {},
  cancelBackgroundProcesses: () => {},
};

export interface AsteroidHandle {
  group: THREE.Group;
  update: (cameraPosition: THREE.Vector3) => void;
}

export async function buildAsteroid(id: number, res: number = 16, radius: number = 5): Promise<AsteroidHandle> {
  const config = await Config.create(id, radius);
  const qtc = new QuadtreeTerrainCube(id, config, res, workerPool, {});
  const group = new THREE.Group();
  qtc.groups.forEach((g: THREE.Group) => group.add(g));
  qtc.setCameraPosition(new THREE.Vector3(0, 0, constants.AU));

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

  return { group, update };
}
