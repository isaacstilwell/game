'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function AsteroidLabCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.001, 1000);
    camera.position.set(0, 0, 25);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AxesHelper(2));

    let rafId: number;
    let disposed = false;
    let asteroidUpdate: ((pos: THREE.Vector3) => void) | null = null;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      if (asteroidUpdate) asteroidUpdate(camera.position);
      renderer.render(scene, camera);
    };

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    animate();

    import('@/game/asteroid/AsteroidBuilder').then(({ buildAsteroid }) => {
      return buildAsteroid(5267, 16);
    }).then(({ group, update }) => {
      if (disposed) return;
      group.position.set(0, 0, 0);
      scene.add(group);
      asteroidUpdate = update;
      setLoading(false);
    }).catch((err) => {
      console.error('Asteroid load error:', err);
      setError(String(err));
      setLoading(false);
    });

    return () => {
      disposed = true;
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
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: '1.2rem',
          pointerEvents: 'none',
        }}>
          Loading asteroid...
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#f00',
          fontFamily: 'monospace',
          fontSize: '1rem',
          maxWidth: '80vw',
          pointerEvents: 'none',
        }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}
