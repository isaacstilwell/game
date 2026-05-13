'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PLANET_RADIUS } from '@/game/PlanetBuilder';

export default function PlanetLabCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [distLabel, setDistLabel] = useState('');

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
      1e6,
    );
    camera.position.set(0, 0, PLANET_RADIUS * 3.5);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = PLANET_RADIUS * 1.05;
    controls.maxDistance = PLANET_RADIUS * 20;

    let rafId: number;
    let disposed = false;
    let planetUpdate: ((pos: THREE.Vector3) => void) | null = null;

    const frameCount = { value: 0 };

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();

      if (planetUpdate) {
        frameCount.value++;
        // Update LOD every 6 frames to avoid churning the chunk builder.
        if (frameCount.value % 6 === 0) {
          planetUpdate(camera.position);
          const dist = Math.round(camera.position.length() - PLANET_RADIUS);
          setDistLabel(`${dist} u above surface`);
        }
      }

      renderer.render(scene, camera);
    };

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    animate();

    import('@/game/PlanetBuilder').then(({ buildPlanet }) => buildPlanet(16))
      .then(({ group, update }) => {
        if (disposed) return;
        scene.add(group);
        planetUpdate = update;
        // Trigger first real LOD pass at actual camera position.
        update(camera.position);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Planet build error:', err);
        setError(String(err));
        setStatus('error');
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

      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        color: 'rgba(255,255,255,0.4)',
        fontFamily: 'monospace',
        fontSize: 12,
        pointerEvents: 'none',
        lineHeight: 1.6,
      }}>
        <div>LAB / PLANET</div>
        {distLabel && <div style={{ color: '#6dbdaf' }}>{distLabel}</div>}
      </div>

      {status === 'loading' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: '1.1rem',
          pointerEvents: 'none',
        }}>
          building planet...
        </div>
      )}

      {status === 'error' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#f66',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          maxWidth: '80vw',
          pointerEvents: 'none',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
