import React from 'react';
import { Sun, Plug, Battery, TrendingUp, Gauge, Car, DollarSign, Percent } from 'lucide-react';
import { useDashboardStore } from '../../lib/store';
import { t } from '../../lib/i18n';
import { getDailySummary } from '../../lib/mock-data';
import { ExplainTooltip } from './ExplainTooltip';

export function KPICards() {
  const { lang } = useDashboardStore();
  const data = getDailySummary();

  const kpis = [
    { icon: Sun, label: t('kpi.solarProduction', lang), value: `${data.solarProduction}`, unit: 'kWh', change: '+12%', positive: true, color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', explain: t('explain.profitRise', lang) },
    { icon: Plug, label: t('kpi.gridConsumption', lang), value: `${data.gridConsumption}`, unit: 'kWh', change: '-8%', positive: true, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', explain: t('explain.batteryOptimal', lang) },
    { icon: Battery, label: t('kpi.batteryLevel', lang), value: `${data.batteryLevel}`, unit: '%', change: '+5%', positive: true, color: '#34d399', bg: 'rgba(16,185,129,0.1)', explain: t('explain.batteryOptimal', lang) },
    { icon: TrendingUp, label: t('kpi.profit', lang), value: `€${data.profit}`, unit: '', change: '+23%', positive: true, color: '#34d399', bg: 'rgba(16,185,129,0.1)', explain: t('explain.profitRise', lang) },
    { icon: Gauge, label: t('kpi.totalLoad', lang), value: `${data.totalLoad}`, unit: 'kWh', change: '+3%', positive: false, color: '#fb7185', bg: 'rgba(244,63,94,0.1)', explain: t('explain.peakWarning', lang) },
    { icon: Car, label: t('kpi.evCharging', lang), value: `${data.evCharging}`, unit: 'kWh', change: '0%', positive: true, color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', explain: t('explain.batteryOptimal', lang) },
    { icon: DollarSign, label: t('kpi.spotPrice', lang), value: `€${data.spotPrice}`, unit: '/kWh', change: '-15%', positive: true, color: '#2dd4bf', bg: 'rgba(20,184,166,0.1)', explain: t('explain.profitRise', lang) },
    { icon: Percent, label: t('kpi.selfConsumption', lang), value: `${data.selfConsumption}`, unit: '%', change: '+4%', positive: true, color: '#34d399', bg: 'rgba(16,185,129,0.1)', explain: t('explain.profitRise', lang) },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {kpis.map((kpi, i) => (
        <div
          key={i}
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(17,24,39,0.6)',
            padding: '14px 16px',
            transition: 'all 0.3s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ padding: 6, borderRadius: 8, background: kpi.bg }}>
              <kpi.icon size={14} color={kpi.color} />
            </div>
            <ExplainTooltip text={kpi.explain} />
          </div>
          <p style={{ fontSize: 11, color: '#64748b', fontWeight: 500, margin: '0 0 2px 0' }}>{kpi.label}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }}>
              {kpi.value}
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>{kpi.unit}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: kpi.positive ? '#34d399' : '#fb7185' }}>
            {kpi.change}
          </div>
        </div>
      ))}
    </div>
  );
}
