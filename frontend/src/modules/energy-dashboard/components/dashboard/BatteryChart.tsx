import React, { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
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

export function BatteryChart() {
  const { lang } = useDashboardStore();
  const data = useMemo(() => generateHourlyData(), []);

  return (
    <GlassCard title={t('chart.batteryStrategy', lang)} accentColor="blue" explainText={t('explain.batteryOptimal', lang)} noPadding>
      <div style={{ padding: '0 8px 12px', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="batteryBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="hour" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
            <YAxis yAxisId="battery" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
            <YAxis yAxisId="price" orientation="right" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit="€" />
            <RTooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconType="circle" iconSize={6} />
            <Bar yAxisId="battery" dataKey="batteryLevel" name={t('chart.battery', lang)} fill="url(#batteryBarGrad)" radius={[3, 3, 0, 0]} barSize={12} />
            <Line yAxisId="price" type="monotone" dataKey="spotPrice" name={t('chart.price', lang)} stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#f59e0b' }} strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
