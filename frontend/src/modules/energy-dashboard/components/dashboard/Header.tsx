/// <reference types="react" />
import React from 'react';
import { Activity, Globe } from 'lucide-react';
import { useDashboardStore } from '../../lib/store';
import { t } from '../../lib/i18n';

export function Header() {
  const { lang, setLang, mode, setMode } = useDashboardStore();

  const modeBtn = (m: 'operator' | 'investor', label: string, activeColor: string) => {
    const isActive = mode === m;
    return (
      <button
        onClick={() => setMode(m)}
        style={{
          padding: '6px 16px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.3s',
          background: isActive ? activeColor : 'transparent',
          color: isActive ? (m === 'operator' ? '#34d399' : '#a78bfa') : '#94a3b8',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #34d399, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
            }}
          >
            <Activity size={20} color="#fff" />
          </div>
          <div
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 12,
              height: 12,
              background: '#34d399',
              borderRadius: '50%',
              border: '2px solid #0a0f1a',
              animation: 'pulse 2s infinite',
            }}
          />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            VoltarisOS
          </h1>
          <p style={{ fontSize: 11, color: '#64748b', margin: '-2px 0 0 0' }}>Intelligent Energy Management</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            padding: 2,
          }}
        >
          {modeBtn('operator', t('mode.operator', lang), 'rgba(16,185,129,0.15)')}
          {modeBtn('investor', t('mode.investor', lang), 'rgba(139,92,246,0.15)')}
        </div>
        <button
          onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: 12,
            color: '#94a3b8',
            cursor: 'pointer',
            fontWeight: 600,
            textTransform: 'uppercase',
            transition: 'all 0.2s',
          }}
        >
          <Globe size={14} />
          {lang}
        </button>
      </div>
    </div>
  );
}
