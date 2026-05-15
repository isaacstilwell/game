'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  buildBaseGeometry, buildTurretGeometry, buildBaseFill, buildTurretFill,
  GUN_BASE_H, GUN_PITCH_MAX, GUN_PITCH_MIN,
} from '@/game/gunGeometry';
import { spawnExplosion, type ExplosionHandle } from '@/game/labExplosion';

export default function GunLabCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [exploded, setExploded] = useState(false);
  const actionsRef = useRef<{ explode: () => void; reset: () => void } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(-6, 5, 8);
    camera.lookAt(0, 2.0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AxesHelper(2));

    const pointMat = new THREE.PointsMaterial({ vertexColors: true, size: 0.1, sizeAttenuation: true });
    const fillMat  = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const objectGroup = new THREE.Group();
    scene.add(objectGroup);

    const baseGeo   = buildBaseGeometry();
    const baseFills = buildBaseFill(fillMat);
    objectGroup.add(new THREE.Points(baseGeo, pointMat));
    baseFills.forEach(m => objectGroup.add(m));

    const turretPivot = new THREE.Group();
    turretPivot.position.set(0, GUN_BASE_H, 0);
    objectGroup.add(turretPivot);

    const turretPoints = new THREE.Points(buildTurretGeometry(0), pointMat);
    turretPivot.add(turretPoints);

    let turretFills = buildTurretFill(0, fillMat);
    turretFills.forEach(m => turretPivot.add(m));

    let rafId: number;
    let lastPitch = 0;
    let currentExplosion: ExplosionHandle | null = null;

    actionsRef.current = {
      explode() {
        objectGroup.visible = false;
        currentExplosion?.dispose();
        currentExplosion = spawnExplosion(
          scene, new THREE.Vector3(0, GUN_BASE_H, 0), { r: 1, g: 0.15, b: 0 },
        );
        setExploded(true);
      },
      reset() {
        currentExplosion?.dispose();
        currentExplosion = null;
        objectGroup.visible = true;
        setExploded(false);
      },
    };

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();

      if (currentExplosion && !currentExplosion.tick()) currentExplosion = null;

      if (objectGroup.visible) {
        const dx = camera.position.x;
        const dy = camera.position.y - GUN_BASE_H;
        const dz = camera.position.z;
        const horizDist = Math.sqrt(dx * dx + dz * dz);

        turretPivot.rotation.y = Math.atan2(dx, dz);

        const pitch = THREE.MathUtils.clamp(
          Math.atan2(dy, Math.max(horizDist, 0.001)),
          GUN_PITCH_MIN,
          GUN_PITCH_MAX,
        );

        if (Math.abs(pitch - lastPitch) > 0.001) {
          lastPitch = pitch;
          turretPoints.geometry.dispose();
          turretPoints.geometry = buildTurretGeometry(pitch);
          turretFills.forEach(m => { m.geometry.dispose(); turretPivot.remove(m); });
          turretFills = buildTurretFill(pitch, fillMat);
          turretFills.forEach(m => turretPivot.add(m));
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      actionsRef.current = null;
      currentExplosion?.dispose();
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      baseGeo.dispose();
      turretPoints.geometry.dispose();
      pointMat.dispose();
      [...baseFills, ...turretFills].forEach(m => m.geometry.dispose());
      fillMat.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
        {!exploded ? (
          <button
            onClick={() => actionsRef.current?.explode()}
            className="font-mono text-xs text-white/70 border border-white/20 bg-white/5 px-4 py-1.5 hover:bg-white/10 cursor-pointer tracking-widest"
          >
            EXPLODE
          </button>
        ) : (
          <button
            onClick={() => actionsRef.current?.reset()}
            className="font-mono text-xs text-white/70 border border-white/20 bg-white/5 px-4 py-1.5 hover:bg-white/10 cursor-pointer tracking-widest"
          >
            PUT BACK
          </button>
        )}
      </div>
    </div>
  );
}
