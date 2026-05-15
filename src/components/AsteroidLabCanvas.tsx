'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { spawnExplosion, type ExplosionHandle } from '@/game/labExplosion';

export default function AsteroidLabCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    let currentExplosion: ExplosionHandle | null = null;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      if (asteroidUpdate) asteroidUpdate(camera.position);
      if (currentExplosion && !currentExplosion.tick()) currentExplosion = null;
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

      actionsRef.current = {
        explode() {
          group.visible = false;
          currentExplosion?.dispose();
          currentExplosion = spawnExplosion(
            scene, new THREE.Vector3(0, 0, 0), { r: 0.85, g: 0.8, b: 0.7 },
          );
          setExploded(true);
        },
        reset() {
          currentExplosion?.dispose();
          currentExplosion = null;
          group.visible = true;
          setExploded(false);
        },
      };
    }).catch((err) => {
      console.error('Asteroid load error:', err);
      setError(String(err));
      setLoading(false);
    });

    return () => {
      disposed = true;
      actionsRef.current = null;
      currentExplosion?.dispose();
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
      {!loading && !error && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)' }}>
          {!exploded ? (
            <button
              onClick={() => actionsRef.current?.explode()}
              style={{
                fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)', padding: '6px 16px', cursor: 'pointer',
              }}
            >
              EXPLODE
            </button>
          ) : (
            <button
              onClick={() => actionsRef.current?.reset()}
              style={{
                fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)', padding: '6px 16px', cursor: 'pointer',
              }}
            >
              PUT BACK
            </button>
          )}
        </div>
      )}
    </div>
  );
}
