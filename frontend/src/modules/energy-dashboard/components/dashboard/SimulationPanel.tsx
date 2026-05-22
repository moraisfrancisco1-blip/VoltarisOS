import React, { useMemo } from 'react';
import { Battery, Home, Sun, Calculator, ArrowRight } from 'lucide-react';
import { Slider } from '../ui/Slider';
import { useDashboardStore } from '../../lib/store';
import { t } from '../../lib/i18n';
import { calculateSimulation } from '../../lib/mock-data';
import { GlassCard } from './GlassCard';

export function SimulationPanel() {
  const { lang, batteryCapacity, setBatteryCapacity, consumptionProfile, setConsumptionProfile, solarPanels, setSolarPanels } = useDashboardStore();

  const sim = useMemo(
    () => calculateSimulation(batteryCapacity, consumptionProfile, solarPanels),
    [batteryCapacity, consumptionProfile, solarPanels]
  );

  return (
    <GlassCard
      title={t('sim.title', lang)}
      accentColor="violet"
      explainText={lang === 'pt' ? 'Arrasta os sliders para simular cenários e ver o impacto financeiro em tempo real.' : 'Drag the sliders to simulate scenarios and see the real-time financial impact.'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SliderRow icon={<Battery size={16} color="#34d399" />} label={t('sim.batteryCapacity', lang)} value={batteryCapacity} onChange={setBatteryCapacity} min={0} max={50} unit="kWh" />
          <SliderRow icon={<Home size={16} color="#60a5fa" />} label={t('sim.consumptionProfile', lang)} value={consumptionProfile} onChange={setConsumptionProfile} min={0} max={100} unit="%" />
          <SliderRow icon={<Sun size={16} color="#fbbf24" />} label={t('sim.solarPanels', lang)} value={solarPanels} onChange={setSolarPanels} min={0} max={40} unit="panels" />
        </div>

        {/* Results */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <ResultCard label={t('sim.monthlyReturn', lang)} value={`€${sim.monthlyReturn}`} color="#34d399" bgColor="rgba(16,185,129,0.06)" borderColor="rgba(16,185,129,0.1)" />
          <ResultCard label={t('sim.yearlyReturn', lang)} value={`€${sim.yearlyReturn}`} color="#34d399" bgColor="rgba(16,185,129,0.06)" borderColor="rgba(16,185,129,0.1)" />
          <ResultCard
            label={t('sim.payback', lang)}
            value={`${sim.paybackYears} ${t('sim.years', lang)}`}
            color={sim.paybackYears <= 7 ? '#34d399' : sim.paybackYears <= 12 ? '#fbbf24' : '#fb7185'}
            bgColor={sim.paybackYears <= 7 ? 'rgba(16,185,129,0.06)' : sim.paybackYears <= 12 ? 'rgba(245,158,11,0.06)' : 'rgba(244,63,94,0.06)'}
            borderColor={sim.paybackYears <= 7 ? 'rgba(16,185,129,0.1)' : sim.paybackYears <= 12 ? 'rgba(245,158,11,0.1)' : 'rgba(244,63,94,0.1)'}
          />
        </div>

        {/* Investment summary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <Calculator size={14} color="#64748b" />
          <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>
            {lang === 'pt' ? 'Investimento total' : 'Total investment'}:{' '}
            <span style={{ color: '#fff', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>€{sim.totalInvestment.toLocaleString()}</span>
          </span>
          <ArrowRight size={12} color="#475569" />
          <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>
            {sim.selfUseRatio}% {lang === 'pt' ? 'autoconsumo' : 'self-use'}
          </span>
        </div>
      </div>
    </GlassCard>
  );
}

function SliderRow({ icon, label, value, onChange, min, max, unit }: {
  icon: React.ReactNode; label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
          {value} <span style={{ color: '#64748b', fontWeight: 400 }}>{unit}</span>
        </span>
      </div>
      <Slider value={value} onChange={onChange} min={min} max={max} step={1} />
    </div>
  );
}

function ResultCard({ label, value, color, bgColor, borderColor }: {
  label: string; value: string; color: string; bgColor: string; borderColor: string;
}) {
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${borderColor}`, background: bgColor, padding: '10px 12px', textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px 0' }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color, margin: 0 }}>{value}</p>
    </div>
  );
}
