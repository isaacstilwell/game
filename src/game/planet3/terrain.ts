import * as THREE from 'three';
import { CubeQuadTree, _PLANET_RADIUS, _MIN_CELL_SIZE, _LOD_MULTIPLIER } from './quadtree';
import { TerrainChunk, type WorkResult } from './terrain-chunk';
import { utils } from './utils';

const _MIN_CELL_RESOLUTION = 128;

interface WorkRequest {
  id: number;
  matrix: number[];
  ox: number; oy: number; oz: number;
  width: number;
  resolution: number;
  radius: number;
}

class TerrainWorkerPool {
  private _free: Worker[] = [];
  private _pending = 0;
  private _queue: Array<{ req: WorkRequest; onDone: (r: WorkResult & { id: number }) => void }> = [];
  private _callbacks = new Map<number, (r: WorkResult & { id: number }) => void>();

  constructor() {
    const count = typeof navigator !== 'undefined'
      ? Math.max(2, Math.min(4, (navigator.hardwareConcurrency ?? 4) - 1))
      : 2;
    for (let i = 0; i < count; i++) {
      const w = new Worker(new URL('./terrain.worker.ts', import.meta.url));
      w.onmessage = (e: MessageEvent<WorkResult & { id: number }>) => {
        this._pending--;
        const cb = this._callbacks.get(e.data.id);
        this._callbacks.delete(e.data.id);
        cb?.(e.data);
        const next = this._queue.shift();
        if (next) {
          this._dispatch(w, next.req, next.onDone);
        } else {
          this._free.push(w);
        }
      };
      w.onerror = () => {
        this._pending--;
        const next = this._queue.shift();
        if (next) {
          this._dispatch(w, next.req, next.onDone);
        } else {
          this._free.push(w);
        }
      };
      this._free.push(w);
    }
  }

  get busy(): boolean { return this._pending > 0; }

  enqueue(req: WorkRequest, onDone: (r: WorkResult & { id: number }) => void): void {
    this._pending++;
    const w = this._free.pop();
    if (w) {
      this._dispatch(w, req, onDone);
    } else {
      this._queue.push({ req, onDone });
    }
  }

  private _dispatch(w: Worker, req: WorkRequest, onDone: (r: WorkResult & { id: number }) => void): void {
    this._callbacks.set(req.id, onDone);
    w.postMessage(req);
  }
}

export class TerrainChunkManager {
  private _params: { camera: THREE.Camera; parent: THREE.Object3D };
  private _materials: Map<number, THREE.PointsMaterial>;
  private _pool: TerrainWorkerPool;
  private _groups: THREE.Group[];
  private _chunks: Record<string, any>;
  private _nextId = 0;

  // Batch tracking: show all new chunks only after the whole batch completes,
  // so we never flash a partially-updated LOD ring.
  private _batchNew: TerrainChunk[] = [];
  private _batchOld: any[] = [];
  private _batchExpected = 0;
  private _batchDone = 0;

  constructor(params: { camera: THREE.Camera; parent: THREE.Object3D }) {
    this._params = params;
    this._materials = new Map();
    this._pool = new TerrainWorkerPool();
    this._groups = [...new Array(6)].map(() => new THREE.Group());
    params.parent.add(...this._groups);
    this._chunks = {};
  }

  private _Key(c: any): string {
    return c.position[0] + '/' + c.position[1] + ' [' + c.size + ']' + ' [' + c.index + ']';
  }

  private _getMaterial(resolution: number): THREE.PointsMaterial {
    if (!this._materials.has(resolution)) {
      this._materials.set(resolution, new THREE.PointsMaterial({
        color: 0x515c63,
        size: 2,
        sizeAttenuation: true,
      }));
    }
    return this._materials.get(resolution)!;
  }

  private _RecycleChunks(chunks: any[]) {
    for (const c of chunks) c.chunk.Destroy();
  }

  private _UpdateVisibleChunks() {
    const q = new CubeQuadTree({ radius: _PLANET_RADIUS, min_node_size: _MIN_CELL_SIZE });
    q.Insert(this._params.camera.position);
    const sides = q.GetChildren();

    let newChunks: Record<string, any> = {};
    const center     = new THREE.Vector3();
    const dimensions = new THREE.Vector3();

    for (let i = 0; i < sides.length; i++) {
      this._groups[i].matrix = sides[i].transform;
      this._groups[i].matrixAutoUpdate = false;

      for (const c of sides[i].children) {
        c.bounds.getCenter(center);
        c.bounds.getSize(dimensions);
        const child = {
          index: i,
          group: this._groups[i],
          position: [center.x, center.y, center.z] as [number, number, number],
          bounds: c.bounds,
          size: dimensions.x,
        };
        newChunks[this._Key(child)] = child;
      }
    }

    const intersection = utils.DictIntersection(
      this._chunks as Record<string, unknown>,
      newChunks  as Record<string, unknown>,
    ) as Record<string, any>;

    const difference = utils.DictDifference(
      newChunks  as Record<string, unknown>,
      this._chunks as Record<string, unknown>,
    ) as Record<string, any>;

    const recycle = Object.values(utils.DictDifference(
      this._chunks as Record<string, unknown>,
      newChunks  as Record<string, unknown>,
    )) as any[];

    this._batchOld.push(...recycle);
    newChunks = intersection;

    const diffKeys = Object.keys(difference);

    if (diffKeys.length === 0) {
      this._RecycleChunks(this._batchOld);
      this._batchOld = [];
      this._chunks = newChunks;
      return;
    }

    this._batchExpected = diffKeys.length;
    this._batchDone     = 0;
    this._batchNew      = [];

    for (const k of diffKeys) {
      const [xp, yp, zp] = difference[k].position as [number, number, number];
      const chunkRes = Math.max(16, Math.floor(_MIN_CELL_RESOLUTION * _MIN_CELL_SIZE / difference[k].size));

      const chunk = new TerrainChunk({
        group:    difference[k].group,
        material: this._getMaterial(chunkRes),
      });
      chunk.Hide();
      this._batchNew.push(chunk);

      newChunks[k] = { position: [xp, zp], chunk };

      const matrix = Array.from(difference[k].group.matrix.elements as Iterable<number>);

      this._pool.enqueue(
        { id: this._nextId++, matrix, ox: xp, oy: yp, oz: zp, width: difference[k].size, resolution: chunkRes, radius: _PLANET_RADIUS },
        (result) => {
          chunk.ApplyBuffers(result);
          this._batchDone++;
          if (this._batchDone >= this._batchExpected) {
            for (const c of this._batchNew) c.Show();
            this._RecycleChunks(this._batchOld);
            this._batchNew = [];
            this._batchOld = [];
            this._batchExpected = 0;
            this._batchDone     = 0;
          }
        },
      );
    }

    this._chunks = newChunks;
  }

  Update(displaySurfaceDist?: number) {
    const surfaceDist = displaySurfaceDist ?? (this._params.camera.position.length() - _PLANET_RADIUS);
    const baseSize = Math.max(0.04, surfaceDist * 0.003 * (1.25 / _LOD_MULTIPLIER));
    for (const [resolution, mat] of this._materials) {
      mat.size = Math.min(5, baseSize * (_MIN_CELL_RESOLUTION / resolution));
    }

    if (!this._pool.busy) {
      this._UpdateVisibleChunks();
    }
  }
}
