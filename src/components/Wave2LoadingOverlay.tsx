'use client';

import { useEffect, useRef } from 'react';
import MenuFrame from './MenuFrame';

const font = "'UAV-OSD-Sans-Mono', monospace";

export default function Wave2LoadingOverlay() {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let progress = 0;
    let rafId = 0;

    const animate = () => {
      // Asymptotically approach 90% — never quite arrives, giving a natural "loading" feel
      progress += (0.9 - progress) * 0.012;
      if (fillRef.current) fillRef.current.style.width = `${progress * 100}%`;
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: font,
    }}>
      <MenuFrame>

        {/* Eyebrow */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, height: 36,
          padding: 10,
          background: 'rgba(2,84,105,0.04)',
          border: '1px solid rgba(109,189,175,0.36)',
        }}>
          <div style={{ width: 3, alignSelf: 'stretch', background: 'rgba(109,189,175,0.9)', flexShrink: 0 }} />
          <p style={{ flex: 1, fontSize: 9, letterSpacing: '2px', color: 'rgba(109,189,175,0.48)', lineHeight: '13px' }}>
            WAVE 02 / ASTEROID BELT
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', justifyContent: 'space-between', width: 3, flexShrink: 0 }}>
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
          </div>
        </div>

        {/* Title */}
        <div style={{
          marginTop: 13,
          display: 'flex', alignItems: 'center', gap: 10, height: 81,
          paddingLeft: 10, paddingRight: 10,
          background: 'rgba(2,84,105,0.08)',
          border: '1px solid rgba(109,189,175,0.62)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', justifyContent: 'space-between', padding: '10px 0', width: 3, flexShrink: 0 }}>
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.9)' }} />
            <div style={{ width: 3, height: 36, background: 'rgba(109,189,175,0.9)' }} />
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.9)' }} />
          </div>
          <p style={{ flex: 1, fontSize: 28, letterSpacing: '5px', color: '#6dbdaf', lineHeight: '44px' }}>
            ASTEROID BELT
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', justifyContent: 'space-between', padding: '10px 0', width: 3, flexShrink: 0 }}>
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
          </div>
        </div>

        {/* Subtitle */}
        <div style={{
          marginTop: 16,
          display: 'flex', alignItems: 'center', gap: 10, height: 44,
          padding: 10,
          background: 'rgba(2,84,105,0.05)',
          border: '1px solid rgba(109,189,175,0.42)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', justifyContent: 'space-between', width: 3, flexShrink: 0 }}>
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.9)' }} />
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.9)' }} />
          </div>
          <p style={{ flex: 1, fontSize: 11, letterSpacing: '1.6px', color: 'rgba(109,189,175,0.64)', lineHeight: '15px' }}>
            PLOTTING FLIGHT CORRIDOR — STAND BY
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', justifyContent: 'space-between', width: 3, flexShrink: 0 }}>
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
          </div>
        </div>

        {/* Rule */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 5 }}>
          <div style={{ position: 'relative', width: 88, height: 5 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 44, height: 5, background: 'rgba(109,189,175,0.82)' }} />
            <div style={{ position: 'absolute', left: 54, top: 0, width: 34, height: 5, border: '1px solid rgba(109,189,175,0.64)' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 22, height: 5, border: '1px solid rgba(109,189,175,0.64)' }} />
            <div style={{ width: 22, height: 5, background: 'rgba(109,189,175,0.82)' }} />
            <div style={{ width: 44, height: 5, background: 'rgba(109,189,175,0.82)' }} />
          </div>
        </div>

        {/* Loading bar panel */}
        <div style={{
          marginTop: 16,
          padding: '20px 23px',
          background: 'rgba(2,84,105,0.07)',
          border: '1px solid rgba(109,189,175,0.45)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <p style={{ fontSize: 9, letterSpacing: '2px', color: 'rgba(109,189,175,0.48)', lineHeight: '13px' }}>
            SCANNING SECTOR
          </p>
          {/* Track */}
          <div style={{
            width: '100%', height: 8,
            background: 'rgba(109,189,175,0.08)',
            border: '1px solid rgba(109,189,175,0.35)',
          }}>
            <div ref={fillRef} style={{
              height: '100%', width: '0%',
              background: 'rgba(109,189,175,0.85)',
            }} />
          </div>
        </div>

      </MenuFrame>
    </div>
  );
}
