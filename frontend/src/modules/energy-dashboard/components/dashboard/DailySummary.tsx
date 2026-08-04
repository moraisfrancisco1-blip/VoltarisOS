import React from 'react';
import { Zap, Leaf, Brain, Sun } from 'lucide-react';
import { useDashboardStore } from '../../lib/store';
import { t } from '../../lib/i18n';
import { getDailySummary } from '../../lib/mock-data';

export function DailySummary() {
  const { lang } = useDashboardStore();
  const data = getDailySummary();

  const items = [
    { icon: Zap, label: t('daily.saved', lang), value: `€${data.savedToday}`, iconColor: '#6ee7b7', bg: 'rgba(16,185,129,0.1)' },
    { icon: Leaf, label: t('daily.co2', lang), value: `${data.co2Avoided} kg`, iconColor: '#5eead4', bg: 'rgba(20,184,166,0.1)' },
    { icon: Brain, label: t('daily.decisions', lang), value: `${data.autoDecisions}`, iconColor: '#c4b5fd', bg: 'rgba(139,92,246,0.1)' },
    { icon: Sun, label: t('daily.selfSufficiency', lang), value: `${data.selfSufficiency}%`, iconColor: '#fcd34d', bg: 'rgba(245,158,11,0.1)' },
  ];

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(to right, #0d1f17, #0f1729, #0d1320)',
        padding: '20px 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, borderRadius: 12, background: item.bg }}>
                <item.icon size={20} color={item.iconColor} />
              </div>
              <div>
                <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 500, margin: 0 }}>
                  {item.label}
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace", margin: 0, letterSpacing: '-0.02em' }}>
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 12, color: '#34d399', fontWeight: 500 }}>Live</span>
        </div>
      </div>
    </div>
  );
}
