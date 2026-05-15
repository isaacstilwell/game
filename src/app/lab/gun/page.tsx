'use client';

import dynamic from 'next/dynamic';

const GunLabCanvas = dynamic(() => import('@/components/GunLabCanvas'), { ssr: false });

export default function GunLabPage() {
  return (
    <div className="relative h-full w-full bg-black">
      <GunLabCanvas />
      <div className="pointer-events-none absolute top-4 left-4 font-mono text-xs text-white/40">
        LAB / GUN
      </div>
    </div>
  );
}
