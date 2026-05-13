import * as THREE from 'three';
import { NoiseGenerator } from './noise';
import { CubeQuadTree, _PLANET_RADIUS, _MIN_CELL_SIZE } from './quadtree';
import { TerrainChunk } from './terrain-chunk';
import { utils } from './utils';

const _MIN_CELL_RESOLUTION = 128;

class HeightGenerator {
  private _generator: NoiseGenerator;

  constructor(generator: NoiseGenerator) {
    this._generator = generator;
  }

  Get(x: number, y: number, z: number): [number, number] {
    return [this._generator.Get(x, y, z), 1];
  }
}

const _MAX_HEIGHT = 800.0;

const _LOW_COLOR = new THREE.Color(0x000000);
const _MID_COLOR = new THREE.Color(0x515c63);
const _HIGH_COLOR = new THREE.Color(0xc0d0d8);

class TerrainColorizer {
  Get(_x: number, _y: number, z: number): THREE.Color {
    const h = Math.min(1, Math.max(0, z / _MAX_HEIGHT));
    if (h < 0.5) {
      return _LOW_COLOR.clone().lerp(_MID_COLOR, h * 2);
    }
    return _MID_COLOR.clone().lerp(_HIGH_COLOR, (h - 0.5) * 2);
  }
}

class TerrainChunkRebuilder {
  private _pool: Record<number, TerrainChunk[]> = {};
  private _active: Generator<undefined> | null = null;
  _queued: TerrainChunk[] = [];
  _old: any[] = [];
  private _new: TerrainChunk[] = [];

  constructor() {
    this._Reset();
  }

  AllocateChunk(params: any): TerrainChunk {
    const w = params.width;
    if (!(w in this._pool)) this._pool[w] = [];

    let c: TerrainChunk;
    if (this._pool[w].length > 0) {
      c = this._pool[w].pop()!;
      c._params = params;
    } else {
      c = new TerrainChunk(params);
    }

    c.Hide();
    this._queued.push(c);
    return c;
  }

  private _RecycleChunks(chunks: any[]) {
    for (const c of chunks) {
      if (!(c.chunk._params.width in this._pool)) {
        this._pool[c.chunk._params.width] = [];
      }
      c.chunk.Destroy();
    }
  }

  private _Reset() {
    this._active = null;
    this._queued = [];
    this._old = [];
    this._new = [];
  }

  get Busy() {
    return this._active !== null || this._queued.length > 0;
  }

  Update() {
    if (this._active) {
      const r = this._active.next();
      if (r.done) this._active = null;
    } else {
      const b = this._queued.pop();
      if (b) {
        this._active = b._Rebuild();
        this._new.push(b);
      }
    }

    if (this._active) return;

    if (!this._queued.length) {
      this._RecycleChunks(this._old);
      for (const b of this._new) {
        b.Show();
      }
      this._Reset();
    }
  }
}

export class TerrainChunkManager {
  private _params: { camera: THREE.Camera; scene: THREE.Scene };
  private _material: THREE.PointsMaterial;
  private _builder: TerrainChunkRebuilder;
  private _noise: NoiseGenerator;
  private _groups: THREE.Group[];
  private _chunks: Record<string, any>;

  constructor(params: { camera: THREE.Camera; scene: THREE.Scene }) {
    this._params = params;

    this._material = new THREE.PointsMaterial({
      vertexColors: true,
      size: 20,
      sizeAttenuation: true,
    });

    this._builder = new TerrainChunkRebuilder();

    this._noise = new NoiseGenerator({
      octaves: 7,
      persistence: 1.2,
      lacunarity: 2.0,
      exponentiation: 3.5,
      height: _MAX_HEIGHT,
      scale: 2000.0,
      seed: 1,
    });

    this._groups = [...new Array(6)].map(() => new THREE.Group());
    params.scene.add(...this._groups);

    this._chunks = {};
  }

  private _Key(c: any): string {
    return c.position[0] + '/' + c.position[1] + ' [' + c.size + ']' + ' [' + c.index + ']';
  }

  private _CreateTerrainChunk(group: THREE.Group, offset: THREE.Vector3, width: number, resolution: number): TerrainChunk {
    return this._builder.AllocateChunk({
      group,
      material: this._material,
      width,
      offset,
      radius: _PLANET_RADIUS,
      resolution,
      colourGenerator: new TerrainColorizer(),
      heightGenerators: [new HeightGenerator(this._noise)],
    });
  }

  private _UpdateVisibleChunks() {
    const q = new CubeQuadTree({
      radius: _PLANET_RADIUS,
      min_node_size: _MIN_CELL_SIZE,
    });
    q.Insert(this._params.camera.position);

    const sides = q.GetChildren();

    let newChunks: Record<string, any> = {};
    const center = new THREE.Vector3();
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
      newChunks as Record<string, unknown>,
    ) as Record<string, any>;

    const difference = utils.DictDifference(
      newChunks as Record<string, unknown>,
      this._chunks as Record<string, unknown>,
    ) as Record<string, any>;

    const recycle = Object.values(utils.DictDifference(
      this._chunks as Record<string, unknown>,
      newChunks as Record<string, unknown>,
    ));

    this._builder._old.push(...recycle);

    newChunks = intersection;

    for (const k in difference) {
      const [xp, yp, zp] = difference[k].position;
      const offset = new THREE.Vector3(xp, yp, zp);
      newChunks[k] = {
        position: [xp, zp],
        chunk: this._CreateTerrainChunk(difference[k].group, offset, difference[k].size, _MIN_CELL_RESOLUTION),
      };
    }

    this._chunks = newChunks;
  }

  Update() {
    // Scale world-space point size proportionally to camera-surface distance so
    // apparent pixel size stays roughly constant regardless of zoom level.
    const surfaceDist = this._params.camera.position.length() - _PLANET_RADIUS;
    this._material.size = Math.max(0.5, surfaceDist * 0.003);

    this._builder.Update();
    if (!this._builder.Busy) {
      this._UpdateVisibleChunks();
    }
  }
}
