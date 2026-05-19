'use client';

import { useEffect, useRef } from 'react';
import { hudBridge } from '@/game/hudBridge';

const MAX_HP     = 100;
const MAX_SHIELD = 50;

export default function HUD() {
  const hpFillRef     = useRef<HTMLDivElement>(null);
  const hpValRef      = useRef<HTMLSpanElement>(null);
  const shFillRef     = useRef<HTMLDivElement>(null);
  const shValRef      = useRef<HTMLSpanElement>(null);
  const ammoFillRef   = useRef<HTMLDivElement>(null);
  const ammoValRef    = useRef<HTMLSpanElement>(null);
  const hostilesRef   = useRef<HTMLParagraphElement>(null);
  const alignWarnRef  = useRef<HTMLDivElement>(null);
  const crosshairRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const offHp = hudBridge.on('hp-update', ({ value }) => {
      if (hpFillRef.current)  hpFillRef.current.style.width = `${(value / MAX_HP) * 100}%`;
      if (hpValRef.current)   hpValRef.current.textContent  = String(value);
    });
    const offSh = hudBridge.on('shield-update', ({ value }) => {
      if (shFillRef.current)  shFillRef.current.style.width = `${(value / MAX_SHIELD) * 100}%`;
      if (shValRef.current)   shValRef.current.textContent  = String(value);
    });
    const offCt = hudBridge.on('kill-count', ({ value }) => {
      if (hostilesRef.current) hostilesRef.current.textContent = String(value).padStart(2, '0');
    });
    const offAm = hudBridge.on('ammo-update', ({ value }) => {
      if (ammoFillRef.current) ammoFillRef.current.style.width = `${value}%`;
      if (ammoValRef.current)  ammoValRef.current.textContent  = String(value);
    });
    const offAw = hudBridge.on('align-warning', ({ value }) => {
      if (alignWarnRef.current) alignWarnRef.current.style.display = value ? 'block' : 'none';
    });
    return () => { offHp(); offSh(); offCt(); offAm(); offAw(); };
  }, []);

  useEffect(() => {
    const previousCursor = document.body.style.cursor;
    let rafId = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    const render = (): void => {
      rafId = 0;
      if (!crosshairRef.current) return;
      crosshairRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    };

    const onPointerMove = (event: PointerEvent): void => {
      x = event.clientX;
      y = event.clientY;
      if (rafId === 0) rafId = requestAnimationFrame(render);
    };

    render();
    document.body.style.cursor = 'none';
    window.addEventListener('pointermove', onPointerMove);

    return () => {
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', onPointerMove);
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ fontFamily: "'UAV-OSD-Sans-Mono', monospace" }}
    >
      {/* Crosshair — bracket-style reticle */}
      <div ref={crosshairRef} className="absolute top-0 left-0">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
          stroke="rgba(109,189,175,0.85)" strokeWidth="1.5" strokeLinecap="square">
          {/* Corner brackets */}
          <path d="M0 10 L0 0 L10 0" />
          <path d="M38 0 L48 0 L48 10" />
          <path d="M48 38 L48 48 L38 48" />
          <path d="M10 48 L0 48 L0 38" />
          {/* Centre cross with gap */}
          <line x1="24" y1="17" x2="24" y2="21" />
          <line x1="24" y1="27" x2="24" y2="31" />
          <line x1="17" y1="24" x2="21" y2="24" />
          <line x1="27" y1="24" x2="31" y2="24" />
          {/* Centre dot */}
          <circle cx="24" cy="24" r="1.5" fill="rgba(109,189,175,0.85)" stroke="none" />
        </svg>
      </div>

      {/* HP Panel — bottom left */}
      <div
        className="absolute"
        style={{ left: 48, bottom: 64, width: 280, height: 64 }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(2,84,105,0.18)',
          border: '1px solid rgba(109,189,175,0.45)',
        }} />
        <p style={{
          position: 'absolute', left: 14, top: 10,
          fontSize: 8, letterSpacing: '2px',
          color: 'rgba(109,189,175,0.6)',
        }}>HULL INTEGRITY</p>

        {/* Track */}
        <div style={{
          position: 'absolute', left: 14, top: 28, width: 252, height: 8,
          background: 'rgba(109,189,175,0.1)',
          border: '1px solid rgba(109,189,175,0.35)',
        }} />
        {/* Fill */}
        <div ref={hpFillRef} style={{
          position: 'absolute', left: 14, top: 28, width: '100%', maxWidth: 252, height: 8,
          background: 'rgba(109,189,175,0.85)',
          transition: 'width 0.1s linear',
        }} />

        <div style={{ position: 'absolute', left: 14, top: 44, display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span ref={hpValRef} style={{ fontSize: 10, color: 'rgba(109,189,175,0.96)' }}>100</span>
          <span style={{ fontSize: 8, letterSpacing: '1px', color: 'rgba(109,189,175,0.45)' }}>/ {MAX_HP}</span>
        </div>
      </div>

      {/* Shield Panel — adjacent to HP */}
      <div
        className="absolute"
        style={{ left: 340, bottom: 64, width: 240, height: 64 }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(2,84,105,0.18)',
          border: '1px solid rgba(109,189,175,0.45)',
        }} />
        <p style={{
          position: 'absolute', left: 14, top: 10,
          fontSize: 8, letterSpacing: '2px',
          color: 'rgba(109,189,175,0.6)',
        }}>SHIELDS</p>

        <div style={{
          position: 'absolute', left: 14, top: 28, width: 212, height: 8,
          background: 'rgba(109,189,175,0.1)',
          border: '1px solid rgba(109,189,175,0.35)',
        }} />
        <div ref={shFillRef} style={{
          position: 'absolute', left: 14, top: 28, width: '100%', maxWidth: 212, height: 8,
          background: 'rgba(110,204,216,0.85)',
          transition: 'width 0.1s linear',
        }} />

        <div style={{ position: 'absolute', left: 14, top: 44, display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span ref={shValRef} style={{ fontSize: 10, color: 'rgba(109,189,175,0.96)' }}>50</span>
          <span style={{ fontSize: 8, letterSpacing: '1px', color: 'rgba(109,189,175,0.45)' }}>/ {MAX_SHIELD}</span>
        </div>
      </div>

      {/* Ammo Panel — bottom right */}
      <div
        className="absolute"
        style={{ right: 48, bottom: 64, width: 240, height: 64 }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(2,84,105,0.18)',
          border: '1px solid rgba(109,189,175,0.45)',
        }} />
        <p style={{
          position: 'absolute', left: 14, top: 10,
          fontSize: 8, letterSpacing: '2px',
          color: 'rgba(109,189,175,0.6)',
        }}>AMMO</p>

        <div style={{
          position: 'absolute', left: 14, top: 28, width: 212, height: 8,
          background: 'rgba(109,189,175,0.1)',
          border: '1px solid rgba(109,189,175,0.35)',
        }} />
        <div ref={ammoFillRef} style={{
          position: 'absolute', left: 14, top: 28, width: '100%', maxWidth: 212, height: 8,
          background: 'rgba(109,189,175,0.85)',
          transition: 'width 0.05s linear',
        }} />

        <div style={{ position: 'absolute', left: 14, top: 44, display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span ref={ammoValRef} style={{ fontSize: 10, color: 'rgba(109,189,175,0.96)' }}>100</span>
          <span style={{ fontSize: 8, letterSpacing: '1px', color: 'rgba(109,189,175,0.45)' }}>/ 100</span>
        </div>
      </div>

      {/* Align warning — top center, wave 3 only */}
      <div
        ref={alignWarnRef}
        className="absolute"
        style={{
          left: '50%', top: 24, transform: 'translateX(-50%)',
          display: 'none',
          padding: '6px 20px',
          background: 'rgba(60,0,0,0.55)',
          border: '1px solid rgba(255,60,60,0.6)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        <p style={{ fontSize: 8, letterSpacing: '3px', color: 'rgba(255,80,80,0.6)', marginBottom: 4 }}>WARNING</p>
        <p style={{ fontSize: 10, letterSpacing: '2px', color: 'rgba(255,80,80,0.96)' }}>ALIGN WITH LANDING ZONE</p>
      </div>

      {/* Eliminations — top right */}
      <div
        className="absolute"
        style={{ right: 48, top: 24, width: 160, height: 64 }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(2,84,105,0.18)',
          border: '1px solid rgba(109,189,175,0.45)',
        }} />
        <p style={{
          position: 'absolute', left: 0, right: 0, top: 10,
          fontSize: 8, letterSpacing: '2px', textAlign: 'center',
          color: 'rgba(109,189,175,0.6)',
        }}>ELIMINATIONS</p>
        <p ref={hostilesRef} style={{
          position: 'absolute', left: 0, right: 0, top: 24,
          fontSize: 26, letterSpacing: '6px', textAlign: 'center',
          color: 'rgba(109,189,175,0.96)',
        }}>00</p>
      </div>
    </div>
  );
}
