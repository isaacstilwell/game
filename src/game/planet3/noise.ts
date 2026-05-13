import { noise3 } from './perlin';

interface NoiseParams {
  octaves: number;
  persistence: number;
  lacunarity: number;
  exponentiation: number;
  height: number;
  scale: number;
  seed: number;
}

export class NoiseGenerator {
  private _params: NoiseParams;

  constructor(params: NoiseParams) {
    this._params = params;
  }

  Get(x: number, y: number, z: number): number {
    const G = 2.0 ** (-this._params.persistence);
    // offset coordinates by seed to differentiate generators
    const seedOff = this._params.seed * 31337;
    const xs = (x + seedOff) / this._params.scale;
    const ys = (y + seedOff) / this._params.scale;
    const zs = (z + seedOff) / this._params.scale;

    let amplitude = 1.0;
    let frequency = 1.0;
    let normalization = 0;
    let total = 0;

    for (let o = 0; o < this._params.octaves; o++) {
      const noiseValue = noise3(xs * frequency, ys * frequency, zs * frequency);
      total += noiseValue * amplitude;
      normalization += amplitude;
      amplitude *= G;
      frequency *= this._params.lacunarity;
    }

    total /= normalization;
    return Math.pow(total, this._params.exponentiation) * this._params.height;
  }
}
