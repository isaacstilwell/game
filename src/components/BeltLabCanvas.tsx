'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const randRadius = () => {
  const r = Math.random();
  if (r < 0.90) return 1;                                   // 90%  → 1
  if (r < 0.995) return 2 + Math.floor(Math.random() * 2); // 9.5% → 2–3
  return 4 + Math.floor(Math.random() * 2);                 // 0.5% → 4–5
};
const REPLACEMENTS_PER_RING = 5;
const SLICE_CENTER  = (3 * Math.PI) / 2;
const SLICE_HALF    = Math.PI / 24; // ±7.5° = 15° total
const Z_SIGMA       = 2;
const BELT_INNER     = 550;
const BELT_OUTER     = 800;
const EXTENDED_OUTER = 750;  // corridor extends outward past belt outer edge
const APPROACH_SPEED = 0.08; // belt units/frame
const COMPLETION_Y   = -(BELT_INNER - 50); // -500, same as game completion threshold

function gaussianZ(): number {
  const u = Math.random(), v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * Z_SIGMA;
}

function angleDist(a: number, b: number): number {
  return Math.abs(((a - b + Math.PI) % (2 * Math.PI)) - Math.PI);
}

interface BeltPoint { x: number; y: number; z: number }

function generateBelt(scene: THREE.Scene): BeltPoint[] {
  const replacements: BeltPoint[] = [];

  // Ring-walker spans BELT_INNER → EXTENDED_OUTER.
  // Point-cloud geometry is only emitted for rings inside the actual belt (BELT_INNER ≤ r ≤ BELT_OUTER).
  // Replacement asteroid positions are collected across the full extended range.
  let radius = BELT_INNER;
  let radiusStep = 3;
  let stepVelocity = 0;
  const cfg = {
    momentumFactor: 0.5, baseVariance: 2.5, oscillationBias: 1.5,
    minStep: 1, maxStep: 100, baseDensity: 100,
  };

  const mat = new THREE.PointsMaterial({ color: 0xff2200, size: 1 });

  while (radius < EXTENDED_OUTER) {
    const reversalPull = -stepVelocity * cfg.oscillationBias;
    const randomChange = (Math.random() - 0.5) * cfg.baseVariance;
    const stepChange = stepVelocity * cfg.momentumFactor + reversalPull + randomChange;
    stepVelocity = stepChange;
    radiusStep += stepChange;
    radiusStep = Math.max(cfg.minStep, Math.min(cfg.maxStep, radiusStep));
    if (radiusStep === cfg.minStep || radiusStep === cfg.maxStep) stepVelocity *= -0.5;

    const density = Math.max(0.4, 1.0 + (radius - BELT_INNER) * 0.02);
    const pointCount = Math.floor(cfg.baseDensity * density);

    const sliceIndices: number[] = [];
    for (let i = 0; i < pointCount; i++) {
      if (angleDist((i / pointCount) * Math.PI * 2, SLICE_CENTER) <= SLICE_HALF) sliceIndices.push(i);
    }
    for (let k = sliceIndices.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [sliceIndices[k], sliceIndices[j]] = [sliceIndices[j], sliceIndices[k]];
    }
    const replacementSet = new Set(sliceIndices.slice(0, REPLACEMENTS_PER_RING));

    const inBelt = radius <= BELT_OUTER;
    const regularPositions = inBelt ? new Float32Array((pointCount - sliceIndices.length) * 3) : null;
    let pi = 0;

    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      const radialNoise = (Math.random() - 0.5) * 3.0;
      const effectiveRadius = radius + radialNoise;
      const x = Math.cos(angle) * effectiveRadius;
      const y = Math.sin(angle) * effectiveRadius;

      if (angleDist(angle, SLICE_CENTER) <= SLICE_HALF) {
        if (replacementSet.has(i)) replacements.push({ x, y, z: gaussianZ() });
        // else: in slice, not selected — omit entirely
      } else if (inBelt && regularPositions) {
        const z = (Math.random() - 0.5) * 2.5 * Math.exp(-Math.abs(radialNoise) * 5);
        regularPositions[pi * 3]     = x;
        regularPositions[pi * 3 + 1] = y;
        regularPositions[pi * 3 + 2] = z;
        pi++;
      }
    }

    if (inBelt && pi > 0 && regularPositions) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(regularPositions.slice(0, pi * 3), 3));
      scene.add(new THREE.Points(geo, mat));
    }

    radius += radiusStep;
  }

  const MIN_ASTEROIDS = 500;
  while (replacements.length < MIN_ASTEROIDS) {
    const angle = SLICE_CENTER - SLICE_HALF + Math.random() * SLICE_HALF * 2;
    const r = BELT_INNER + Math.random() * (EXTENDED_OUTER - BELT_INNER);
    replacements.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r, z: gaussianZ() });
  }

  return replacements;
}

export default function BeltLabCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('initializing...');
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 8000);
    camera.up.set(0, 0, 1); // Z-up — matches game virtual camera

    let beltY = -(EXTENDED_OUTER + 20); // start just outside the extended outer edge

    let rafId: number;
    let disposed = false;
    const asteroidGroups: THREE.Group[] = [];
    const asteroidUpdates: ((pos: THREE.Vector3) => void)[] = [];
    const asteroidVelocities: THREE.Vector3[] = [];
    const asteroidAngVels: THREE.Vector3[] = [];

    let frameCount = 0;
    let lastFpsTime = performance.now();

    const animate = () => {
      rafId = requestAnimationFrame(animate);

      beltY += APPROACH_SPEED;
      if (beltY > COMPLETION_Y) beltY = -(EXTENDED_OUTER + 20); // loop

      camera.position.set(0, beltY, 0);
      camera.lookAt(0, beltY + 200, 0);

      for (let i = 0; i < asteroidGroups.length; i++) {
        const g = asteroidGroups[i];
        g.position.addScaledVector(asteroidVelocities[i], 1);
        g.rotation.x += asteroidAngVels[i].x;
        g.rotation.y += asteroidAngVels[i].y;
        g.rotation.z += asteroidAngVels[i].z;
        const localCam = camera.position.clone().sub(g.position);
        asteroidUpdates[i](localCam);
      }

      renderer.render(scene, camera);

      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 500) {
        setFps(Math.round(frameCount * 1000 / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }
    };

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    animate();

    const replacements = generateBelt(scene);
    setStatus(`building ${replacements.length} asteroids...`);

    const buildAll = async () => {
      const { buildAsteroid } = await import('@/game/asteroid/AsteroidBuilder');
      if (disposed) return;
      const results = await Promise.all(
        replacements.map((_, i) => buildAsteroid(3000 + i, 16, randRadius())),
      );
      if (disposed) return;
      for (let i = 0; i < results.length; i++) {
        const { group, update } = results[i];
        const { x, y, z } = replacements[i];
        group.position.set(x, y, z);
        scene.add(group);
        asteroidGroups.push(group);
        asteroidUpdates.push(update);
        asteroidVelocities.push(new THREE.Vector3(
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.004,
        ));
        asteroidAngVels.push(new THREE.Vector3(
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008,
        ));
      }
      if (!disposed) setStatus(`${replacements.length} asteroids • belt`);
    };

    buildAll().catch(err => setStatus(`error: ${String(err)}`));

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={{
        position: 'absolute', top: 16, left: 16,
        color: '#fff', fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.4,
        pointerEvents: 'none',
      }}>
        LAB / BELT
      </div>
      <div style={{
        position: 'absolute', top: 16, right: 16,
        color: '#fff', fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.6,
        pointerEvents: 'none', textAlign: 'right',
      }}>
        <div>{status}</div>
        <div>{fps} fps</div>
      </div>
    </div>
  );
}
