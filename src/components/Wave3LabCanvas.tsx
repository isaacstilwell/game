'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Wave3LandingManager } from '@/game/Wave3LandingManager';
import { _PLANET_RADIUS } from '@/game/planet3/quadtree';

function getIsaacInfoViewMatrix(): THREE.Matrix4 {
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(250, -1500, 500);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam.matrixWorldInverse.clone();
}

export default function Wave3LabCanvas() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const restartRef    = useRef<(() => void) | null>(null);
  const [mode, setMode] = useState<'free' | 'player'>('free');

  const handleRestart = useCallback(() => restartRef.current?.(), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    // Freecam — orbits around world origin (the player marker).
    const freeCam = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 5000);
    freeCam.position.set(0, -40, 20);
    freeCam.lookAt(0, 0, 0);

    // Player cam — fixed at origin, view encoded in isaacInfoViewRoot.matrix.
    const playerCam = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 5000);
    playerCam.position.set(0, 0, 0);
    playerCam.updateMatrixWorld(true);

    const controls = new OrbitControls(freeCam, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const scene = new THREE.Scene();

    // Player marker: wireframe sphere at world origin.
    const markerGeo = new THREE.SphereGeometry(2, 8, 6);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
    const marker    = new THREE.Mesh(markerGeo, markerMat);
    scene.add(marker);

    const isaacInfoViewRoot = new THREE.Group();
    isaacInfoViewRoot.matrixAutoUpdate = false;
    isaacInfoViewRoot.matrixWorldNeedsUpdate = true;
    scene.add(isaacInfoViewRoot);

    const planetSystem = new THREE.Group();
    isaacInfoViewRoot.add(planetSystem);

    const terrainLodCamera = new THREE.PerspectiveCamera();
    terrainLodCamera.position.set(0, -(_PLANET_RADIUS + 60), 0);
    let terrainManager: import('@/game/planet3/terrain').TerrainChunkManager | null = null;
    import('@/game/planet3/terrain').then(({ TerrainChunkManager }) => {
      terrainManager = new TerrainChunkManager({ camera: terrainLodCamera, parent: planetSystem });
    });

    let wave3 = new Wave3LandingManager(planetSystem, 'medium');

    restartRef.current = () => {
      wave3.dispose();
      wave3 = new Wave3LandingManager(planetSystem, 'medium');
    };

    let freecamMode = true;

    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyG') {
        freecamMode = !freecamMode;
        controls.enabled = freecamMode;
        marker.visible  = freecamMode;
        setMode(freecamMode ? 'free' : 'player');
        return;
      }
      keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    const onResize = () => {
      const aspect = container.clientWidth / container.clientHeight;
      freeCam.aspect   = aspect;
      playerCam.aspect = aspect;
      freeCam.updateProjectionMatrix();
      playerCam.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    const panSpeed = 0.5;
    const panDir   = new THREE.Vector3();
    let rafId: number;

    const animate = () => {
      rafId = requestAnimationFrame(animate);

      // A/D strafes the player; in freecam mode WASD also pans the freecam.
      const strafeDir = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0)
                      - (keys.has('ArrowLeft')  || keys.has('KeyA') ? 1 : 0);
      wave3.tick(strafeDir);
      isaacInfoViewRoot.matrix.copy(wave3.getCameraMatrix());
      isaacInfoViewRoot.matrixWorldNeedsUpdate = true;

      if (freecamMode) {
        controls.update();
        panDir.set(0, 0, 0);
        if (keys.has('KeyA')) panDir.x -= 1;
        if (keys.has('KeyD')) panDir.x += 1;
        if (keys.has('KeyW')) panDir.z -= 1;
        if (keys.has('KeyS')) panDir.z += 1;
        if (panDir.lengthSq() > 0) {
          panDir.normalize().multiplyScalar(panSpeed);
          panDir.applyQuaternion(freeCam.quaternion);
          panDir.y = 0;
          freeCam.position.add(panDir);
          controls.target.add(panDir);
        }
      }

      if (terrainManager) {
        planetSystem.updateWorldMatrix(true, false);
        const lp = new THREE.Vector3();
        planetSystem.worldToLocal(lp);
        terrainLodCamera.position.copy(lp);
        terrainManager.Update(Math.max(0, lp.length() - _PLANET_RADIUS));
      }

      renderer.render(scene, freecamMode ? freeCam : playerCam);
    };
    animate();

    return () => {
      restartRef.current = null;
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      markerGeo.dispose();
      markerMat.dispose();
      wave3.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-3 left-3 font-mono text-xs text-white/40 pointer-events-none">
        {mode === 'free'
          ? 'FREECAM · WASD pan · drag orbit · scroll zoom · G = player view'
          : 'PLAYER VIEW · G = freecam'}
      </div>
      <button
        onClick={handleRestart}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-xs text-white/70 border border-white/20 bg-white/5 px-4 py-1.5 hover:bg-white/10 cursor-pointer tracking-widest"
      >
        RESTART
      </button>
    </div>
  );
}
