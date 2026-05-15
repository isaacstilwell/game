import * as THREE from 'three';

const _FILL_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x000000 });

export interface WorkResult {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  fillPositions: Float32Array;
}

export class TerrainChunk {
  _params: { group: THREE.Group; material: THREE.PointsMaterial };
  private _geometry: THREE.BufferGeometry;
  _plane: THREE.Points;
  private _fillGeometry: THREE.BufferGeometry;
  private _fill: THREE.Mesh;
  private _destroyed = false;

  constructor(params: { group: THREE.Group; material: THREE.PointsMaterial }) {
    this._params = params;
    this._geometry = new THREE.BufferGeometry();
    this._plane = new THREE.Points(this._geometry, params.material);
    this._params.group.add(this._plane);
    this._fillGeometry = new THREE.BufferGeometry();
    this._fill = new THREE.Mesh(this._fillGeometry, _FILL_MATERIAL);
    this._params.group.add(this._fill);
  }

  ApplyBuffers({ positions, normals, uvs, indices, fillPositions }: WorkResult): void {
    if (this._destroyed) return;
    this._geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this._geometry.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    this._geometry.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    this._geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this._fillGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fillPositions, 3));
    this._fillGeometry.setIndex(new THREE.BufferAttribute(indices.slice(), 1));
  }

  Hide() {
    this._plane.visible = false;
    this._fill.visible = false;
  }

  Show() {
    this._plane.visible = true;
    this._fill.visible = true;
  }

  Destroy() {
    this._destroyed = true;
    this._params.group.remove(this._plane);
    this._geometry.dispose();
    this._params.group.remove(this._fill);
    this._fillGeometry.dispose();
  }
}
