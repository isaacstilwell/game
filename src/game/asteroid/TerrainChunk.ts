import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  LessDepth,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Points,
  PointsMaterial,
} from 'three';

import {
  applyDisplacementToGeometry,
  getCachedGeometryAttributes,
  transformStretch,
} from './TerrainChunkUtils';
import type { AsteroidConfigData } from './AsteroidConfig';

interface ChunkParams {
  group: any;
  minHeight: number;
  offset: any;
  radius: number;
  side: number;
  stitchingStrides: { N: number; S: number; E: number; W: number };
  width: number;
}

class TerrainChunk {
  _params: ChunkParams;
  _config: AsteroidConfigData;
  _materialOverrides: any;
  _resolution: number;
  _stretch: any;
  _geometry: BufferGeometry;
  _pointsGeometry: BufferGeometry;
  _material: MeshBasicMaterial;
  _plane: Mesh;
  _pointsMaterial: PointsMaterial;
  _points: Points;

  constructor(
    params: ChunkParams,
    config: AsteroidConfigData,
    { materialOverrides, resolution }: { materialOverrides?: any; resolution: number },
  ) {
    this._params = params;
    this._config = config;
    this._materialOverrides = materialOverrides;
    this._resolution = resolution;
    this._stretch = null;
    this.updateDerived();

    this._geometry = new BufferGeometry();
    this.initGeometry();

    this._pointsGeometry = new BufferGeometry();
    const attr = getCachedGeometryAttributes(this._resolution);
    // No index on the points geometry — THREE.Points uses drawArrays (one point per vertex).
    // Setting the triangle index would cause drawElements, duplicating inner vertices 6×
    // and edge vertices 3× which creates a visible density band at LOD seams.
    this._pointsGeometry.setAttribute('uv', new Float32BufferAttribute(attr.uvs, 2));
    this._pointsGeometry.attributes.uv.needsUpdate = true;

    this._material = new MeshBasicMaterial({ color: 0x000000, depthFunc: LessDepth });
    this._plane = new Mesh(this._geometry, this._material);

    const pointsMaterialProps: any = {
      color: 0x515c63,
      size: 0.05,
      sizeAttenuation: true,
      depthFunc: LessDepth,
    };
    if (this._materialOverrides) {
      const validPointsProps = ['color', 'map', 'size', 'sizeAttenuation', 'alphaMap', 'fog', 'transparent', 'opacity', 'depthFunc', 'depthTest', 'depthWrite'];
      Object.keys(this._materialOverrides).forEach((k) => {
        if (validPointsProps.includes(k)) pointsMaterialProps[k] = this._materialOverrides[k];
      });
    }
    this._pointsMaterial = new PointsMaterial(pointsMaterialProps);
    this._points = new Points(this._pointsGeometry, this._pointsMaterial);
  }

  isReusable(): boolean {
    return true;
  }

  updateDerived() {
    this._stretch = transformStretch(this._config.stretch, this._params.side);
  }

  reconfigure(newParams: ChunkParams) {
    this._params = newParams;
    this.updateDerived();
  }

  attachToGroup() {
    if (!this._materialOverrides?.hideFill) {
      this._params.group.add(this._plane);
    }
    this._params.group.add(this._points);
  }

  detachFromGroup() {
    this._params.group.remove(this._plane);
    this._params.group.remove(this._points);
  }

  dispose() {
    this.detachFromGroup();
    this._geometry.dispose();
    this._material.dispose();
    if (this._pointsMaterial.map) this._pointsMaterial.map.dispose();
    this._pointsMaterial.dispose();
    this._pointsGeometry.dispose();
  }

  hide() {
    this._plane.visible = false;
    this._points.visible = false;
  }

  show() {
    this._plane.visible = true;
    this._points.visible = true;
  }

  initGeometry() {
    const attr = getCachedGeometryAttributes(this._resolution);
    this._geometry.setIndex(new BufferAttribute(attr.indices, 1));
    this._geometry.setAttribute('uv', new Float32BufferAttribute(attr.uvs, 2));
    this._geometry.attributes.uv.needsUpdate = true;
  }

  updateGeometry(positions: Float32Array, normals: Float32Array) {
    this._geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this._geometry.attributes.position.needsUpdate = true;
    this._geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    this._geometry.attributes.normal.needsUpdate = true;
    this._geometry.computeBoundingSphere();

    this._pointsGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this._pointsGeometry.attributes.position.needsUpdate = true;
    this._pointsGeometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    this._pointsGeometry.attributes.normal.needsUpdate = true;
    this._pointsGeometry.computeBoundingSphere();
  }

  updateMaps(data: any) {
    const heightMap = data.heightBitmap.image
      ? data.heightBitmap
      : new CanvasTexture(data.heightBitmap, undefined, undefined, undefined, NearestFilter);
    applyDisplacementToGeometry(
      this._pointsGeometry,
      this._resolution,
      this._config.radius,
      this._stretch,
      {
        displacementMap: heightMap,
        displacementBias: -1 * this._config.radius * this._config.dispWeight,
        displacementScale: 2 * this._config.radius * this._config.dispWeight,
      }
    );
    const src = this._pointsGeometry.getAttribute('position').array as Float32Array;
    const inner = new Float32BufferAttribute(src.length, 3);
    for (let i = 0; i < src.length; i++) inner.array[i] = src[i] * 0.97;
    this._geometry.setAttribute('position', inner);
    this._geometry.attributes.position.needsUpdate = true;
    this._geometry.computeBoundingSphere();
  }
}

export default TerrainChunk;
