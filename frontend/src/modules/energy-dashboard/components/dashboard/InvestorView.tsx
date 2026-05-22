import React, { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Shield, Target, Wallet, Receipt } from 'lucide-react';
import { useDashboardStore } from '../../lib/store';
import { t } from '../../lib/i18n';
import { generateMonthlyData, getRevenueBreakdown } from '../../lib/mock-data';
import { GlassCard } from './GlassCard';

const tooltipStyle = {
  background: 'rgba(17,24,39,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  fontSize: 11,
  color: '#e2e8f0',
};

export function InvestorView() {
  const { lang } = useDashboardStore();
  const monthlyData = useMemo(() => generateMonthlyData(), []);
  const revenueBreakdown = getRevenueBreakdown();

  const lastMonth = monthlyData[monthlyData.length - 1];
  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const totalCost = monthlyData.reduce((s, m) => s + m.cost, 0);
  const totalProfit = totalRevenue - totalCost;

  const kpis = [
    { icon: TrendingUp, label: t('inv.roi', lang), value: `${lastMonth.roi}%`, change: '+2.3%', color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
    { icon: Wallet, label: t('inv.totalRevenue', lang), value: `€${totalRevenue.toFixed(0)}`, change: '+18%', color: '#2dd4bf', bg: 'rgba(20,184,166,0.1)' },
    { icon: Receipt, label: t('inv.totalCost', lang), value: `€${totalCost.toFixed(0)}`, change: '-5%', color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
    { icon: Target, label: t('inv.netProfit', lang), value: `€${totalProfit.toFixed(0)}`, change: '+32%', color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
    { icon: Shield, label: t('inv.riskScore', lang), value: 'Low', change: 'Stable', color: '#a78bfa', bg: 'rgba(139,92,246,0.1)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Investor KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {kpis.map((kpi, i) => (
          <div
            key={i}
            style={{
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(17,24,39,0.6)',
              padding: 16,
              transition: 'all 0.3s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ padding: 6, borderRadius: 8, background: kpi.bg }}>
                <kpi.icon size={14} color={kpi.color} />
              </div>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{kpi.label}</span>
            </div>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace", margin: 0, letterSpacing: '-0.02em' }}>{kpi.value}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#34d399', margin: '2px 0 0 0' }}>{kpi.change}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Monthly Trend */}
        <GlassCard title={t('inv.monthlyTrend', lang)} accentColor="violet" explainText={lang === 'pt' ? 'Receita vs custo por mês.' : 'Revenue vs cost per month.'} noPadding>
          <div style={{ padding: '0 8px 12px', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit="€" />
                <RTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconType="circle" iconSize={6} />
                <Bar dataKey="revenue" name={lang === 'pt' ? 'Receita' : 'Revenue'} fill="url(#revenueGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="cost" name={lang === 'pt' ? 'Custo' : 'Cost'} fill="url(#costGrad)" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Revenue Breakdown */}
        <GlassCard title={t('inv.revenueBreakdown', lang)} accentColor="emerald" explainText={lang === 'pt' ? 'Divisão das fontes de receita.' : 'Revenue sources breakdown.'}>
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={revenueBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                  {revenueBreakdown.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <RTooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {revenueBreakdown.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.fill }} />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.name}</span>
                </div>
                <span style={{ fontSize: 11, color: '#fff', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{item.value}%</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Cumulative Return */}
      <GlassCard title={t('inv.cumulativeReturn', lang)} accentColor="emerald" explainText={lang === 'pt' ? 'Retorno acumulado ao longo do ano.' : 'Cumulative return over the year.'} noPadding>
        <div style={{ padding: '0 8px 12px', height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit="€" />
              <RTooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="cumulative" name={lang === 'pt' ? 'Retorno acumulado' : 'Cumulative return'} stroke="#10b981" strokeWidth={2.5} fill="url(#cumulativeGrad)" dot={false} activeDot={{ r: 4, fill: '#10b981', stroke: '#0a0f1a', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}
