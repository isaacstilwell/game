'use client';

import MenuFrame from './MenuFrame';

interface Props {
  kills: number;
  onRetry: () => void;
}

const font = "'UAV-OSD-Sans-Mono', monospace";

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      width: 170, height: 76, flexShrink: 0,
      padding: '12px 10px',
      background: 'rgba(2,84,105,0.08)',
      border: '1px solid rgba(109,189,175,0.52)',
    }}>
      <div style={{ width: 3, height: 44, background: 'rgba(109,189,175,0.82)', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <p style={{ fontSize: 10, letterSpacing: '1.8px', color: 'rgba(109,189,175,0.48)', lineHeight: '13px' }}>{label}</p>
        <p style={{ fontSize: 24, letterSpacing: '3px', color: 'rgba(109,189,175,0.96)', lineHeight: '31px' }}>{value}</p>
      </div>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 9, lineHeight: '14px', height: 14,
      borderBottom: '1px solid rgba(109,189,175,0.1)',
    }}>
      <span style={{ color: 'rgba(109,189,175,0.52)', letterSpacing: '1.2px' }}>{label}</span>
      <span style={{ color: 'rgba(109,189,175,0.9)', letterSpacing: '1.5px', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

export default function DeathScreen({ kills, onRetry }: Props) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: font,
    }}>

      <MenuFrame>

        {/* Eyebrow — h:36, p:10, gap:14 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, height: 36,
          padding: 10,
          background: 'rgba(2,84,105,0.04)',
          border: '1px solid rgba(109,189,175,0.36)',
        }}>
          <div style={{ width: 3, alignSelf: 'stretch', background: 'rgba(109,189,175,0.9)', flexShrink: 0 }} />
          <p style={{ flex: 1, fontSize: 9, letterSpacing: '2px', color: 'rgba(109,189,175,0.48)', lineHeight: '13px' }}>
            MISSION FAILURE / WAVE 01
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', justifyContent: 'space-between', width: 3, flexShrink: 0 }}>
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
          </div>
        </div>

        {/* Title Main — h:81, px:10 */}
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
            HULL BREACH
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', justifyContent: 'space-between', padding: '10px 0', width: 3, flexShrink: 0 }}>
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
          </div>
        </div>

        {/* Subtitle — h:44, p:10 */}
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
            SHIP INTEGRITY REACHED ZERO.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', justifyContent: 'space-between', width: 3, flexShrink: 0 }}>
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
            <div style={{ width: 3, height: 6, background: 'rgba(109,189,175,0.75)' }} />
          </div>
        </div>

        {/* Rule — h:5 */}
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

        {/* Stat row — 16px gap from rule */}
        <div style={{ marginTop: 16, display: 'flex', gap: 22 }}>
          <StatBox label="HULL"     value="00" />
          <StatBox label="SHIELDS"  value="00" />
          <StatBox label="HOSTILES" value={`${kills.toString().padStart(2, '0')}/05`} />
        </div>

        {/* Wave report — 16px gap from stats */}
        <div style={{
          marginTop: 16,
          background: 'rgba(2,84,105,0.07)',
          border: '1px solid rgba(109,189,175,0.45)',
          padding: '20px 23px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <p style={{ fontSize: 10, letterSpacing: '2px', color: 'rgba(109,189,175,0.48)', lineHeight: '13px' }}>WAVE REPORT</p>
          <ReportRow label="HOSTILES ELIMINATED" value={`${kills.toString().padStart(2, '0')} / 05`} />
          <ReportRow label="HULL INTEGRITY"       value="00" />
          <ReportRow label="STATUS"               value="FAILED" />
        </div>

        {/* Try again button — 54px gap from report */}
        <button
          onClick={onRetry}
          style={{
            marginTop: 54,
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', height: 64, padding: 10,
            background: 'rgba(2,84,105,0.10)',
            border: '1px solid rgba(109,189,175,0.78)',
            cursor: 'pointer', fontFamily: font,
          }}
        >
          <div style={{ width: 3, alignSelf: 'stretch', background: 'rgba(109,189,175,0.95)', flexShrink: 0 }} />
          <span style={{ fontSize: 15, letterSpacing: '4px', color: '#6dbdaf', lineHeight: '19px' }}>TRY AGAIN</span>
        </button>

      </MenuFrame>
    </div>
  );
}
