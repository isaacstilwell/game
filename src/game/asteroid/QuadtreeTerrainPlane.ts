import { Box3, Vector3 } from 'three';
import constants from './constants';

const { CHUNK_SPLIT_DISTANCE } = constants;

// yR, y0, xR, x0
const directions = ['N', 'S', 'E', 'W'];

// each row describes the edges on each side
const edgeToEdgeMap: [number, string, boolean][][] = [
  [[5, 'N', true],  [4, 'N', false], [2, 'N', false], [3, 'N', true]],
  [[4, 'S', false], [5, 'S', true],  [2, 'S', true],  [3, 'S', false]],
  [[0, 'E', false], [1, 'E', true],  [5, 'W', false], [4, 'E', false]],
  [[0, 'W', true],  [1, 'W', false], [4, 'W', false], [5, 'E', false]],
  [[0, 'S', false], [1, 'N', false], [2, 'W', false], [3, 'E', false]],
  [[0, 'N', true],  [1, 'S', true],  [3, 'W', false], [2, 'E', false]],
];

interface QuadNode {
  side: number;
  bounds: Box3;
  key: string;
  children: QuadNode[];
  center: Vector3;
  size: Vector3;
  neighbors: { N: QuadNode | null; S: QuadNode | null; E: QuadNode | null; W: QuadNode | null };
  root?: boolean;
  sphereCenter?: Vector3;
  sphereCenterHeight?: number;
  unstretchedMin?: number;
  distanceToCamera?: number;
  stitchingStrides?: any;
  emissiveParams?: any;
  renderSig?: string;
}

interface QuadtreeTerrainPlaneParams {
  heightSamples: number[];
  localToWorld: any;
  minChunkSize: number;
  sampleResolution: number;
  side: number;
  size: number;
  worldStretch?: Vector3;
}

class QuadtreeTerrainPlane {
  localToWorld: any;
  rootSize: number;
  worldStretch: Vector3;
  heightSamples: number[];
  heightSampleResolution: number;
  minChunkSize: number;
  side: number;
  root: QuadNode;
  edges: { N: any[]; S: any[]; E: any[]; W: any[] };

  constructor({ heightSamples, localToWorld, minChunkSize, sampleResolution, side, size, worldStretch }: QuadtreeTerrainPlaneParams) {
    this.localToWorld = localToWorld;
    this.rootSize = size;
    this.worldStretch = worldStretch || new Vector3(1, 1, 1);
    this.heightSamples = heightSamples;
    this.heightSampleResolution = sampleResolution;
    this.minChunkSize = minChunkSize;
    this.side = side;

    const rootNode = new Box3(
      new Vector3(-1 * size, -1 * size, 0),
      new Vector3(size, size, 0),
    );

    const center = rootNode.getCenter(new Vector3());
    const boxSize = rootNode.getSize(new Vector3());
    this.root = {
      side,
      bounds: rootNode,
      key: `${side}`,
      children: [],
      center: center,
      size: boxSize,
      neighbors: { N: null, S: null, E: null, W: null },
      root: true
    };
    this.setSphereCenter(this.root);
    this.edges = { N: [], S: [], E: [], W: [] };
  }

  getChildren(): Record<string, QuadNode> {
    const children: Record<string, QuadNode> = {};
    this._getChildren(this.root, children);
    return children;
  }

  _getChildren(node: QuadNode, target: Record<string, QuadNode>) {
    if (node.children.length === 0) {
      target[node.key] = node;
      return;
    }

    for (const c of node.children) {
      this._getChildren(c, target);
    }
  }

  setCameraPosition(pos: Vector3) {
    this._setCameraPosition(this.root, pos);
    this.populateNeighbors();
  }

  _setCameraPosition(child: QuadNode, pos: Vector3) {
    child.distanceToCamera = child.sphereCenter!.distanceTo(pos);
    if (child.distanceToCamera < child.size.x * CHUNK_SPLIT_DISTANCE && child.size.x >= this.minChunkSize * 2) {
      child.children = this.generateChildren(child);

      for (const c of child.children) {
        this._setCameraPosition(c, pos);
      }
    } else {
      child.children = [];
    }
  }

  populateNeighbors() {
    this.root.neighbors = { N: null, S: null, E: null, W: null };
    this._populateNeighbors(this.root);
  }

  _populateNeighbors(parent: QuadNode) {
    if (parent.children && parent.children.length > 0) {
      parent.children.forEach((child, i) => {
        if (i === 0) {
          child.neighbors.N = parent.children[2];
          child.neighbors.S = this.getClosestNeighborChild(parent.neighbors.S, 2);
          child.neighbors.E = parent.children[1];
          child.neighbors.W = this.getClosestNeighborChild(parent.neighbors.W, 1);
        } else if (i === 1) {
          child.neighbors.N = parent.children[3];
          child.neighbors.S = this.getClosestNeighborChild(parent.neighbors.S, 3);
          child.neighbors.E = this.getClosestNeighborChild(parent.neighbors.E, 0);
          child.neighbors.W = parent.children[0];
        } else if (i === 2) {
          child.neighbors.N = this.getClosestNeighborChild(parent.neighbors.N, 0);
          child.neighbors.S = parent.children[0];
          child.neighbors.E = parent.children[3];
          child.neighbors.W = this.getClosestNeighborChild(parent.neighbors.W, 3);
        } else if (i === 3) {
          child.neighbors.N = this.getClosestNeighborChild(parent.neighbors.N, 1);
          child.neighbors.S = parent.children[1];
          child.neighbors.E = this.getClosestNeighborChild(parent.neighbors.E, 2);
          child.neighbors.W = parent.children[2];
        }
        this._populateNeighbors(child);
      });
    }
  }

  getClosestNeighborChild(neighborParentNode: QuadNode | null, neighborPos: number): QuadNode | null {
    if (neighborParentNode && neighborParentNode.children && neighborParentNode.children.length > 0) {
      return neighborParentNode.children[neighborPos];
    }
    return neighborParentNode;
  }

  populateNonsideNeighbors(allSides: any[]) {
    for (let i = 0; i < directions.length; i++) {
      const dir = directions[i] as 'N' | 'S' | 'E' | 'W';
      const [neighborSideIndex, neighborsEdgeIndex, flipBounds] = edgeToEdgeMap[this.side][i];
      const neighborChildren = (allSides[neighborSideIndex]?.quadtree?.edges || {})[neighborsEdgeIndex];

      this.edges[dir].forEach((child: any) => {
        const testCoord = (flipBounds ? -1 : 1) * child.chunk.center[i < 2 ? 'x' : 'y'];
        const childNeighbor = (neighborChildren || []).find(({ min, max }: any) => {
          return (testCoord > min && testCoord < max);
        });
        child.chunk.neighbors[dir] = (childNeighbor || {}).chunk;
      });
    }
  }

  populateEdges() {
    Object.keys(this.edges).forEach((dir) => { this.edges[dir as 'N' | 'S' | 'E' | 'W'] = []; });

    Object.values(this.getChildren()).forEach((child) => {
      Object.keys(child.neighbors).forEach((dir) => {
        if (!child.neighbors[dir as 'N' | 'S' | 'E' | 'W']) {
          const useCoord = (dir === 'N' || dir === 'S') ? 'x' : 'y';
          this.edges[dir as 'N' | 'S' | 'E' | 'W'].push({
            chunk: child,
            min: (child.bounds.min as any)[useCoord],
            max: (child.bounds.max as any)[useCoord],
          });
        }
      });
    });
  }

  getHeightMinMax(node: QuadNode): [number | null, number | null] {
    const mult = this.heightSampleResolution / (2 * this.rootSize);
    const xMin = Math.floor((this.rootSize + node.center.x - node.size.x / 2) * mult);
    const xMax = Math.max(xMin + 1, Math.floor((this.rootSize + node.center.x + node.size.x / 2) * mult));
    const yMin = Math.floor((this.rootSize + node.center.y - node.size.y / 2) * mult);
    const yMax = Math.max(yMin + 1, Math.floor((this.rootSize + node.center.y + node.size.y / 2) * mult));

    let minmax: [number | null, number | null] = [null, null];
    for (let x = xMin; x < xMax; x++) {
      for (let y = yMin; y < yMax; y++) {
        const cur = this.heightSamples[this.heightSampleResolution * y + x];
        if (minmax[0] === null || cur < minmax[0]) minmax[0] = cur;
        if (minmax[1] === null || cur > minmax[1]) minmax[1] = cur;
      }
    }
    return minmax;
  }

  setSphereCenter(node: QuadNode) {
    const [unstretchedMin] = this.getHeightMinMax(node);
    node.unstretchedMin = unstretchedMin as number;

    const sphereCenter = node.center.clone();
    sphereCenter.z = this.rootSize;
    sphereCenter.normalize();
    sphereCenter.setLength(node.unstretchedMin!);
    sphereCenter.applyMatrix4(this.localToWorld);
    sphereCenter.multiply(this.worldStretch);

    node.sphereCenter = sphereCenter;
    node.sphereCenterHeight = sphereCenter.length();
  }

  generateChildren(parent: QuadNode): QuadNode[] {
    const midpoint = parent.bounds.getCenter(new Vector3());
    return [
      {
        b: new Box3(parent.bounds.min, midpoint),
        orientation: 'SW',
      },
      {
        b: new Box3(
          new Vector3(midpoint.x, parent.bounds.min.y, 0),
          new Vector3(parent.bounds.max.x, midpoint.y, 0)
        ),
        orientation: 'SE',
      },
      {
        b: new Box3(
          new Vector3(parent.bounds.min.x, midpoint.y, 0),
          new Vector3(midpoint.x, parent.bounds.max.y, 0)
        ),
        orientation: 'NW',
      },
      {
        b: new Box3(midpoint, parent.bounds.max),
        orientation: 'NE',
      },
    ].map(({ b }, i) => {
      const node: QuadNode = {
        key: `${parent.key}.${i}`,
        side: this.side,
        bounds: b,
        children: [],
        center: b.getCenter(new Vector3()),
        size: b.getSize(new Vector3()),
        neighbors: { N: null, S: null, E: null, W: null },
      };
      this.setSphereCenter(node);
      return node;
    });
  }
}

export default QuadtreeTerrainPlane;
