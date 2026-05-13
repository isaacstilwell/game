import * as THREE from 'three';

const _PLANET_RADIUS = 4000;
const _MIN_CELL_SIZE = 500;

class QuadTree {
  private _root: any;
  private _params: any;

  constructor(params: any) {
    const s = params.size;
    const b = new THREE.Box3(
      new THREE.Vector3(-s, -s, 0),
      new THREE.Vector3(s, s, 0),
    );
    this._root = {
      bounds: b,
      children: [],
      center: b.getCenter(new THREE.Vector3()),
      size: b.getSize(new THREE.Vector3()),
      root: true,
    };
    this._params = params;
    this._root.sphereCenter = this._root.center.clone();
    this._root.sphereCenter.applyMatrix4(this._params.localToWorld);
    this._root.sphereCenter.normalize();
    this._root.sphereCenter.multiplyScalar(this._params.size);
  }

  GetChildren() {
    const children: any[] = [];
    this._GetChildren(this._root, children);
    return children;
  }

  private _GetChildren(node: any, target: any[]) {
    if (node.children.length === 0) {
      target.push(node);
      return;
    }
    for (const c of node.children) {
      this._GetChildren(c, target);
    }
  }

  Insert(pos: THREE.Vector3) {
    this._Insert(this._root, pos);
  }

  private _Insert(child: any, pos: THREE.Vector3) {
    const distToChild = child.sphereCenter.distanceTo(pos);
    if (distToChild < child.size.x * 1.25 && child.size.x > this._params.min_node_size) {
      child.children = this._CreateChildren(child);
      for (const c of child.children) {
        this._Insert(c, pos);
      }
    }
  }

  private _CreateChildren(child: any) {
    const midpoint = child.bounds.getCenter(new THREE.Vector3());

    const b1 = new THREE.Box3(child.bounds.min, midpoint);
    const b2 = new THREE.Box3(
      new THREE.Vector3(midpoint.x, child.bounds.min.y, 0),
      new THREE.Vector3(child.bounds.max.x, midpoint.y, 0),
    );
    const b3 = new THREE.Box3(
      new THREE.Vector3(child.bounds.min.x, midpoint.y, 0),
      new THREE.Vector3(midpoint.x, child.bounds.max.y, 0),
    );
    const b4 = new THREE.Box3(midpoint, child.bounds.max);

    return [b1, b2, b3, b4].map((b) => {
      const node: any = {
        bounds: b,
        children: [],
        center: b.getCenter(new THREE.Vector3()),
        size: b.getSize(new THREE.Vector3()),
      };
      node.sphereCenter = node.center.clone();
      node.sphereCenter.applyMatrix4(this._params.localToWorld);
      node.sphereCenter.normalize();
      node.sphereCenter.multiplyScalar(this._params.size);
      return node;
    });
  }
}

export class CubeQuadTree {
  private _sides: any[];

  constructor(params: { radius: number; min_node_size: number }) {
    this._sides = [];
    const r = params.radius;

    const transforms: THREE.Matrix4[] = [];

    let m = new THREE.Matrix4();
    m.makeRotationX(-Math.PI / 2);
    m.premultiply(new THREE.Matrix4().makeTranslation(0, r, 0));
    transforms.push(m);

    m = new THREE.Matrix4();
    m.makeRotationX(Math.PI / 2);
    m.premultiply(new THREE.Matrix4().makeTranslation(0, -r, 0));
    transforms.push(m);

    m = new THREE.Matrix4();
    m.makeRotationY(Math.PI / 2);
    m.premultiply(new THREE.Matrix4().makeTranslation(r, 0, 0));
    transforms.push(m);

    m = new THREE.Matrix4();
    m.makeRotationY(-Math.PI / 2);
    m.premultiply(new THREE.Matrix4().makeTranslation(-r, 0, 0));
    transforms.push(m);

    m = new THREE.Matrix4();
    m.premultiply(new THREE.Matrix4().makeTranslation(0, 0, r));
    transforms.push(m);

    m = new THREE.Matrix4();
    m.makeRotationY(Math.PI);
    m.premultiply(new THREE.Matrix4().makeTranslation(0, 0, -r));
    transforms.push(m);

    for (const t of transforms) {
      this._sides.push({
        transform: t.clone(),
        quadtree: new QuadTree({
          size: r,
          min_node_size: params.min_node_size,
          localToWorld: t,
        }),
      });
    }
  }

  GetChildren() {
    return this._sides.map((s) => ({
      transform: s.transform,
      children: s.quadtree.GetChildren(),
    }));
  }

  Insert(pos: THREE.Vector3) {
    for (const s of this._sides) {
      s.quadtree.Insert(pos);
    }
  }
}

export { _PLANET_RADIUS, _MIN_CELL_SIZE };
