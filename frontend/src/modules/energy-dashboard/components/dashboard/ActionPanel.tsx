import React, { useState } from 'react';
import { BatteryCharging, Clock, Zap, Check, ChevronRight, Shield, Flame } from 'lucide-react';
import { Slider } from '../ui/Slider';
import { Switch } from '../ui/Switch';
import { useDashboardStore } from '../../lib/store';
import { t } from '../../lib/i18n';

const actions = [
  {
    id: 'charge',
    icon: BatteryCharging,
    labelKey: 'action.chargeBattery',
    descKey: 'action.chargeBatteryDesc',
    params: { minutes: 45, value: 3.20 },
    urgency: 'high' as const,
  },
  {
    id: 'avoid',
    icon: Clock,
    labelKey: 'action.avoidConsumption',
    descKey: 'action.avoidConsumptionDesc',
    params: { value: 2.15 },
    urgency: 'medium' as const,
  },
  {
    id: 'sell',
    icon: Zap,
    labelKey: 'action.sellExcess',
    descKey: 'action.sellExcessDesc',
    params: { kw: 4.2, value: 1.85 },
    urgency: 'low' as const,
  },
];

const urgencyBorders: Record<string, string> = {
  high: 'rgba(16,185,129,0.3)',
  medium: 'rgba(245,158,11,0.3)',
  low: 'rgba(59,130,246,0.3)',
};
const urgencyBg: Record<string, string> = {
  high: 'rgba(16,185,129,0.04)',
  medium: 'rgba(245,158,11,0.04)',
  low: 'rgba(59,130,246,0.04)',
};
const urgencyDots: Record<string, string> = {
  high: '#34d399',
  medium: '#fbbf24',
  low: '#60a5fa',
};

export function ActionPanel() {
  const { lang, riskLevel, setRiskLevel, autoExecute, setAutoExecute } = useDashboardStore();
  const [executed, setExecuted] = useState<Set<string>>(new Set());

  const handleExecute = (id: string) => {
    setExecuted((prev) => new Set(prev).add(id));
  };

  const riskLabel = riskLevel < 33 ? t('action.conservative', lang) : riskLevel > 66 ? t('action.aggressive', lang) : 'Balanced';
  const riskColor = riskLevel < 33 ? '#60a5fa' : riskLevel > 66 ? '#fb7185' : '#fbbf24';

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(17,24,39,0.8)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 96,
          background: 'linear-gradient(to bottom, rgba(16,185,129,0.06), transparent)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>{t('action.title', lang)}</h3>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {actions.map((action) => {
            const done = executed.has(action.id);
            return (
              <div
                key={action.id}
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  border: `1px solid ${done ? 'rgba(16,185,129,0.2)' : urgencyBorders[action.urgency]}`,
                  background: done ? 'rgba(16,185,129,0.06)' : urgencyBg[action.urgency],
                  padding: 14,
                  transition: 'all 0.3s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                    <div style={{ padding: 6, borderRadius: 8, background: done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)' }}>
                      {done ? <Check size={16} color="#34d399" /> : <action.icon size={16} color="#94a3b8" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: done ? '#34d399' : '#fff', margin: 0 }}>
                        {t(action.labelKey, lang)}
                      </p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0 0' }}>
                        {t(action.descKey, lang, action.params)}
                      </p>
                    </div>
                  </div>
                  {!done ? (
                    <button
                      onClick={() => handleExecute(action.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 8,
                        background: 'rgba(16,185,129,0.15)',
                        color: '#34d399',
                        fontSize: 11,
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'background 0.2s',
                      }}
                    >
                      <ChevronRight size={12} />
                      {t('action.execute', lang)}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: 'rgba(52,211,153,0.7)', fontWeight: 500, flexShrink: 0 }}>
                      {t('action.executed', lang)} ✓
                    </span>
                  )}
                </div>
                {!done && (
                  <div style={{ position: 'absolute', top: 14, right: 14, width: 6, height: 6, borderRadius: '50%', background: urgencyDots[action.urgency] }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Auto execute */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{t('action.autoExecute', lang)}</span>
          <Switch checked={autoExecute} onChange={setAutoExecute} />
        </div>

        {/* Risk slider */}
        <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{t('action.riskProfile', lang)}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: riskColor }}>{riskLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shield size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Slider value={riskLevel} onChange={setRiskLevel} min={0} max={100} step={1} />
            </div>
            <Flame size={14} color="#fb7185" style={{ flexShrink: 0 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
