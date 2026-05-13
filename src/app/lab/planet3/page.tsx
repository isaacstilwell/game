'use client';

import dynamic from 'next/dynamic';

const Planet3LabCanvas = dynamic(() => import('@/components/Planet3LabCanvas'), { ssr: false });

export default function Planet3LabPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Planet3LabCanvas />
    </div>
  );
}
