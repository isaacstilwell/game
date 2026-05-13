'use client';

import dynamic from 'next/dynamic';

const PlanetLabCanvas = dynamic(() => import('@/components/PlanetLabCanvas'), { ssr: false });

export default function PlanetLabPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <PlanetLabCanvas />
    </div>
  );
}
