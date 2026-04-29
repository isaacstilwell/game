'use client';

import { useEffect, useRef } from 'react';
import { GameScene } from '@/game/GameScene';

interface Props {
  onReady: (scene: GameScene) => void;
}

export default function GameCanvas({ onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep onReady in a ref so the effect dep array stays stable
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new GameScene(containerRef.current);
    onReadyRef.current(scene);
    return () => { scene.dispose(); };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
