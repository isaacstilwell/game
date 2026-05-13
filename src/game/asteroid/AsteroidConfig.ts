import { Vector3 } from 'three';
import Seed from './Seed';
import constants from './constants';

export interface AsteroidConfigData {
  craterCut: number;
  craterFalloff: number;
  craterPasses: number;
  craterPersist: number;
  craterSteep: number;
  dispFreq: number;
  dispPasses: number;
  dispPersist: number;
  dispWeight: number;
  featuresFreq: number;
  featuresSharpness: number;
  fineDispFraction: number;
  maxExtraPasses?: number;
  radius: number;
  ridgeWeight: number;
  rimVariation: number;
  rimWeight: number;
  rimWidth: number;
  seed: Vector3;
  stretch: Vector3;
  topoDetail: number;
  topoFreq: number;
  topoWeight: number;
}

const getSeed = async (asteroidId: number): Promise<string> => {
  const data = new TextEncoder().encode('influence' + asteroidId.toString());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const types = [1, 2, 3, 4, 5, 7, 9];

// Responsible for generating a config for any asteroid to be generated
class Config {
  private seedGen: Seed;
  private type: number;
  private radius: number;

  constructor(id: number, seedGen: Seed, radius = 5) {
    this.seedGen = seedGen;
    this.type = types[Math.floor(Math.random() * types.length)];
    this.radius = radius;
  }

  // Returns a modifier based on the radius raise to a power (optional)
  private _radiusMod(pow = 1): number {
    return Math.pow(this.radius / constants.MAX_ASTEROID_RADIUS, pow);
  }

  // Returns the radius of a sphere, which if stretched into an ellipsoid by
  // _stretch, would have the same surface area as the nominal radius
  private _adjustedRadius(): number {
    const stretch = this._stretch();
    return Math.floor(
      this.radius / Math.pow(
        (Math.pow(stretch.x * stretch.y, 1.6) + Math.pow(stretch.x * stretch.z, 1.6) + Math.pow(stretch.y * stretch.z, 1.6)) / 3,
        1 / 3.2
      )
    );
  }

  private _craterCut(): number {
    return 0.15 + 0.20 * this._radiusMod(0.5);
  }

  private _craterFalloff(): number {
    return 1.5 + 0.5 * this.seedGen.getFloat('craterFalloff');
  }

  private _craterPasses(): number {
    return 5;
  }

  private _craterPersist(): number {
    return 0.50 - 0.25 * this._radiusMod(2);
  }

  private _craterSteep(): number {
    return 6.0 - 2.0 * this._radiusMod(2);
  }

  private _dispFreq(): number {
    return 0.4 + 0.2 * this.seedGen.getFloat('dispFreq');
  }

  private _dispPasses(): number {
    return 4 + 2 * this._radiusMod(0.5);
  }

  private _dispPersist(): number {
    return 0.45 - 0.20 * this._radiusMod(0.5);
  }

  private _dispWeightCoarse(): number {
    return (0.275 + this.seedGen.getFloat('dispWeight') / 10) * (1.05 - this._radiusMod());
  }

  private _dispWeightFine(): number {
    return 0.225 - 0.100 * this._radiusMod();
  }

  private _featuresFreq(): number {
    return 0.5 * this._radiusMod(2) + 2.0;
  }

  private _featuresSharpness(): number {
    const sharpness: Record<number, number> = {
      1: 1.00,
      2: 0.90,
      3: 1.00,
      4: 0.95,
      5: 0.90,
      6: 0.95,
      7: 0.90,
      8: 0.80,
      9: 1.00,
      10: 0.75,
      11: 1.00,
    };
    return sharpness[this.type];
  }

  private _ridgeWeight(): number {
    return 0.75 + 0.5 * this.seedGen.getFloat('ridgeWeight');
  }

  private _rimVariation(): number {
    return 0.0075 + 0.005 * this.seedGen.getFloat('rimVariation');
  }

  private _rimWeight(): number {
    return 0.03 - 0.01 * this._radiusMod(2);
  }

  private _rimWidth(): number {
    return 0.2;
  }

  private _seed(): Vector3 {
    return this.seedGen.getVector3();
  }

  private _stretch(): Vector3 {
    const mod = 0.45 * (1 - this._radiusMod(2));
    return new Vector3(1, 1, 1).sub(this.seedGen.getVector3().multiplyScalar(mod));
  }

  private _topoDetail(): number {
    return 5;
  }

  private _topoFreq(): number {
    return 1.0 + this.seedGen.getFloat('topoFreq');
  }

  private _topoWeight(): number {
    return 0.4 - 0.1 * this._radiusMod(2) - 0.1 * this.seedGen.getFloat('topoWeight');
  }

  toConfigData(): AsteroidConfigData {
    const dispWeightCoarse = this._dispWeightCoarse();
    const dispWeightFine = this._dispWeightFine();
    return {
      craterCut: this._craterCut(),
      craterFalloff: this._craterFalloff(),
      craterPasses: this._craterPasses(),
      craterPersist: this._craterPersist(),
      craterSteep: this._craterSteep(),
      dispFreq: this._dispFreq(),
      dispPasses: this._dispPasses(),
      dispPersist: this._dispPersist(),
      dispWeight: dispWeightCoarse + dispWeightFine,
      featuresFreq: this._featuresFreq(),
      featuresSharpness: this._featuresSharpness(),
      fineDispFraction: dispWeightFine / (dispWeightCoarse + dispWeightFine),
      radius: this._adjustedRadius(),
      ridgeWeight: this._ridgeWeight(),
      rimVariation: this._rimVariation(),
      rimWeight: this._rimWeight(),
      rimWidth: this._rimWidth(),
      seed: this._seed(),
      stretch: this._stretch(),
      topoDetail: this._topoDetail(),
      topoFreq: this._topoFreq(),
      topoWeight: this._topoWeight(),
    };
  }

  static async create(id: number, radius = 5): Promise<AsteroidConfigData> {
    const seedGen = new Seed(await getSeed(id));
    const inst = new Config(id, seedGen, radius);
    return inst.toConfigData();
  }
}

export default Config;
