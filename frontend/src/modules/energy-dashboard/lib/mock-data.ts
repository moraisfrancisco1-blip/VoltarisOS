export function generateHourlyData() {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    const hour = String(i).padStart(2, '0') + ':00';
    const solarBase = i >= 6 && i <= 20 ? Math.sin(((i - 6) / 14) * Math.PI) * 8.5 : 0;
    const solar = Math.max(0, solarBase + (Math.random() - 0.5) * 1.2);
    const consumption = 2 + Math.sin(((i - 3) / 24) * Math.PI * 2) * 3 + Math.random() * 1.5;
    const evCharging = i >= 22 || i <= 5 ? Math.random() * 3.5 : i >= 17 && i <= 19 ? Math.random() * 2 : 0;
    const totalLoad = consumption + evCharging;
    const spotPrice = 0.05 + Math.sin(((i - 4) / 24) * Math.PI * 2) * 0.12 + Math.random() * 0.03;
    const batteryLevel = 20 + (solar > totalLoad ? Math.min(80, (solar - totalLoad) * 10) : -Math.min(20, (totalLoad - solar) * 5));
    const gridImport = Math.max(0, totalLoad - solar - Math.max(0, batteryLevel - 30) * 0.1);
    const gridExport = Math.max(0, solar - totalLoad - (100 - batteryLevel) * 0.05);
    hours.push({
      hour,
      solar: +solar.toFixed(2),
      consumption: +consumption.toFixed(2),
      evCharging: +evCharging.toFixed(2),
      totalLoad: +totalLoad.toFixed(2),
      spotPrice: +spotPrice.toFixed(4),
      batteryLevel: +Math.min(100, Math.max(0, batteryLevel)).toFixed(1),
      gridImport: +gridImport.toFixed(2),
      gridExport: +gridExport.toFixed(2),
      profit: +((gridExport * spotPrice * 1.1) - (gridImport * spotPrice) + (solar > 0 ? solar * 0.02 : 0)).toFixed(3),
    });
  }
  return hours;
}

export function generateMonthlyData() {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  let cumulative = 0;
  return months.map((month, i) => {
    const solarFactor = Math.sin(((i + 1) / 12) * Math.PI) * 0.8 + 0.5;
    const revenue = 180 * solarFactor + Math.random() * 60;
    const cost = 90 + Math.random() * 40;
    const profit = revenue - cost;
    cumulative += profit;
    return {
      month,
      revenue: +revenue.toFixed(2),
      cost: +cost.toFixed(2),
      profit: +profit.toFixed(2),
      cumulative: +cumulative.toFixed(2),
      roi: +((cumulative / 12000) * 100).toFixed(1),
    };
  });
}

export function getDailySummary() {
  return {
    savedToday: 14.73,
    co2Avoided: 8.2,
    autoDecisions: 7,
    selfSufficiency: 78,
    solarProduction: 32.4,
    gridConsumption: 9.1,
    batteryLevel: 64,
    profit: 14.73,
    totalLoad: 28.7,
    evCharging: 6.3,
    spotPrice: 0.087,
    selfConsumption: 82,
  };
}

export function getRevenueBreakdown() {
  return [
    { name: 'Solar Self-use', value: 45, fill: '#10b981' },
    { name: 'Grid Export', value: 25, fill: '#34d399' },
    { name: 'Battery Arbitrage', value: 20, fill: '#f59e0b' },
    { name: 'EV Smart Charge', value: 10, fill: '#6366f1' },
  ];
}

export function calculateSimulation(battery: number, consumption: number, panels: number) {
  const monthlyGeneration = panels * 35;
  const monthlyConsumption = 200 + (consumption / 100) * 400;
  const selfUseRatio = Math.min(1, (monthlyGeneration + battery * 20) / monthlyConsumption);
  const gridSavings = monthlyConsumption * selfUseRatio * 0.15;
  const exportRevenue = Math.max(0, monthlyGeneration - monthlyConsumption * 0.7) * 0.06;
  const arbitrageRevenue = battery * 2.5;
  const monthlyReturn = gridSavings + exportRevenue + arbitrageRevenue;
  const yearlyReturn = monthlyReturn * 12;
  const totalInvestment = battery * 500 + panels * 350;
  const paybackYears = totalInvestment / yearlyReturn;
  return {
    monthlyReturn: +monthlyReturn.toFixed(2),
    yearlyReturn: +yearlyReturn.toFixed(2),
    paybackYears: +paybackYears.toFixed(1),
    selfUseRatio: +(selfUseRatio * 100).toFixed(0),
    totalInvestment,
  };
}
