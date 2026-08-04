import React, { useState, useEffect } from 'react';
import { useDashboardStore } from './lib/store';
import { Header } from './components/dashboard/Header';
import { DailySummary } from './components/dashboard/DailySummary';
import { KPICards } from './components/dashboard/KPICards';
import { ActionPanel } from './components/dashboard/ActionPanel';
import { SimulationPanel } from './components/dashboard/SimulationPanel';
import { EnergyFlowChart } from './components/dashboard/EnergyFlowChart';
import { BatteryChart } from './components/dashboard/BatteryChart';
import { PriceProductionChart } from './components/dashboard/PriceProductionChart';
import { InvestorView } from './components/dashboard/InvestorView';
import './energy-dashboard.css';

export default function EnergyDashboard() {
  const { mode } = useDashboardStore();
  const [realPrices, setRealPrices] = useState([]);

  useEffect(() => {
    fetch("/api/prices/day-ahead")
      .then(res => res.json())
      .then(data => setRealPrices(data.prices || []))
      .catch(() => {})
  }, [])

  return (
    <div className="energy-dashboard">
      <div className="energy-dashboard__inner">
        <Header />
        <DailySummary />
        {mode === 'operator' ? <OperatorView realPrices={realPrices} /> : <InvestorView />}
      </div>
    </div>
  );
}

function OperatorView({ realPrices }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KPICards />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <EnergyFlowChart />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <BatteryChart />
            <PriceProductionChart realPrices={realPrices} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ActionPanel />
          <SimulationPanel />
        </div>
      </div>
    </div>
  );
}