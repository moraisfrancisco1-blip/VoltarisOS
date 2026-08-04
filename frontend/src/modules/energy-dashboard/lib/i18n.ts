export type Lang = 'pt' | 'en';

const translations: Record<string, Record<Lang, string>> = {
  'daily.title': { pt: 'Resumo do Dia', en: 'Daily Summary' },
  'daily.saved': { pt: 'Poupado hoje', en: 'Saved today' },
  'daily.co2': { pt: 'CO₂ evitado', en: 'CO₂ avoided' },
  'daily.decisions': { pt: 'Decisões automáticas', en: 'Auto decisions' },
  'daily.selfSufficiency': { pt: 'Autossuficiência', en: 'Self-sufficiency' },
  'mode.operator': { pt: 'Operador', en: 'Operator' },
  'mode.investor': { pt: 'Investidor', en: 'Investor' },
  'action.title': { pt: 'Ação Agora', en: 'Action Now' },
  'action.chargeBattery': { pt: 'Carregar bateria agora', en: 'Charge battery now' },
  'action.chargeBatteryDesc': { pt: 'Carregar por {minutes} min gera +€{value}', en: 'Charge for {minutes} min generates +€{value}' },
  'action.avoidConsumption': { pt: 'Evitar consumo às 18h', en: 'Avoid consumption at 6PM' },
  'action.avoidConsumptionDesc': { pt: 'Poupa €{value} evitando pico', en: 'Save €{value} avoiding peak' },
  'action.sellExcess': { pt: 'Vender excesso solar', en: 'Sell solar excess' },
  'action.sellExcessDesc': { pt: 'Exportar {kw} kW gera +€{value}', en: 'Export {kw} kW generates +€{value}' },
  'action.execute': { pt: 'Executar', en: 'Execute' },
  'action.autoExecute': { pt: 'Executar automaticamente', en: 'Auto-execute' },
  'action.riskProfile': { pt: 'Perfil de risco', en: 'Risk profile' },
  'action.conservative': { pt: 'Conservador', en: 'Conservative' },
  'action.aggressive': { pt: 'Agressivo', en: 'Aggressive' },
  'action.executed': { pt: 'Executado', en: 'Executed' },
  'explain.profitDrop': { pt: 'Queda de lucro: preço spot alto + produção solar baixa', en: 'Profit drop: high spot price + low solar production' },
  'explain.profitRise': { pt: 'Aumento de lucro: preço spot baixo + alta produção solar', en: 'Profit rise: low spot price + high solar production' },
  'explain.batteryOptimal': { pt: 'Bateria a carregar em horário de preço baixo', en: 'Battery charging at low price period' },
  'explain.peakWarning': { pt: 'Consumo alto previsto — considere reduzir carga', en: 'High consumption forecasted — consider reducing load' },
  'sim.title': { pt: 'Simulação', en: 'Simulation' },
  'sim.batteryCapacity': { pt: 'Capacidade da bateria', en: 'Battery capacity' },
  'sim.consumptionProfile': { pt: 'Perfil de consumo', en: 'Consumption profile' },
  'sim.solarPanels': { pt: 'Painéis solares', en: 'Solar panels' },
  'sim.monthlyReturn': { pt: 'Retorno mensal', en: 'Monthly return' },
  'sim.yearlyReturn': { pt: 'Retorno anual', en: 'Yearly return' },
  'sim.payback': { pt: 'Payback', en: 'Payback' },
  'sim.years': { pt: 'anos', en: 'years' },
  'kpi.solarProduction': { pt: 'Produção Solar', en: 'Solar Production' },
  'kpi.gridConsumption': { pt: 'Consumo Rede', en: 'Grid Consumption' },
  'kpi.batteryLevel': { pt: 'Nível Bateria', en: 'Battery Level' },
  'kpi.profit': { pt: 'Lucro', en: 'Profit' },
  'kpi.totalLoad': { pt: 'Carga Total', en: 'Total Load' },
  'kpi.evCharging': { pt: 'Carga EV', en: 'EV Charging' },
  'kpi.spotPrice': { pt: 'Preço Spot', en: 'Spot Price' },
  'kpi.selfConsumption': { pt: 'Autoconsumo', en: 'Self-consumption' },
  'inv.roi': { pt: 'ROI', en: 'ROI' },
  'inv.totalRevenue': { pt: 'Receita Total', en: 'Total Revenue' },
  'inv.totalCost': { pt: 'Custo Total', en: 'Total Cost' },
  'inv.netProfit': { pt: 'Lucro Líquido', en: 'Net Profit' },
  'inv.riskScore': { pt: 'Score de Risco', en: 'Risk Score' },
  'inv.monthlyTrend': { pt: 'Tendência Mensal', en: 'Monthly Trend' },
  'inv.cumulativeReturn': { pt: 'Retorno Acumulado', en: 'Cumulative Return' },
  'inv.revenueBreakdown': { pt: 'Divisão de Receita', en: 'Revenue Breakdown' },
  'chart.energyFlow': { pt: 'Fluxo de Energia', en: 'Energy Flow' },
  'chart.priceVsProduction': { pt: 'Preço vs Produção', en: 'Price vs Production' },
  'chart.batteryStrategy': { pt: 'Estratégia da Bateria', en: 'Battery Strategy' },
  'chart.solar': { pt: 'Solar', en: 'Solar' },
  'chart.battery': { pt: 'Bateria', en: 'Battery' },
  'chart.grid': { pt: 'Rede', en: 'Grid' },
  'chart.price': { pt: 'Preço', en: 'Price' },
  'chart.load': { pt: 'Carga', en: 'Load' },
};

export function t(key: string, lang: Lang, params?: Record<string, string | number>): string {
  const entry = translations[key];
  if (!entry) return key;
  let text: string = entry[lang] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}
