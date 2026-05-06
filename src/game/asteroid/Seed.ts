import { Vector3 } from 'three';
import md5 from 'md5';

// Takes an asteroid seed as an argument and returns various seed types
class Seed {
  private seed: string;

  constructor(seed: string | number) {
    this.seed = String(seed).substring(2);
  }

  // Returns a seeded float with an offset
  getFloat(offset: number | string = 0): number {
    return this.get16Bit(offset) / 65536;
  }

  // Returns a seeded 8-bit number with an offset
  get8Bit(offset: number | string = 0): number {
    offset = this._normalizeOffset(offset, 62);
    return parseInt(this.seed.substring(offset, offset + 2), 16);
  }

  // Returns a seeded 16-bit number
  get16Bit(offset: number | string = 0): number {
    offset = this._normalizeOffset(offset, 60);
    return parseInt(this.seed.substring(offset, offset + 4), 16);
  }

  // Returns a seeded unit vector (scale it if required)
  getVector3(offset: number | string = 0): Vector3 {
    offset = this._normalizeOffset(offset, 56);
    const x = parseInt(this.seed.substring(offset, offset + 4), 16);
    const y = parseInt(this.seed.substring(offset + 4, offset + 8), 16);
    const z = parseInt(this.seed.substring(offset + 8, offset + 12), 16);
    const v = new Vector3(x, y, z);
    return v.setLength(1);
  }

  private _normalizeOffset(offset: number | string, length: number): number {
    if (typeof offset === 'string') {
      offset = parseInt(md5(offset), 16) % length;
    }

    if (offset > length) throw new Error('Offset exceeds seed length');
    return offset as number;
  }
}

export default Seed;
