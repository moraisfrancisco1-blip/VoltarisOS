import { useState, useEffect } from "react";
import {
  ComposedChart, AreaChart, Area, Line, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import { C, ChartDefs, PremiumTooltip, axisStyle, gridStyle, glassCard, KpiCard } from "../components/ChartTheme";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const label = { fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

const gen48h = () => Array.from({ length: 48 }, (_, i) => {
  const h = i % 24;
  const day = i < 24 ? "Today" : "Tomorrow";
  const solar = h >= 6 && h <= 20 ? rand(0.5, 9) : 0;
  return {
    label: `${day} ${h}h`,
    h,
    solar,
    solar_low: solar * rand(0.7, 0.85),
    solar_high: solar * rand(1.1, 1.25),
    wind: rand(0.2, 3.5),
    load: rand(4, 11),
    price: rand(35, 130),
    price_forecast: rand(32, 125),
    bess_soc: rand(20, 95),
  };
});

const genWeekly = () => ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => ({
  d,
  solar: rand(20, 60),
  wind: rand(5, 25),
  load: rand(30, 70),
  revenue: rand(800, 2400, 0),
}));

const SITES = ["All Sites", "Herdade Solar Norte", "Parque BESS Sul", "Complexo Évora", "Mini-Grid Alentejo", "Parque Algarve"];

const MODELS = [
  { name: "LSTM Neural Net", mae: 3.2, rmse: 4.8, r2: 0.96, status: "active" },
  { name: "XGBoost Ensemble", mae: 4.1, rmse: 5.9, r2: 0.94, status: "active" },
  { name: "Prophet + Weather", mae: 5.6, rmse: 7.2, r2: 0.91, status: "standby" },
  { name: "Linear Regression", mae: 8.4, rmse: 10.1, r2: 0.84, status: "standby" },
];

const WEATHER = [
  { day: "Today", icon: "☀️", temp: 28, irr: 820, wind: 3.2, cloud: 10 },
  { day: "Tomorrow", icon: "⛅", temp: 24, irr: 620, wind: 5.8, cloud: 35 },
  { day: "Wed", icon: "🌤️", temp: 26, irr: 710, wind: 4.1, cloud: 20 },
  { day: "Thu", icon: "🌧️", temp: 19, irr: 180, wind: 8.4, cloud: 85 },
  { day: "Fri", icon: "☀️", temp: 30, irr: 880, wind: 2.9, cloud: 5 },
  { day: "Sat", icon: "☀️", temp: 31, irr: 900, wind: 2.1, cloud: 3 },
  { day: "Sun", icon: "⛅", temp: 27, irr: 650, wind: 3.7, cloud: 28 },
];

const FORECAST_IDS = {
  solarGrad: "forecastSolarGrad",
  solarConf: "forecastSolarConf",
  bessGrad: "forecastBessGrad",
  weeklyGrad: "forecastWeeklyGrad",
};

export default function ForecastingDashboard() {
  const [data48] = useState(gen48h());
  const [weekly] = useState(genWeekly());
  const [selectedSite, setSelectedSite] = useState("All Sites");
  const [horizon, setHorizon] = useState("48h");
  const [metrics, setMetrics] = useState({ solar: 14.2, accuracy: 96.4, mae: 3.2, nextPeak: 82.4, peakIn: "2h 18m" });

  useEffect(() => {
    const t = setInterval(() => {
      setMetrics(m => ({
        solar: parseFloat((m.solar + rand(-0.2, 0.2)).toFixed(1)),
        accuracy: parseFloat((m.accuracy + rand(-0.1, 0.1)).toFixed(1)),
        mae: parseFloat((m.mae + rand(-0.05, 0.05)).toFixed(2)),
        nextPeak: parseFloat((m.nextPeak + rand(-1, 1)).toFixed(1)),
        peakIn: m.peakIn,
      }));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const radarData = [
    { metric: "Solar", forecast: 88, actual: 84 },
    { metric: "Wind", forecast: 72, actual: 69 },
    { metric: "Load", forecast: 91, actual: 88 },
    { metric: "Price", forecast: 78, actual: 75 },
    { metric: "BESS SoC", forecast: 94, actual: 92 },
  ];

  const displayData = horizon === "48h" ? data48 : data48.slice(0, 24);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* Gradient defs */}
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id={FORECAST_IDS.solarGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.amber} stopOpacity={0.6} />
            <stop offset="100%" stopColor={C.amber} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={FORECAST_IDS.solarConf} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.amber} stopOpacity={0.18} />
            <stop offset="100%" stopColor={C.amber} stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id={FORECAST_IDS.bessGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.purple} stopOpacity={0.55} />
            <stop offset="100%" stopColor={C.purple} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={FORECAST_IDS.weeklyGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.green} stopOpacity={0.5} />
            <stop offset="100%" stopColor={C.green} stopOpacity={0.02} />
          </linearGradient>
          <ChartDefs />
        </defs>
      </svg>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f1f5f9" }}>Forecasting</h1>
          <div style={{ color: "rgba(148,163,184,0.7)", fontSize: 13, marginTop: 2 }}>AI-powered solar · wind · price · load prediction</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={selectedSite} onChange={e => setSelectedSite(e.target.value)}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 12px", color: "#e2e8f0", fontSize: 12 }}>
            {SITES.map(s => <option key={s}>{s}</option>)}
          </select>
          {["24h", "48h", "7d"].map(h => (
            <button key={h} onClick={() => setHorizon(h)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer",
              background: horizon === h ? C.indigo : "rgba(255,255,255,0.06)",
              color: horizon === h ? "#fff" : "rgba(148,163,184,0.7)",
              border: `1px solid ${horizon === h ? C.indigo : "rgba(255,255,255,0.1)"}`,
              boxShadow: horizon === h ? `0 0 12px ${C.indigo}55` : "none",
            }}>{h}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <KpiCard label="Forecast Solar Now" value={`${metrics.solar} MW`} color={C.amber} />
        <KpiCard label="Model Accuracy" value={`${metrics.accuracy}%`} color={C.green} />
        <KpiCard label="MAE (kWh)" value={metrics.mae} color={C.blue} />
        <KpiCard label="Next Price Peak" value={`€${metrics.nextPeak}/MWh`} color={C.red} />
        <KpiCard label="Peak Arrives In" value={metrics.peakIn} color={C.purple} />
      </div>

      {/* Weather strip */}
      <div style={glassCard(C.blue)}>
        <div style={{ ...label, marginBottom: 12 }}>7-Day Weather Forecast · {selectedSite}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
          {WEATHER.map(w => (
            <div key={w.day} style={{
              background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 8px", textAlign: "center",
              border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(4px)",
            }}>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginBottom: 6 }}>{w.day}</div>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{w.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{w.temp}°C</div>
              <div style={{ fontSize: 10, color: C.amber }}>☀️ {w.irr} W/m²</div>
              <div style={{ fontSize: 10, color: C.blue }}>💨 {w.wind} m/s</div>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.75)" }}>☁️ {w.cloud}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Solar generation forecast with confidence bands */}
      <div style={glassCard(C.amber)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={label}>Solar Generation Forecast (MW) — with confidence interval</div>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.75)" }}>Shaded area = 80% confidence band</div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={displayData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="label" tick={axisStyle} tickFormatter={v => v.split(" ")[1]} interval={3} />
            <YAxis tick={axisStyle} unit=" MW" />
            <Tooltip content={<PremiumTooltip />} />
            <ReferenceLine x="Today 12h" stroke={C.amber} strokeDasharray="3 3" label={{ value: "Now", fill: C.amber, fontSize: 10 }} />
            <Area type="monotone" dataKey="solar_high" fill={`url(#${FORECAST_IDS.solarConf})`} stroke="none" name="Upper 80%" />
            <Area type="monotone" dataKey="solar_low" fill="#1e293b" stroke="none" name="Lower 80%" />
            <Area type="monotone" dataKey="solar" stroke={C.amber} fill={`url(#${FORECAST_IDS.solarGrad})`}
              strokeWidth={2.5} dot={false} name="Solar Forecast"
              style={{ filter: `drop-shadow(0 0 6px ${C.amber}88)` }} />
            <Line type="monotone" dataKey="wind" stroke={C.blue} strokeWidth={2} dot={false} name="Wind"
              style={{ filter: `drop-shadow(0 0 4px ${C.blue}66)` }} />
            <Line type="monotone" dataKey="load" stroke={C.red} strokeWidth={2} strokeDasharray="4 2" dot={false} name="Load" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Price forecast + BESS SoC plan */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={glassCard(C.blue)}>
          <div style={{ ...label, marginBottom: 12 }}>Price Forecast (€/MWh)</div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={displayData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="label" tick={axisStyle} tickFormatter={v => v.split(" ")[1]} interval={3} />
              <YAxis tick={axisStyle} unit="€" />
              <Tooltip content={<PremiumTooltip />} />
              <Line type="monotone" dataKey="price" stroke={C.blue} strokeWidth={2.5} dot={false} name="DA Price"
                style={{ filter: `drop-shadow(0 0 5px ${C.blue}77)` }} />
              <Line type="monotone" dataKey="price_forecast" stroke={C.purple} strokeWidth={2} strokeDasharray="4 2" dot={false} name="Forecast" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={glassCard(C.purple)}>
          <div style={{ ...label, marginBottom: 12 }}>BESS SoC Forecast Plan (%)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={displayData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="label" tick={axisStyle} tickFormatter={v => v.split(" ")[1]} interval={3} />
              <YAxis tick={axisStyle} unit="%" domain={[0, 100]} />
              <Tooltip content={<PremiumTooltip />} />
              <ReferenceLine y={80} stroke={C.amber} strokeDasharray="3 3" label={{ value: "Max 80%", fill: C.amber, fontSize: 9 }} />
              <ReferenceLine y={20} stroke={C.red} strokeDasharray="3 3" label={{ value: "Min 20%", fill: C.red, fontSize: 9 }} />
              <Area type="monotone" dataKey="bess_soc" stroke={C.purple} fill={`url(#${FORECAST_IDS.bessGrad})`}
                strokeWidth={2} name="BESS SoC"
                style={{ filter: `drop-shadow(0 0 5px ${C.purple}77)` }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly + Radar */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
        <div style={glassCard(C.green)}>
          <div style={{ ...label, marginBottom: 12 }}>Weekly Generation & Revenue Forecast</div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={weekly} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="d" tick={axisStyle} />
              <YAxis yAxisId="gen" tick={axisStyle} unit=" MWh" />
              <YAxis yAxisId="rev" orientation="right" tick={axisStyle} unit="€" />
              <Tooltip content={<PremiumTooltip />} />
              <Bar yAxisId="gen" dataKey="solar" stackId="a" fill={C.amber} fillOpacity={0.85} name="Solar" />
              <Bar yAxisId="gen" dataKey="wind" stackId="a" fill={C.blue} fillOpacity={0.75} name="Wind" radius={[4,4,0,0]} />
              <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke={C.green} strokeWidth={2.5} dot={false} name="Revenue €"
                style={{ filter: `drop-shadow(0 0 5px ${C.green}88)` }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={glassCard(C.indigo)}>
          <div style={{ ...label, marginBottom: 12 }}>Forecast Accuracy by Category</div>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={70}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="metric" tick={axisStyle} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} />
              <Radar name="Forecast" dataKey="forecast" stroke={C.indigo} fill={C.indigo} fillOpacity={0.25}
                style={{ filter: `drop-shadow(0 0 6px ${C.indigo}88)` }} />
              <Radar name="Actual" dataKey="actual" stroke={C.green} fill={C.green} fillOpacity={0.15} />
              <Tooltip content={<PremiumTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model performance */}
      <div style={glassCard(C.indigo)}>
        <div style={{ ...label, marginBottom: 12 }}>Forecast Model Performance</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Model", "MAE (kWh)", "RMSE (kWh)", "R² Score", "Status"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "6px 12px", fontSize: 10, color: "rgba(148,163,184,0.85)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODELS.map((m, idx) => (
              <tr key={m.name} style={{
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                background: idx % 2 === 0 ? "rgba(255,255,255,0.05)" : "transparent",
              }}>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{m.name}</td>
                <td style={{ padding: "10px 12px", fontSize: 12, color: m.mae < 5 ? C.green : C.amber, fontWeight: 600 }}>{m.mae}</td>
                <td style={{ padding: "10px 12px", fontSize: 12, color: m.rmse < 6 ? C.green : C.amber }}>{m.rmse}</td>
                <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: m.r2 > 0.93 ? C.green : C.blue,
                  textShadow: `0 0 8px ${m.r2 > 0.93 ? C.green : C.blue}88` }}>{m.r2}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 12,
                    background: m.status === "active" ? `${C.green}22` : "rgba(255,255,255,0.05)",
                    color: m.status === "active" ? C.green : "rgba(148,163,184,0.75)",
                    border: `1px solid ${m.status === "active" ? `${C.green}55` : "rgba(255,255,255,0.08)"}`,
                    boxShadow: m.status === "active" ? `0 0 8px ${C.green}33` : "none",
                  }}>
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
