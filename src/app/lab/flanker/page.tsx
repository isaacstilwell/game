'use client';

import dynamic from 'next/dynamic';

const ShipLabCanvas = dynamic(() => import('@/components/ShipLabCanvas'), { ssr: false });

export default function FlankerLabPage() {
  return (
    <div className="relative h-full w-full bg-black">
      <ShipLabCanvas type="flanker" />
      <div className="pointer-events-none absolute top-4 left-4 font-mono text-xs text-white/40">
        LAB / FLANKER
      </div>
    </div>
  );
}
