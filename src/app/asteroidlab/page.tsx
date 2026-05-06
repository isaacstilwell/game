'use client';
import dynamic from 'next/dynamic';

const AsteroidLabCanvas = dynamic(() => import('@/components/AsteroidLabCanvas'), { ssr: false });

export default function AsteroidLabPage() {
  return <AsteroidLabCanvas />;
}
