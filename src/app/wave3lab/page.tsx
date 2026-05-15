'use client';
import dynamic from 'next/dynamic';

const Wave3LabCanvas = dynamic(() => import('@/components/Wave3LabCanvas'), { ssr: false });

export default function Wave3LabPage() {
  return <Wave3LabCanvas />;
}
