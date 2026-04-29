'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { appendMainFrame, renderMainFrame } from '@/lib/frames';

interface Props {
  children: ReactNode;
  style?: CSSProperties;
}

const frameStyle: CSSProperties = {
  position: 'relative',
  width: 'min(660px, calc(100vw - 32px))',
  maxHeight: 'calc(100vh - 40px)',
  overflow: 'auto',
  padding: '48px 52px',
  background: 'rgba(2,84,105,0.06)',
  scrollbarWidth: 'none',
};

export default function MenuFrame({ children, style }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const initialRect = frame.getBoundingClientRect();
    let lastWidth = initialRect.width;
    let lastHeight = initialRect.height;
    let rafId = 0;

    appendMainFrame(frame);

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const { width, height } = frame.getBoundingClientRect();
        if (Math.abs(width - lastWidth) < 0.5 && Math.abs(height - lastHeight) < 0.5) return;

        lastWidth = width;
        lastHeight = height;
        renderMainFrame(frame);
      });
    });

    observer.observe(frame);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      frame.querySelector(':scope > svg')?.remove();
    };
  }, []);

  return (
    <div ref={frameRef} style={{ ...frameStyle, ...style }}>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
