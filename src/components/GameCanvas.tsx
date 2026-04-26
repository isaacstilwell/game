'use client';

import { useEffect, useRef } from 'react';
import { GameScene } from '@/game/GameScene';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new GameScene(containerRef.current);

    return () => {
      scene.dispose();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
