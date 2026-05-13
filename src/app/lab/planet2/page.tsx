'use client';

import dynamic from 'next/dynamic';

const Planet2LabCanvas = dynamic(() => import('@/components/Planet2LabCanvas'), { ssr: false });

export default function Planet2LabPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Planet2LabCanvas />
    </div>
  );
}
