'use client';

import dynamic from 'next/dynamic';

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false });

export default function GamePage() {
  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <GameCanvas />
    </div>
  );
}
