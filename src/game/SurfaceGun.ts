import * as THREE from 'three';
import { computeHeight } from './planet3/computeHeight';
import {
  buildBaseGeometry, buildTurretGeometry, buildBaseFill, buildTurretFill,
  GUN_BASE_H, GUN_PITCH_MAX, GUN_PITCH_MIN,
} from './gunGeometry';

const R             = 350;
const GUN_FIRE_RATE = 200;
const GUN_SCALE     = 0.52;

const POINT_MAT = new THREE.PointsMaterial({ vertexColors: true, size: 0.10, sizeAttenuation: true });
const FILL_MAT  = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

export class SurfaceGun {
  readonly localPos: THREE.Vector3;
  readonly theta:    number;
  readonly fireOffset: number;
  alive = true;

  private group:        THREE.Group;
  private turretPivot:  THREE.Group;
  private turretPoints: THREE.Points;
  private turretFills:  THREE.Mesh[];
  private lastPitch        = 0;
  private currentPitchRaw  = 0;

  constructor(private planetSystem: THREE.Group, theta: number, gunX: number, fireOffset: number) {
    this.theta      = theta;
    this.fireOffset = fireOffset;

    // surface position
    const spherePt = new THREE.Vector3(gunX, -R * Math.cos(theta), R * Math.sin(theta));
    const normal   = spherePt.clone().normalize();
    const terrainH = Math.max(0, computeHeight(spherePt.x, spherePt.y, spherePt.z) || 0);
    this.localPos  = spherePt.clone().addScaledVector(normal, terrainH);

    // orientation: Y = surface normal, Z = toward player approach (lower theta)
    const yAxis = normal.clone();
    const zRaw  = new THREE.Vector3(0, -Math.sin(theta), -Math.cos(theta));
    const zAxis = zRaw.clone().addScaledVector(yAxis, -zRaw.dot(yAxis)).normalize();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();

    this.group = new THREE.Group();
    this.group.position.copy(this.localPos);
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    this.group.scale.setScalar(GUN_SCALE);
    planetSystem.add(this.group);

    // static base
    this.group.add(new THREE.Points(buildBaseGeometry(), POINT_MAT));
    buildBaseFill(FILL_MAT).forEach(m => this.group.add(m));

    // rotating turret — pivot at base/frustum seam
    this.turretPivot = new THREE.Group();
    this.turretPivot.position.set(0, GUN_BASE_H, 0);
    this.group.add(this.turretPivot);

    this.turretPoints = new THREE.Points(buildTurretGeometry(0), POINT_MAT);
    this.turretPivot.add(this.turretPoints);
    this.turretFills = buildTurretFill(0, FILL_MAT);
    this.turretFills.forEach(m => this.turretPivot.add(m));
  }

  // Call every frame before shouldFire. Updates turret aim toward camLocalPos.
  tickAim(camLocalPos: THREE.Vector3): void {
    if (!this.alive) return;

    // direction to camera in gun-local space
    const worldDir    = camLocalPos.clone().sub(this.localPos);
    const gunLocalDir = worldDir.applyQuaternion(this.group.quaternion.clone().conjugate());

    // horizontal yaw of turret
    this.turretPivot.rotation.y = Math.atan2(gunLocalDir.x, gunLocalDir.z);

    // vertical pitch (stored raw for fire-angle check)
    const horizDist = Math.sqrt(gunLocalDir.x * gunLocalDir.x + gunLocalDir.z * gunLocalDir.z);
    this.currentPitchRaw = Math.atan2(gunLocalDir.y, Math.max(horizDist, 0.001));
    const pitch = THREE.MathUtils.clamp(this.currentPitchRaw, GUN_PITCH_MIN, GUN_PITCH_MAX);

    if (Math.abs(pitch - this.lastPitch) > 0.001) {
      this.lastPitch = pitch;

      this.turretPoints.geometry.dispose();
      this.turretPoints.geometry = buildTurretGeometry(pitch);

      this.turretFills.forEach(m => { m.geometry.dispose(); this.turretPivot.remove(m); });
      this.turretFills = buildTurretFill(pitch, FILL_MAT);
      this.turretFills.forEach(m => this.turretPivot.add(m));
    }
  }

  // Returns true if the gun should fire this frame.
  // Only fires when the player is within the pitch tracking range.
  shouldFire(frame: number, playerTheta: number): boolean {
    return (
      this.alive &&
      this.theta >= playerTheta &&
      this.currentPitchRaw >= GUN_PITCH_MIN &&
      this.currentPitchRaw <= GUN_PITCH_MAX &&
      (frame + this.fireOffset) % GUN_FIRE_RATE === 0
    );
  }

  kill(): void {
    this.alive = false;
    this.turretPoints.geometry.dispose();
    this.turretFills.forEach(m => m.geometry.dispose());
    this.planetSystem.remove(this.group);
  }
}
