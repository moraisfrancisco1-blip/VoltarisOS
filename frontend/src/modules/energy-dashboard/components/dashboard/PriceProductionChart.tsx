import React, { useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend, ReferenceLine,
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

export function PriceProductionChart() {
  const { lang } = useDashboardStore();
  const data = useMemo(() => generateHourlyData(), []);
  const avgPrice = data.reduce((s, d) => s + d.spotPrice, 0) / data.length;

  return (
    <GlassCard title={t('chart.priceVsProduction', lang)} accentColor="amber" explainText={t('explain.profitDrop', lang)} noPadding>
      <div style={{ padding: '0 8px 12px', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="profitGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="hour" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
            <YAxis yAxisId="production" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit=" kW" />
            <YAxis yAxisId="price" orientation="right" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit="€" />
            <RTooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconType="circle" iconSize={6} />
            <ReferenceLine yAxisId="price" y={avgPrice} stroke="rgba(245,158,11,0.3)" strokeDasharray="6 3" />
            <Area yAxisId="production" type="monotone" dataKey="solar" name={t('chart.solar', lang)} stroke="#f59e0b" strokeWidth={2} fill="url(#profitGrad2)" dot={false} />
            <Line yAxisId="price" type="monotone" dataKey="spotPrice" name={t('chart.price', lang)} stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
            <Line yAxisId="production" type="monotone" dataKey="profit" name={t('kpi.profit', lang)} stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#10b981' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
