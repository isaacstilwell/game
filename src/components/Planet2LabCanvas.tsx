'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const PLANET_RADIUS = 4000;
const EYE_HEIGHT = 80;

// At the +Y pole the sphere normal is (0,1,0), matching THREE's default camera up.
// Position camera above surface and look along the surface toward +X.
const SURFACE_POS = new THREE.Vector3(0, PLANET_RADIUS + EYE_HEIGHT, 0);
const SURFACE_TARGET = new THREE.Vector3(1000, PLANET_RADIUS - 100, 0);

const ORBIT_POS = new THREE.Vector3(7000, 7000, 7000);
const ORBIT_TARGET = new THREE.Vector3(0, 0, 0);

export default function Planet2LabCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [onSurface, setOnSurface] = useState(false);

  const goToSurface = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.copy(SURFACE_POS);
    camera.fov = 80;
    camera.updateProjectionMatrix();
    controls.target.copy(SURFACE_TARGET);
    controls.minDistance = 50;
    controls.maxDistance = PLANET_RADIUS * 10;
    controls.update();
    setOnSurface(true);
  };

  const goToOrbit = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.copy(ORBIT_POS);
    camera.fov = 60;
    camera.updateProjectionMatrix();
    controls.target.copy(ORBIT_TARGET);
    controls.minDistance = PLANET_RADIUS * 1.05;
    controls.maxDistance = PLANET_RADIUS * 10;
    controls.update();
    setOnSurface(false);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      1,
      100000,
    );
    camera.position.copy(ORBIT_POS);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const light1 = new THREE.DirectionalLight(0xFFFFFF, 1);
    light1.position.set(-100, 100, -100);
    scene.add(light1);
    const light2 = new THREE.DirectionalLight(0x404040, 1);
    light2.position.set(100, 100, -100);
    scene.add(light2);
    const light3 = new THREE.DirectionalLight(0x404040, 1);
    light3.position.set(100, -100, 100);
    scene.add(light3);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = PLANET_RADIUS * 1.05;
    controls.maxDistance = PLANET_RADIUS * 10;
    controlsRef.current = controls;

    let manager: import('@/game/planet2/terrain').TerrainChunkManager | null = null;

    let rafId: number;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      manager?.Update();
      renderer.render(scene, camera);
    };
    animate();

    import('@/game/planet2/terrain').then(({ TerrainChunkManager }) => {
      manager = new TerrainChunkManager({ camera, scene });
    });

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cameraRef.current = null;
      controlsRef.current = null;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        color: 'rgba(255,255,255,0.4)',
        fontFamily: 'monospace',
        fontSize: 12,
        pointerEvents: 'none',
      }}>
        LAB / PLANET2
      </div>

      <button
        onClick={onSurface ? goToOrbit : goToSurface}
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.7)',
          fontFamily: 'monospace',
          fontSize: 12,
          padding: '8px 20px',
          cursor: 'pointer',
          letterSpacing: '0.08em',
        }}
      >
        {onSurface ? 'ORBIT VIEW' : 'SURFACE VIEW'}
      </button>
    </div>
  );
}
