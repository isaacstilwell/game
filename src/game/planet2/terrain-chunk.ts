import * as THREE from 'three';

const _FILL_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x000000 });

export class TerrainChunk {
  _params: any;
  private _geometry: THREE.BufferGeometry;
  _plane: THREE.Points;
  private _fillGeometry: THREE.BufferGeometry;
  private _fill: THREE.Mesh;

  constructor(params: any) {
    this._params = params;

    this._geometry = new THREE.BufferGeometry();
    this._plane = new THREE.Points(this._geometry, params.material);
    this._params.group.add(this._plane);

    this._fillGeometry = new THREE.BufferGeometry();
    this._fill = new THREE.Mesh(this._fillGeometry, _FILL_MATERIAL);
    this._params.group.add(this._fill);
  }

  Destroy() {
    this._params.group.remove(this._plane);
    this._geometry.dispose();
    this._params.group.remove(this._fill);
    this._fillGeometry.dispose();
  }

  Hide() {
    this._plane.visible = false;
    this._fill.visible = false;
  }

  Show() {
    this._plane.visible = true;
    this._fill.visible = true;
  }

  private _GenerateHeight(v: THREE.Vector3): number {
    return this._params.heightGenerators[0].Get(v.x, v.y, v.z)[0];
  }

  *_Rebuild(): Generator<undefined> {
    const _D = new THREE.Vector3();
    const _P = new THREE.Vector3();
    const _H = new THREE.Vector3();
    const _W = new THREE.Vector3();

    const _N1 = new THREE.Vector3();
    const _N2 = new THREE.Vector3();
    const _N3 = new THREE.Vector3();
    const _D1 = new THREE.Vector3();
    const _D2 = new THREE.Vector3();
    const _N = new THREE.Vector3();

    const positions: number[] = [];
    const colors: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const localToWorld = this._params.group.matrix;
    const resolution = this._params.resolution;
    const radius = this._params.radius;
    const offset = this._params.offset;
    const width = this._params.width;
    const half = width / 2;

    for (let x = 0; x < resolution + 1; x++) {
      const xp = width * x / resolution;
      for (let y = 0; y < resolution + 1; y++) {
        const yp = width * y / resolution;

        _P.set(xp - half, yp - half, radius);
        _P.add(offset);
        _P.normalize();
        _D.copy(_P);
        _P.multiplyScalar(radius);
        _P.z -= radius;

        _W.copy(_P);
        _W.applyMatrix4(localToWorld);

        const height = this._GenerateHeight(_W);
        const color = this._params.colourGenerator.Get(_W.x, _W.y, height);

        _H.copy(_D);
        _H.multiplyScalar(height);
        _P.add(_H);

        positions.push(_P.x, _P.y, _P.z);
        colors.push(color.r, color.g, color.b);
        normals.push(_D.x, _D.y, _D.z);
        uvs.push(_P.x / 10, _P.y / 10);
      }
    }
    yield;

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        indices.push(
          i * (resolution + 1) + j,
          (i + 1) * (resolution + 1) + j + 1,
          i * (resolution + 1) + j + 1,
        );
        indices.push(
          (i + 1) * (resolution + 1) + j,
          (i + 1) * (resolution + 1) + j + 1,
          i * (resolution + 1) + j,
        );
      }
    }
    yield;

    for (let i = 0, n = indices.length; i < n; i += 3) {
      const i1 = indices[i] * 3;
      const i2 = indices[i + 1] * 3;
      const i3 = indices[i + 2] * 3;

      _N1.fromArray(positions, i1);
      _N2.fromArray(positions, i2);
      _N3.fromArray(positions, i3);

      _D1.subVectors(_N3, _N2);
      _D2.subVectors(_N1, _N2);
      _D1.cross(_D2);

      normals[i1] += _D1.x; normals[i2] += _D1.x; normals[i3] += _D1.x;
      normals[i1 + 1] += _D1.y; normals[i2 + 1] += _D1.y; normals[i3 + 1] += _D1.y;
      normals[i1 + 2] += _D1.z; normals[i2 + 2] += _D1.z; normals[i3 + 2] += _D1.z;
    }
    yield;

    for (let i = 0, n = normals.length; i < n; i += 3) {
      _N.fromArray(normals, i);
      _N.normalize();
      normals[i] = _N.x;
      normals[i + 1] = _N.y;
      normals[i + 2] = _N.z;
    }
    yield;

    this._geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this._geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this._geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    this._geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    this._geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

    // Fill mesh at 99% of each vertex's displaced height.
    // x and y scale directly; z needs the face-center offset factored out:
    //   local_z = D.z*(radius+height) - radius  →  fill_z = D.z*0.99*(radius+height) - radius
    //           = local_z*0.99 - 0.01*radius
    const fillPos = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      fillPos[i]     = positions[i]     * 0.995;
      fillPos[i + 1] = positions[i + 1] * 0.995;
      fillPos[i + 2] = positions[i + 2] * 0.995 - 0.005 * radius;
    }
    this._fillGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fillPos, 3));
    this._fillGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  }
}
