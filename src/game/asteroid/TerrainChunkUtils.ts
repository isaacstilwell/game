import {
  CanvasTexture,
  Float32BufferAttribute,
  Matrix4,
  NearestFilter,
  ShaderMaterial,
  Vector3,
} from 'three';

import { heightShader, heightShaderWithStitching } from './shaders';
import constants from './constants';
import TextureRenderer from './TextureRenderer';
import type { AsteroidConfigData } from './AsteroidConfig';

const { CHUNK_RESOLUTION, MIN_CHUNK_SIZE, OVERSAMPLE_CHUNK_TEXTURES } = constants;

export const cubeTransforms = [
  (new Matrix4()).makeRotationX(-Math.PI / 2), // +Y
  (new Matrix4()).makeRotationX(Math.PI / 2),  // -Y
  (new Matrix4()).makeRotationY(Math.PI / 2),  // +X
  (new Matrix4()).makeRotationY(-Math.PI / 2), // -X
  new Matrix4(),                               // +Z
  (new Matrix4()).makeRotationY(Math.PI),      // -Z
];

// set up texture renderer (ideally w/ offscreen canvas)
let _textureRenderer: TextureRenderer | undefined;
function getTextureRenderer(): TextureRenderer {
  if (!_textureRenderer) _textureRenderer = new TextureRenderer();
  return _textureRenderer;
}


export const getSamplingResolution = (radius: number, minChunkSize = MIN_CHUNK_SIZE): number => {
  const targetResolution = 2 * radius / minChunkSize;
  if (targetResolution === 1) return 1;
  if (targetResolution < 32) return 16;
  if (targetResolution < 64) return 32;
  if (targetResolution < 128) return 64;
  if (targetResolution < 256) return 128;
  if (targetResolution < 512) return 256;
  if (targetResolution < 1024) return 512;
  return 1024;
};

export function generateHeightMap(
  cubeTransform: Matrix4,
  chunkSize: number,
  chunkOffset: Vector3,
  chunkResolution: number,
  edgeStrides: { N: number; S: number; E: number; W: number },
  oversample: boolean,
  config: AsteroidConfigData,
  returnType = 'bitmap'
): any {
  // If maxExtraPasses is set, use it as a fixed value for all LOD levels so every chunk
  // evaluates the same octave count — prevents height mismatches at LOD boundaries.
  const fixed = config.maxExtraPasses;
  const extraPasses = fixed !== undefined ? fixed : getExtraPasses(chunkSize, chunkResolution);
  const extraPassesMax = fixed !== undefined ? fixed : getExtraPasses(getMinChunkSize(config.radius) / (2 * config.radius), chunkResolution) - 1;
  const material = new ShaderMaterial({
    fragmentShader: (edgeStrides.N === 1 && edgeStrides.S === 1 && edgeStrides.E === 1 && edgeStrides.W === 1)
      ? heightShader
      : heightShaderWithStitching,
    uniforms: {
      uChunkOffset: { type: 'v2', value: chunkOffset } as any,
      uChunkSize: { type: 'f', value: chunkSize } as any,
      uCraterCut: { type: 'f', value: config.craterCut } as any,
      uCraterFalloff: { type: 'f', value: config.craterFalloff } as any,
      uCraterPasses: { type: 'i', value: config.craterPasses } as any,
      uCraterPersist: { type: 'f', value: config.craterPersist } as any,
      uCraterSteep: { type: 'f', value: config.craterSteep } as any,
      uDispFreq: { type: 'f', value: config.dispFreq } as any,
      uDispPasses: { type: 'i', value: config.dispPasses } as any,
      uDispPersist: { type: 'f', value: config.dispPersist } as any,
      uDispWeight: { type: 'f', value: config.dispWeight } as any,
      uEdgeStrideN: { type: 'f', value: edgeStrides.N } as any,
      uEdgeStrideS: { type: 'f', value: edgeStrides.S } as any,
      uEdgeStrideE: { type: 'f', value: edgeStrides.E } as any,
      uEdgeStrideW: { type: 'f', value: edgeStrides.W } as any,
      uExtraPasses: { type: 'i', value: extraPasses } as any,
      uExtraPassesMax: { type: 'i', value: extraPassesMax } as any,
      uFeaturesFreq: { type: 'f', value: config.featuresFreq } as any,
      uFeaturesSharpness: { type: 'f', value: config.featuresSharpness } as any,
      uFineDispFraction: { type: 'f', value: config.fineDispFraction } as any,
      uLandscapeWidth: { type: 'f', value: 2 * config.radius } as any,
      uMaxCraterDepth: { type: 'f', value: config.radius * config.dispWeight * config.fineDispFraction } as any,
      uOversampling: { type: 'b', value: oversample } as any,
      uResolution: { type: 'f', value: chunkResolution } as any,
      uRidgeWeight: { type: 'f', value: config.ridgeWeight } as any,
      uRimVariation: { type: 'f', value: config.rimVariation } as any,
      uRimWeight: { type: 'f', value: config.rimWeight } as any,
      uRimWidth: { type: 'f', value: config.rimWidth } as any,
      uSeed: { type: 'v3', value: config.seed } as any,
      uStretch: { type: 'v3', value: config.stretch } as any,
      uTopoDetail: { type: 'i', value: config.topoDetail } as any,
      uTopoFreq: { type: 'f', value: config.topoFreq } as any,
      uTopoWeight: { type: 'f', value: config.topoWeight } as any,
      uTransform: { type: 'mat4', value: cubeTransform } as any,
    }
  });

  const textureRenderer = getTextureRenderer();

  if (returnType === 'texture') {
    return textureRenderer.render(chunkResolution, chunkResolution, material);
  }

  return textureRenderer.renderBitmap(chunkResolution, chunkResolution, material, { magFilter: NearestFilter });
}

export interface RebuildChunkGeometryParams {
  config: AsteroidConfigData;
  edgeStrides: { N: number; S: number; E: number; W: number };
  minHeight: number;
  offset: Vector3;
  resolution: number;
  stretch: Vector3;
  width: number;
}

export function rebuildChunkGeometry({ config, edgeStrides, minHeight, offset, resolution, stretch, width }: RebuildChunkGeometryParams): { positions: Float32Array; normals: Float32Array } {
  const radius = config.radius;
  const undisplacedHeight = minHeight;
  const resolutionPlusOne = resolution + 1;
  const half = width / 2;

  // "+ 1" to avoid seams from rounding differences and z-fighting
  const stitchingBias = 1;

  const _P = new Vector3();
  const _S = new Vector3();
  const positions = new Float32Array(resolutionPlusOne * resolutionPlusOne * 3);
  const normals = new Float32Array(resolutionPlusOne * resolutionPlusOne * 3);
  for (let x = 0; x < resolutionPlusOne; x++) {
    const xp = width * x / resolution - half;
    for (let y = 0; y < resolutionPlusOne; y++) {
      const yp = width * y / resolution - half;

      let midStride = false;
      const strideEW = (x === resolution && edgeStrides.E > 1) ? edgeStrides.E : (
        (x === 0 && edgeStrides.W > 1) ? edgeStrides.W : 1
      );
      const strideNS = (y === resolution && edgeStrides.N > 1) ? edgeStrides.N : (
        (y === 0 && edgeStrides.S > 1) ? edgeStrides.S : 1
      );

      // handle stitching on EW
      if (strideEW > 1) {
        const stride = strideEW;
        const strideMod = y % stride;
        if (strideMod > 0) {
          midStride = true;

          const strideMult = width * stride / resolution;
          _P.set(
            xp,
            Math.floor(y / stride) * strideMult - half,
            radius
          );
          _P.add(offset);
          _P.setLength(undisplacedHeight + stitchingBias);

          _S.set(
            xp,
            Math.ceil(y / stride) * strideMult - half,
            radius
          );
          _S.add(offset);
          _S.setLength(undisplacedHeight + stitchingBias);

          _P.lerp(_S, strideMod / stride);
        }
      } else if (strideNS > 1) {
        const stride = strideNS;
        const strideMod = x % stride;

        if (strideMod > 0) {
          midStride = true;

          const strideMult = width * stride / resolution;
          _P.set(
            Math.floor(x / stride) * strideMult - half,
            yp,
            radius
          );
          _P.add(offset);
          _P.setLength(undisplacedHeight + stitchingBias);

          _S.set(
            Math.ceil(x / stride) * strideMult - half,
            yp,
            radius
          );
          _S.add(offset);
          _S.setLength(undisplacedHeight + stitchingBias);

          _P.lerp(_S, strideMod / stride);
        }
      }

      // handle all other points
      if (!midStride) {
        _P.set(xp, yp, radius);
        _P.add(offset);
        _P.setLength(undisplacedHeight);
      }

      const outputIndex = 3 * (resolutionPlusOne * x + y);
      normals[outputIndex + 0] = _P.x;
      normals[outputIndex + 1] = _P.y;
      normals[outputIndex + 2] = _P.z;

      _P.multiply(stretch);
      positions[outputIndex + 0] = _P.x;
      positions[outputIndex + 1] = _P.y;
      positions[outputIndex + 2] = _P.z;
    }
  }

  return { normals, positions };
}

export function getMinChunkSize(radius: number): number {
  return MIN_CHUNK_SIZE / Math.max(1, 6 - Math.round(Math.log10(radius)));
}

export function getExtraPasses(chunkSize: number, resolution: number): number {
  return Math.ceil(Math.log2(1 / chunkSize) + (resolution / CHUNK_RESOLUTION) - 1);
}

export interface RebuildChunkMapsParams {
  config: AsteroidConfigData;
  edgeStrides: { N: number; S: number; E: number; W: number };
  groupMatrix: Matrix4;
  offset: Vector3;
  resolution: number;
  width: number;
  side?: number;
}

export function rebuildChunkMaps({ config, edgeStrides, groupMatrix, offset, resolution, width }: RebuildChunkMapsParams): any {
  const localToWorld = groupMatrix;
  const chunkSize = width / (2 * config.radius);
  const chunkOffset = offset.clone().multiplyScalar(1 / config.radius);

  const resolutionPlusOne = resolution + 1;
  const textureResolution = OVERSAMPLE_CHUNK_TEXTURES ? resolutionPlusOne + 2 : resolutionPlusOne;
  const textureSize = OVERSAMPLE_CHUNK_TEXTURES ? chunkSize * (1 + 2 / resolution) : chunkSize;

  const heightBitmap = generateHeightMap(
    localToWorld,
    textureSize,
    chunkOffset,
    textureResolution,
    edgeStrides,
    OVERSAMPLE_CHUNK_TEXTURES,
    config
  );

  return { heightBitmap };
}

export function applyDisplacementToGeometry(geometry: any, resolution: number, radius: number, stretch: Vector3, { displacementMap, displacementBias, displacementScale }: { displacementMap: any; displacementBias: number; displacementScale: number }): void {
  const resolutionPlusOne = resolution + 1;
  const positions = geometry.getAttribute('position').array;

  const displacementData = getTextureRenderer().textureToDataBuffer(displacementMap);
  if (!displacementData) return;

  const _P = new Vector3();
  const osAdd = OVERSAMPLE_CHUNK_TEXTURES ? 1 : 0;
  const osResolution = resolutionPlusOne + (OVERSAMPLE_CHUNK_TEXTURES ? 2 : 0);
  for (let x = 0; x < resolutionPlusOne; x++) {
    for (let y = 0; y < resolutionPlusOne; y++) {
      const positionIndex = 3 * (resolutionPlusOne * x + y);
      const textureIndex = 4 * (osResolution * (y + osAdd) + (x + osAdd));
      const displacementTextureValue = (displacementData[textureIndex + 0] + displacementData[textureIndex + 1] / 255) / 256;

      _P.set(
        positions[positionIndex + 0],
        positions[positionIndex + 1],
        positions[positionIndex + 2],
      );

      _P.divide(stretch);
      _P.setLength(radius + displacementTextureValue * displacementScale + displacementBias);
      _P.multiply(stretch);

      positions[positionIndex + 0] = _P.x;
      positions[positionIndex + 1] = _P.y;
      positions[positionIndex + 2] = _P.z;
    }
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.attributes.position.needsUpdate = true;
}

export function transformStretch(stretch: Vector3, side: number): Vector3 {
  if ([0, 1].includes(side)) {
    return new Vector3(stretch.x, stretch.z, stretch.y);
  } else if ([2, 3].includes(side)) {
    return new Vector3(stretch.z, stretch.y, stretch.x);
  }
  return stretch.clone();
}

const GEO_ATTR_CACHE: Record<number, { uvs: Float32Array; indices: Uint32Array }> = {};
export function getCachedGeometryAttributes(resolution: number): { uvs: Float32Array; indices: Uint32Array } {
  if (!GEO_ATTR_CACHE[resolution]) {
    const resolutionPlusOne = resolution + 1;

    const uvs = new Float32Array(resolutionPlusOne * resolutionPlusOne * 2);
    for (let x = 0; x < resolutionPlusOne; x++) {
      for (let y = 0; y < resolutionPlusOne; y++) {
        const outputIndex = (resolutionPlusOne * x + y) * 2;
        if (OVERSAMPLE_CHUNK_TEXTURES) {
          uvs[outputIndex + 0] = (x + 1.5) / (resolutionPlusOne + 2);
          uvs[outputIndex + 1] = (y + 1.5) / (resolutionPlusOne + 2);
        } else {
          uvs[outputIndex + 0] = (x + 0.5) / resolutionPlusOne;
          uvs[outputIndex + 1] = (y + 0.5) / resolutionPlusOne;
        }
      }
    }

    const indices = new Uint32Array(resolution * resolution * 3 * 2);
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const outputIndex = (resolution * i + j) * 6;
        indices[outputIndex + 0] = i * resolutionPlusOne + j;
        indices[outputIndex + 1] = (i + 1) * resolutionPlusOne + j + 1;
        indices[outputIndex + 2] = i * resolutionPlusOne + j + 1;
        indices[outputIndex + 3] = (i + 1) * resolutionPlusOne + j;
        indices[outputIndex + 4] = (i + 1) * resolutionPlusOne + j + 1;
        indices[outputIndex + 5] = i * resolutionPlusOne + j;
      }
    }

    GEO_ATTR_CACHE[resolution] = { uvs, indices };
  }
  return GEO_ATTR_CACHE[resolution];
}
