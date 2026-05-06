import TerrainChunk from './TerrainChunk';
import { rebuildChunkMaps } from './TerrainChunkUtils';
import constants from './constants';
import type { AsteroidConfigData } from './AsteroidConfig';

const {
  ENABLE_TERRAIN_CHUNK_RESOURCE_POOL,
  TERRAIN_CHUNK_POOL_SIZE_MIN,
  TERRAIN_CHUNK_POOL_SIZE_LOOKBACK,
} = constants;

class TerrainChunkManager {
  asteroidId: number;
  config: AsteroidConfigData;
  workerPool: any;
  materialOverrides: any;
  textureSize: number;
  pool: TerrainChunk[];
  waitingOn: number;
  _queued: TerrainChunk[];
  _old: TerrainChunk[];
  _new: TerrainChunk[];
  recentAddAtOnceAmounts: number[];
  targetPoolSize: number;

  constructor(i: number, config: AsteroidConfigData, textureSize: number, workerPool: any, materialOverrides: any = {}) {
    this.asteroidId = i;
    this.config = config;
    this.workerPool = workerPool;
    this.materialOverrides = materialOverrides;
    this.textureSize = textureSize;
    this.pool = [];
    this.waitingOn = 0;
    this._queued = [];
    this._old = [];
    this._new = [];
    this.reset();

    this.recentAddAtOnceAmounts = [];
    this.targetPoolSize = TERRAIN_CHUNK_POOL_SIZE_MIN;
  }

  dispose() {
    let chunk: TerrainChunk | undefined;
    while ((chunk = this.pool.pop())) chunk.dispose();
    this.reset();
  }

  isBusy(): boolean {
    return this.waitingOn > this._new.length;
  }

  isUpdating(): boolean {
    return this.waitingOn > 0;
  }

  isWaitingOnMaps(): boolean {
    return this.waitingOn > 0 && (this._new.length < this.waitingOn);
  }

  reset() {
    this.waitingOn = 0;
    this._queued = [];
    this._old = [];
    this._new = [];
  }

  allocateChunk(params: any): TerrainChunk {
    let chunk = this.pool.pop();
    if (chunk) {
      chunk.reconfigure(params);
    } else {
      chunk = new TerrainChunk(
        params,
        this.config,
        {
          materialOverrides: this.materialOverrides,
          resolution: this.textureSize,
        },
      );
    }

    chunk.hide();
    chunk.attachToGroup();

    const scope = this;
    this.workerPool.processInBackground(
      {
        topic: 'rebuildTerrainGeometry',
        asteroid: {
          key: this.asteroidId,
          config: this.config,
        },
        chunk: {
          edgeStrides: chunk._params.stitchingStrides,
          offset: chunk._params.offset.toArray(),
          width: chunk._params.width,
          groupMatrix: chunk._params.group.matrix.clone(),
          minHeight: chunk._params.minHeight,
          resolution: this.textureSize,
          side: chunk._params.side,
          stretch: chunk._stretch.toArray(),
        },
        _cacheable: 'asteroid'
      },
      ({ positions, normals }: { positions: Float32Array; normals: Float32Array }) => {
        chunk!.updateGeometry(positions, normals);
        scope._queued.push(chunk!);
      }
    );

    return chunk;
  }

  waitForChunks(howMany: number) {
    this.waitingOn = howMany;

    this.recentAddAtOnceAmounts.push(howMany);
    if (this.recentAddAtOnceAmounts.length >= TERRAIN_CHUNK_POOL_SIZE_LOOKBACK) {
      this.recentAddAtOnceAmounts = this.recentAddAtOnceAmounts.slice(this.recentAddAtOnceAmounts.length - TERRAIN_CHUNK_POOL_SIZE_LOOKBACK);
      this.targetPoolSize = this.recentAddAtOnceAmounts.reduce((a, b) => Math.max(a, b), TERRAIN_CHUNK_POOL_SIZE_MIN);
    }
  }

  queueForRecycling(chunks: TerrainChunk[]) {
    this._old = chunks;
  }

  updateMaps(until?: number) {
    let chunk: TerrainChunk | undefined;

    while ((chunk = this._queued.pop())) {
      chunk.updateMaps(
        rebuildChunkMaps({
          config: this.config,
          edgeStrides: chunk._params.stitchingStrides,
          groupMatrix: chunk._params.group.matrix.clone(),
          offset: chunk._params.offset.clone(),
          resolution: chunk._resolution,
          side: chunk._params.side,
          width: chunk._params.width,
        })
      );
      this._new.push(chunk);

      if (until && Date.now() > until) {
        break;
      }
    }
  }

  update() {
    if (this.isBusy()) return;

    let chunk: TerrainChunk | undefined;
    while ((chunk = this._old.pop())) {
      if (ENABLE_TERRAIN_CHUNK_RESOURCE_POOL && chunk.isReusable() && this.pool.length < this.targetPoolSize) {
        chunk.detachFromGroup();
        this.pool.push(chunk);
      } else {
        chunk.dispose();
      }
    }

    while ((chunk = this._new.pop())) {
      chunk.show();
    }

    this.reset();
  }
}

export default TerrainChunkManager;
