import {
  Group,
  Vector3,
} from 'three';
import QuadtreeTerrainPlane from './QuadtreeTerrainPlane';
import TerrainChunkManager from './TerrainChunkManager';
import {
  cubeTransforms,
  generateHeightMap,
  getMinChunkSize,
  getSamplingResolution,
} from './TerrainChunkUtils';
import type { AsteroidConfigData } from './AsteroidConfig';

class QuadtreeTerrainCube {
  radius: number;
  cameraPosition: Vector3 | null;
  smallestActiveChunkSize: number;
  minChunkSize: number;
  builder: TerrainChunkManager;
  groups: Group[];
  chunks: Record<string, any>;
  sides: any[];
  queuedChanges: any[];

  constructor(i: number, config: AsteroidConfigData, textureSize: number, workerPool: any, materialOverrides: any = {}) {
    this.radius = config.radius;
    this.cameraPosition = null;
    this.smallestActiveChunkSize = 2 * this.radius;

    this.minChunkSize = getMinChunkSize(this.radius);
    const prerenderResolution = getSamplingResolution(this.radius, this.minChunkSize);

    this.builder = new TerrainChunkManager(
      i,
      config,
      textureSize || prerenderResolution,
      workerPool,
      materialOverrides,
    );
    this.groups = [...new Array(6)].map(() => new Group());
    this.chunks = {};
    this.sides = [];
    this.queuedChanges = [];

    for (let idx = 0; idx < cubeTransforms.length; idx++) {
      const transform = cubeTransforms[idx];
      const sideIndex = idx;
      this.sides.push({
        index: sideIndex,
        transform: transform.clone(),
        quadtree: new QuadtreeTerrainPlane({
          side: sideIndex,
          size: this.radius,
          minChunkSize: this.minChunkSize,
          heightSamples: this.prerenderCoarseGeometry(
            transform.clone(),
            prerenderResolution,
            config
          ),
          sampleResolution: prerenderResolution,
          localToWorld: transform.clone(),
          worldStretch: config.stretch,
        }),
      });

      this.groups[sideIndex].matrix = transform.clone();
      this.groups[sideIndex].matrixAutoUpdate = false;
    }
  }

  dispose() {
    if (this.chunks) Object.values(this.chunks).forEach(({ chunk }: any) => chunk.dispose());
    if (this.builder) this.builder.dispose();
  }

  prerenderCoarseGeometry(sideTransform: any, resolution: number, config: AsteroidConfigData): number[] {
    const heightMap = generateHeightMap(
      sideTransform,
      1,
      new Vector3(0, 0, 0),
      resolution,
      { N: 1, S: 1, E: 1, W: 1 },
      false,
      config,
      'texture'
    );
    const heightSamples: number[] = [];
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const bi = (resolution * (resolution - y - 1) + x) * 4;
        const disp = -1 + (heightMap.buffer[bi] + heightMap.buffer[bi + 1] / 255) / 127.5;
        heightSamples.push(config.radius * (1 + disp * config.dispWeight));
      }
    }
    return heightSamples;
  }

  setCameraPosition(cameraPosition: Vector3) {
    this.cameraPosition = cameraPosition;

    for (const s of this.sides) {
      s.quadtree.setCameraPosition(cameraPosition);
      s.quadtree.populateEdges();
    }

    for (const s of this.sides) {
      s.quadtree.populateNonsideNeighbors(this.sides);
    }

    const queuedChangesObj: Record<string, any> = {};

    const updatedChunks: Record<string, any> = {};
    this.sides.forEach((side: any) => {
      const sideChunks = side.quadtree.getChildren();
      Object.keys(sideChunks).forEach((k) => {
        const node = sideChunks[k];
        const stitchingStrides: Record<string, number> = {};
        Object.keys(node.neighbors).forEach((orientation: string) => {
          stitchingStrides[orientation] = Math.max(1, (node.neighbors[orientation]?.size?.x || 0) / node.size.x);
        });
        node.stitchingStrides = stitchingStrides;
        node.renderSig = `${node.key} [${Object.values(node.stitchingStrides).join('')}]`;
        updatedChunks[k] = node;
      });
    });

    if (Object.keys(this.chunks).length === 0) {
      queuedChangesObj.initial = {
        _distance: 0,
        add: Object.values(updatedChunks)
      };
    } else {
      Object.keys(this.chunks).forEach((renderSig) => {
        const chunk = this.chunks[renderSig];

        if (updatedChunks[chunk.key]) {
          if (updatedChunks[chunk.key].renderSig !== renderSig) {
            if (!queuedChangesObj.rebuild) {
              queuedChangesObj.rebuild = { add: [], removeByKey: [] };
            }
            queuedChangesObj.rebuild.add.push(updatedChunks[chunk.key]);
            queuedChangesObj.rebuild.removeByKey.push(renderSig);
          }
        } else {
          const descendents = Object.keys(updatedChunks).reduce((acc: any[], cur) => {
            if (cur.indexOf(`${chunk.key}.`) === 0) acc.push(updatedChunks[cur]);
            return acc;
          }, []);
          if (descendents.length > 0) {
            queuedChangesObj[chunk.key] = {
              _distance: descendents.reduce((acc: number, cur: any) => Math.min(acc, cur.distanceToCamera), Infinity),
              removeByKey: [renderSig],
              add: descendents,
            };
          } else {
            const closestAncestorKey = Object.keys(updatedChunks)
              .filter((k) => chunk.key === `${k}` || (chunk.key.indexOf(`${k}.`) === 0))
              .sort((a, b) => b.length - a.length)
              .shift();
            if (closestAncestorKey) {
              if (!queuedChangesObj[closestAncestorKey]) {
                queuedChangesObj[closestAncestorKey] = {
                  _distance: updatedChunks[closestAncestorKey].distanceToCamera,
                  add: [updatedChunks[closestAncestorKey]],
                  removeByKey: []
                };
              }
              queuedChangesObj[closestAncestorKey].removeByKey.push(renderSig);
            }
          }
        }
      });

      if (queuedChangesObj.rebuild) {
        queuedChangesObj.rebuild._distance = queuedChangesObj.rebuild.add.reduce((acc: number, cur: any) => Math.min(acc, cur.distanceToCamera), Infinity);
      }
    }

    this.queuedChanges = Object.values(queuedChangesObj)
      .sort((a: any, b: any) => a._distance - b._distance);
  }

  processNextQueuedChange() {
    if (!this.queuedChanges || this.queuedChanges.length === 0) {
      return;
    }

    const { add, removeByKey } = this.queuedChanges.shift();

    add.forEach((node: any) => {
      this.chunks[node.renderSig] = {
        key: node.key,
        position: [node.center.x, node.center.z],
        renderSig: node.renderSig,
        size: node.size.x,
        sphereCenter: node.sphereCenter,
        sphereCenterHeight: node.sphereCenterHeight,
        chunk: this.builder.allocateChunk({
          group: this.groups[node.side],
          minHeight: node.unstretchedMin,
          offset: new Vector3(node.center.x, node.center.y, node.center.z),
          radius: this.radius,
          side: node.side,
          stitchingStrides: node.stitchingStrides,
          width: node.size.x,
        })
      };
    });
    this.builder.waitForChunks(add.length);

    const removeChunks = (removeByKey || []).map((k: string) => this.chunks[k]);
    this.builder.queueForRecycling(removeChunks.map((n: any) => n.chunk));

    removeChunks.forEach((c: any) => {
      delete this.chunks[c.renderSig];
    });

    this.smallestActiveChunkSize = Object.values(this.chunks).reduce((acc: any, node: any) => {
      return (acc === null || node.size < acc) ? node.size : acc;
    }, null);
  }
}

export default QuadtreeTerrainCube;
