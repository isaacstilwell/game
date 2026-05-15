'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LANDING_THETA, buildLandingZone, updateLandingZone, type LandingZone } from '@/game/landingZone';

const PLANET_RADIUS = 350;
const EYE_HEIGHT = 7;
const MOVE_SPEED = 0.8;

const SURFACE_POS = new THREE.Vector3(0, PLANET_RADIUS + EYE_HEIGHT, 0);
const SURFACE_TARGET = new THREE.Vector3(87.5, PLANET_RADIUS - 8.75, 0);

// Canyon: centered at +Z pole; camera sits just outside the rim in the normal (+X) direction
const CANYON_CAM = new THREE.Vector3(25, -4, PLANET_RADIUS).normalize().multiplyScalar(PLANET_RADIUS + EYE_HEIGHT);
const CANYON_TARGET = new THREE.Vector3(15, 99, 335);

// Mountains: range centered at (0, 334, 104); camera pulled back in -Z to see the line of peaks
const MOUNT_CAM = new THREE.Vector3(0, 334, 44).normalize().multiplyScalar(PLANET_RADIUS + EYE_HEIGHT);
const MOUNT_TARGET = new THREE.Vector3(0, 334, 104);

// Hoodoo: single spire at (247.5, 247.5, 0); camera pulled back toward +Y pole to see it
const HOODOO_CAM = new THREE.Vector3(220, 265, 0).normalize().multiplyScalar(PLANET_RADIUS + EYE_HEIGHT);
const HOODOO_TARGET = new THREE.Vector3(247, 248, 0);

// Landing zone: theta=LANDING_THETA in YZ plane; camera at theta≈0.36 looking forward toward the zone
const LAND_SPHERE = new THREE.Vector3(0, -PLANET_RADIUS * Math.cos(LANDING_THETA), PLANET_RADIUS * Math.sin(LANDING_THETA));
const LAND_CAM    = new THREE.Vector3(0, -PLANET_RADIUS * Math.cos(0.36), PLANET_RADIUS * Math.sin(0.36))
                      .normalize().multiplyScalar(PLANET_RADIUS + EYE_HEIGHT + 4);
const LAND_TARGET = LAND_SPHERE.clone();

const LANDMARKS = {
  CANYON:       { cam: CANYON_CAM,  target: CANYON_TARGET  },
  MOUNTAINS:    { cam: MOUNT_CAM,   target: MOUNT_TARGET   },
  HOODOOS:      { cam: HOODOO_CAM,  target: HOODOO_TARGET  },
  LANDING_ZONE: { cam: LAND_CAM,    target: LAND_TARGET    },
} as const;

const ORBIT_POS = new THREE.Vector3(612.5, 612.5, 612.5);
const ORBIT_TARGET = new THREE.Vector3(0, 0, 0);

export default function Planet3LabCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const onSurfaceRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const lzRef = useRef<LandingZone | null>(null);
  const [onSurface, setOnSurface] = useState(false);

  const goToLandmark = (pos: THREE.Vector3, target: THREE.Vector3) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.copy(pos);
    camera.fov = 80;
    camera.updateProjectionMatrix();
    controls.target.copy(target);
    controls.minDistance = 5;
    controls.maxDistance = PLANET_RADIUS * 10;
    controls.update();
    onSurfaceRef.current = true;
    setOnSurface(true);
  };

  const goToSurface = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.copy(SURFACE_POS);
    camera.fov = 80;
    camera.updateProjectionMatrix();
    controls.target.copy(SURFACE_TARGET);
    controls.minDistance = 5;
    controls.maxDistance = PLANET_RADIUS * 10;
    controls.update();
    onSurfaceRef.current = true;
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
    onSurfaceRef.current = false;
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
      0.1,
      10000,
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

    let manager: import('@/game/planet3/terrain').TerrainChunkManager | null = null;

    const beltGroup = new THREE.Group();
    scene.add(beltGroup);
    import('@/game/AsteroidBelt').then(({ AsteroidBelt }) => {
      new AsteroidBelt(beltGroup);
    });

    // Landing zone — LOD-matched to quadtree, updated each frame
    lzRef.current = buildLandingZone(scene);

    // Reusable vectors for surface movement to avoid per-frame allocation
    const _fwd = new THREE.Vector3();
    const _up = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _delta = new THREE.Vector3();

    let rafId: number;
    const animate = () => {
      rafId = requestAnimationFrame(animate);

      if (onSurfaceRef.current && keysRef.current.size > 0) {
        // Radial up at camera position
        _up.copy(camera.position).normalize();
        // Camera forward projected onto the tangent plane
        camera.getWorldDirection(_fwd);
        _fwd.addScaledVector(_up, -_fwd.dot(_up)).normalize();
        // Right = tangent-forward × up (left-handed flip for correct strafe)
        _right.crossVectors(_fwd, _up);

        _delta.set(0, 0, 0);
        if (keysRef.current.has('w')) _delta.addScaledVector(_fwd, 1);
        if (keysRef.current.has('s')) _delta.addScaledVector(_fwd, -1);
        if (keysRef.current.has('a')) _delta.addScaledVector(_right, -1);
        if (keysRef.current.has('d')) _delta.addScaledVector(_right, 1);

        if (_delta.lengthSq() > 0) {
          _delta.normalize().multiplyScalar(MOVE_SPEED);
          controls.target.add(_delta);
          camera.position.add(_delta);
          camera.position.setLength(PLANET_RADIUS + EYE_HEIGHT);
        }
      }

      controls.update();
      manager?.Update();
      if (lzRef.current) {
        const distToCenter = camera.position.distanceTo(LAND_SPHERE);
        const surfaceDist  = Math.max(0, camera.position.length() - PLANET_RADIUS);
        updateLandingZone(lzRef.current, distToCenter, surfaceDist);
      }
      renderer.render(scene, camera);
    };
    animate();

    import('@/game/planet3/terrain').then(({ TerrainChunkManager }) => {
      manager = new TerrainChunkManager({ camera, parent: scene });
    });

    const WASD = new Set(['w', 'a', 's', 'd']);
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (WASD.has(k)) { e.preventDefault(); keysRef.current.add(k); }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    return () => {
      cameraRef.current = null;
      controlsRef.current = null;
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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
        LAB / PLANET3
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

      <div style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
      }}>
        {onSurface && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 11, pointerEvents: 'none' }}>
            WASD — MOVE
          </div>
        )}
        {(Object.keys(LANDMARKS) as Array<keyof typeof LANDMARKS>).map((label) => (
          <button
            key={label}
            onClick={() => goToLandmark(LANDMARKS[label].cam, LANDMARKS[label].target)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'monospace',
              fontSize: 11,
              padding: '5px 12px',
              cursor: 'pointer',
              letterSpacing: '0.08em',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
