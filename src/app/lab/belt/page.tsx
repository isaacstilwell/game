'use client';

import dynamic from 'next/dynamic';

const BeltLabCanvas = dynamic(() => import('@/components/BeltLabCanvas'), { ssr: false });

export default function BeltLabPage() {
  return (
    <div className="relative h-full w-full bg-black">
      <BeltLabCanvas />
    </div>
  );
}
