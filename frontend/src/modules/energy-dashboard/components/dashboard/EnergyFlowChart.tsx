import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useDashboardStore } from '../../lib/store';
import { t } from '../../lib/i18n';
import { generateHourlyData } from '../../lib/mock-data';
import { GlassCard } from './GlassCard';

const tooltipStyle = {
  background: 'rgba(17,24,39,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  fontSize: 11,
  color: '#e2e8f0',
};

export function EnergyFlowChart() {
  const { lang } = useDashboardStore();
  const data = useMemo(() => generateHourlyData(), []);

  return (
    <GlassCard title={t('chart.energyFlow', lang)} accentColor="emerald" explainText={t('explain.profitRise', lang)} noPadding>
      <div style={{ padding: '0 8px 12px', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="consumptionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="hour" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
            <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit=" kW" />
            <RTooltip contentStyle={tooltipStyle} itemStyle={{ padding: '2px 0' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconType="circle" iconSize={6} />
            <Area type="monotone" dataKey="solar" name={t('chart.solar', lang)} stroke="#f59e0b" strokeWidth={2} fill="url(#solarGrad)" dot={false} activeDot={{ r: 3, fill: '#f59e0b' }} />
            <Area type="monotone" dataKey="totalLoad" name={t('chart.load', lang)} stroke="#6366f1" strokeWidth={2} fill="url(#consumptionGrad)" dot={false} activeDot={{ r: 3, fill: '#6366f1' }} />
            <Area type="monotone" dataKey="gridImport" name={t('chart.grid', lang)} stroke="#ef4444" strokeWidth={1.5} fill="url(#gridGrad)" dot={false} activeDot={{ r: 3, fill: '#ef4444' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
