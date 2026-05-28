import { useState, useMemo, useEffect } from 'react';
import {
  AreaChart, Area, ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

const accent = "#6366f1";
const green = "#10b981";
const amber = "#f59e0b";
const red = "#ef4444";
const blue = "#60a5fa";
const purple = "#a78bfa";
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 };

function rand(min, max, dec = 1) { return +(Math.random() * (max - min) + min).toFixed(dec); }

function generateForecast(hours = 48) {
  const now = new Date(); now.setMinutes(0, 0, 0);
  return Array.from({ length: hours }, (_, i) => {
    const t = new Date(now.getTime() + i * 3600000);
    const h = t.getHours();
    const dayFactor = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    const cloud = rand(10, 80);
    const solar = h >= 5 && h <= 21 ? +(dayFactor * rand(600, 1100) * (1 - cloud / 200)).toFixed(1) : 0;
    const wind = +(rand(2, 14) + (h >= 10 && h <= 18 ? rand(0, 8) : 0)).toFixed(1);
    const load = +(180 + Math.sin(i / 4) * 60 + rand(-15, 15)).toFixed(1);
    const price = +(20 + Math.sin(i / 3.5) * 40 + rand(-8, 8)).toFixed(2);
    const bessAction = price > 60 ? "discharge" : price < 25 ? "charge" : "idle";
    const bessPower = bessAction === "discharge" ? rand(100, 500) : bessAction === "charge" ? -rand(100, 400) : 0;
    const netBalance = solar + wind - load + bessPower;
    return {
      time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullTime: t,
      hour: h, idx: i, isPast: i < 1,
      solar, solarP10: Math.max(0, solar * 0.75), solarP90: solar * 1.2,
      wind, load,
      price, priceForecast: price + rand(-5, 5),
      bessAction, bessPower,
      netBalance: +netBalance.toFixed(1),
      soc: Math.max(10, Math.min(98, 55 + Math.sin((i - 8) / 6) * 35)),
      cloud, humidity: rand(40, 85), temp: +(16 + dayFactor * 14 + rand(-3, 3)).toFixed(1),
      confidence: rand(72, 96),
      revenue: bessAction === "discharge" ? +(bessPower * price / 1000).toFixed(2) : 0,
    };
  });
}

const BESS_SCHEDULE = [
  { start: "01:00", end: "06:00", action: "charge", label: "Night Charge", color: `${green}30`, border: green },
  { start: "08:00", end: "11:00", action: "discharge", label: "AM Peak Discharge", color: `${red}20`, border: red },
  { start: "12:00", end: "15:00", action: "solar_absorb", label: "Solar Absorption", color: `${amber}20`, border: amber },
  { start: "17:00", end: "21:00", action: "discharge", label: "PM Peak Discharge", color: `${red}20`, border: red },
  { start: "22:00", end: "24:00", action: "charge", label: "Recovery Charge", color: `${green}30`, border: green },
];

const MODELS = [
  { id: "ensemble", label: "AI Ensemble", accuracy: 94.2, desc: "LSTM + XGBoost + Weather API fusion" },
  { id: "lstm", label: "LSTM Neural Net", accuracy: 91.8, desc: "48h deep learning time-series" },
  { id: "physical", label: "Physical Model", accuracy: 87.3, desc: "Irradiance + panel efficiency model" },
  { id: "arima", label: "ARIMA+", accuracy: 84.1, desc: "Statistical baseline with exogenous vars" },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--tooltip-bg,#1a1f2e)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 12, maxWidth: 220 }}>
      <div style={{ color: "var(--sub)", marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", gap: 12, justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const VIEWS = ["48h Forecast", "BESS Schedule", "Price Forecast", "Weather Model", "AI Confidence", "Scenario Analysis"];

export default function ForecastingDashboard() {
  const [view, setView] = useState("48h Forecast");
  const [model, setModel] = useState("ensemble");
  const [horizon, setHorizon] = useState(24);
  const [showBand, setShowBand] = useState(true);
  const [data] = useState(() => generateForecast(48));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  const visible = data.slice(0, horizon);
  const totalSolarForecast = visible.reduce((a, d) => a + d.solar, 0).toFixed(0);
  const totalRevForecast = visible.reduce((a, d) => a + d.revenue, 0).toFixed(0);
  const peakSolar = Math.max(...visible.map(d => d.solar)).toFixed(0);
  const avgConfidence = (visible.reduce((a, d) => a + d.confidence, 0) / visible.length).toFixed(1);
  const chargeWindows = BESS_SCHEDULE.filter(s => s.action === "charge").length;
  const dischargeWindows = BESS_SCHEDULE.filter(s => s.action === "discharge").length;

  const scenarioData = visible.map(d => ({
    time: d.time,
    pessimist: +(d.solar * 0.65 + d.wind * 0.7).toFixed(1),
    base: +(d.solar + d.wind).toFixed(1),
    optimist: +(d.solar * 1.25 + d.wind * 1.15).toFixed(1),
  }));

  const modelPerf = [
    { metric: "MAE", ensemble: 18.4, lstm: 22.1, physical: 31.5, arima: 38.2 },
    { metric: "RMSE", ensemble: 24.1, lstm: 29.3, physical: 42.0, arima: 51.7 },
    { metric: "R²", ensemble: 0.942, lstm: 0.918, physical: 0.873, arima: 0.841 },
    { metric: "Bias", ensemble: 0.8, lstm: 1.4, physical: -3.2, arima: 2.1 },
  ];

  const radarData = ["Solar Acc.", "Wind Acc.", "Price Acc.", "Load Acc.", "BESS Timing", "Peak Detect."].map(s => ({
    subject: s,
    ensemble: rand(88, 97),
    lstm: rand(80, 93),
    physical: rand(70, 85),
  }));

  const hourlyWeather = visible.slice(0, 24).map(d => ({
    time: d.time, temp: d.temp, cloud: d.cloud, humidity: d.humidity, wind: d.wind,
  }));

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--bg)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>AI Forecasting Engine</h1>
          <p style={{ color: "var(--sub)", fontSize: 14 }}>Solar irradiance, wind, price & BESS dispatch optimization — multi-model ensemble</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
            <span style={{ color: green }}>●</span> Refreshed {tick * 5}s ago
          </div>
          {[24, 36, 48].map(h => (
            <button key={h} onClick={() => setHorizon(h)} style={{
              background: horizon === h ? accent : "var(--surface2)", color: horizon === h ? "#fff" : "var(--sub)",
              border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer"
            }}>{h}h</button>
          ))}
          <button onClick={() => setShowBand(v => !v)} style={{
            background: showBand ? `${accent}30` : "var(--surface2)", color: showBand ? accent : "var(--sub)",
            border: `1px solid ${showBand ? accent : "var(--border)"}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer"
          }}>P10/P90 Band</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Solar Forecast", v: `${(totalSolarForecast / 1000).toFixed(1)} MWh`, sub: `${horizon}h window`, c: amber },
          { l: "Peak Solar", v: `${peakSolar} kW`, sub: "expected peak", c: amber },
          { l: "Proj. Revenue", v: `€${totalRevForecast}`, sub: "BESS arbitrage", c: green },
          { l: "AI Confidence", v: `${avgConfidence}%`, sub: model, c: accent },
          { l: "Charge Windows", v: chargeWindows, sub: "optimized slots", c: blue },
          { l: "Discharge Windows", v: dischargeWindows, sub: "peak dispatch", c: red },
          { l: "Model", v: MODELS.find(m2 => m2.id === model)?.accuracy + "%", sub: "accuracy (MAE)", c: purple },
        ].map(k => (
          <div key={k.l} style={{ ...card, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--sub)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.l}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.c }}>{k.v}</div>
            <div style={{ fontSize: 10, color: "var(--sub)", marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Model selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {MODELS.map(m2 => (
          <div key={m2.id} onClick={() => setModel(m2.id)} style={{
            flex: 1, ...card, padding: 12, cursor: "pointer",
            border: `1px solid ${model === m2.id ? accent : "var(--border)"}`,
            background: model === m2.id ? "var(--surface2)" : "var(--surface)",
            transition: "all 0.2s"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{m2.label}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: model === m2.id ? green : "var(--sub)" }}>{m2.accuracy}%</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 4 }}>{m2.desc}</div>
            <div style={{ background: "#1f2937", borderRadius: 3, height: 4, marginTop: 8 }}>
              <div style={{ width: `${m2.accuracy}%`, height: "100%", background: model === m2.id ? green : "#374151", borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {VIEWS.map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? accent : "var(--surface)", color: view === v ? "#fff" : "var(--sub)",
            border: `1px solid ${view === v ? accent : "var(--border)"}`, borderRadius: 8,
            padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: view === v ? 600 : 400
          }}>{v}</button>
        ))}
      </div>

      {/* Main chart area */}
      {view === "48h Forecast" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Solar Generation + BESS Dispatch Forecast ({horizon}h)</div>
            <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 14 }}>Shaded band = P10–P90 confidence interval. BESS bars show charge (negative) / discharge (positive) scheduling.</p>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={visible}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={Math.floor(horizon / 8)} />
                <YAxis yAxisId="gen" tick={{ fontSize: 10, fill: "var(--sub)" }} label={{ value: "kW", angle: -90, position: "insideLeft", fill: "var(--sub)", fontSize: 10 }} />
                <YAxis yAxisId="bess" orientation="right" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {showBand && <Area yAxisId="gen" type="monotone" dataKey="solarP90" fill={`${amber}15`} stroke="none" name="P90" />}
                {showBand && <Area yAxisId="gen" type="monotone" dataKey="solarP10" fill={`${amber}00`} stroke="none" name="P10" />}
                <Area yAxisId="gen" type="monotone" dataKey="solar" stroke={amber} fill={`${amber}25`} strokeWidth={2} name="Solar kW" />
                <Area yAxisId="gen" type="monotone" dataKey="wind" stroke={blue} fill={`${blue}15`} strokeWidth={1.5} name="Wind kW" />
                <Line yAxisId="gen" type="monotone" dataKey="load" stroke={red} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Load kW" />
                <Bar yAxisId="bess" dataKey="bessPower" name="BESS kW" radius={[2, 2, 0, 0]}>
                  {visible.map((d, i) => (
                    <Cell key={i} fill={d.bessPower > 0 ? `${green}CC` : d.bessPower < 0 ? `${accent}CC` : "#374151"} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>BESS State of Charge Forecast</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={visible}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={Math.floor(horizon / 6)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--sub)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={20} stroke={red} strokeDasharray="3 3" label={{ value: "Min 20%", fill: red, fontSize: 10 }} />
                  <ReferenceLine y={90} stroke={amber} strokeDasharray="3 3" label={{ value: "Max 90%", fill: amber, fontSize: 10 }} />
                  <Area type="monotone" dataKey="soc" stroke={green} fill={`${green}25`} strokeWidth={2} name="SoC %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Net Energy Balance (Solar+Wind+BESS-Load)</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={visible}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={Math.floor(horizon / 6)} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="netBalance" name="Net kW" radius={[2, 2, 0, 0]}>
                    {visible.map((d, i) => <Cell key={i} fill={d.netBalance >= 0 ? green : red} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {view === "BESS Schedule" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>AI-Optimized BESS Dispatch Schedule</div>
            <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 14 }}>Charge during low-price / high-solar windows. Discharge during peak demand / high-price periods.</p>
            {/* Gantt-style schedule */}
            <div style={{ position: "relative", height: 80, background: "var(--surface2)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
              {BESS_SCHEDULE.map((s, i) => {
                const startH = parseInt(s.start.split(":")[0]);
                const endH = parseInt(s.end.split(":")[0]);
                const left = (startH / 24) * 100;
                const width = ((endH - startH) / 24) * 100;
                return (
                  <div key={i} style={{
                    position: "absolute", left: `${left}%`, width: `${width}%`, top: 12, bottom: 12,
                    background: s.color, border: `1px solid ${s.border}`, borderRadius: 6,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <span style={{ fontSize: 11, color: s.border, fontWeight: 600, whiteSpace: "nowrap" }}>{s.label}</span>
                  </div>
                );
              })}
              {/* Hour markers */}
              {[0, 6, 12, 18, 24].map(h => (
                <div key={h} style={{ position: "absolute", left: `${(h / 24) * 100}%`, top: 0, bottom: 0, borderLeft: "1px solid var(--border)" }}>
                  <span style={{ position: "absolute", bottom: 2, left: 3, fontSize: 9, color: "var(--sub)" }}>{h}:00</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={visible.slice(0, 24)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={3} />
                <YAxis yAxisId="bess" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Line yAxisId="price" type="monotone" dataKey="price" stroke={amber} strokeWidth={2} dot={false} name="€/MWh" />
                <Bar yAxisId="bess" dataKey="bessPower" name="BESS kW" radius={[2, 2, 0, 0]}>
                  {visible.slice(0, 24).map((d, i) => <Cell key={i} fill={d.bessPower > 0 ? green : d.bessPower < 0 ? accent : "#374151"} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
            {BESS_SCHEDULE.map(s => (
              <div key={s.label} style={{ ...card, padding: 14, borderLeft: `3px solid ${s.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: s.border }}>{s.label}</div>
                <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 4 }}>{s.start} – {s.end}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  {s.action === "charge" ? `↑ ${rand(150, 400, 0)} kW` : s.action === "discharge" ? `↓ ${rand(200, 600, 0)} kW` : "Absorbing solar"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "Price Forecast" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Day-Ahead & Intraday Price Forecast + BESS Arbitrage Opportunities</div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={visible}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={Math.floor(horizon / 8)} />
                <YAxis yAxisId="price" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <YAxis yAxisId="rev" orientation="right" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine yAxisId="price" y={60} stroke={green} strokeDasharray="3 3" label={{ value: "Sell threshold", fill: green, fontSize: 10 }} />
                <ReferenceLine yAxisId="price" y={25} stroke={blue} strokeDasharray="3 3" label={{ value: "Buy threshold", fill: blue, fontSize: 10 }} />
                <Area yAxisId="price" type="monotone" dataKey="price" stroke={amber} fill={`${amber}25`} strokeWidth={2} name="DA Price €/MWh" />
                <Line yAxisId="price" type="monotone" dataKey="priceForecast" stroke={purple} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="AI Forecast €/MWh" />
                <Bar yAxisId="rev" dataKey="revenue" fill={`${green}AA`} name="Arbitrage Revenue €" radius={[2, 2, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { l: "Avg Price (forecast)", v: `€${(visible.reduce((a, d) => a + d.price, 0) / visible.length).toFixed(2)}/MWh`, c: amber },
              { l: "Peak Price", v: `€${Math.max(...visible.map(d => d.price)).toFixed(2)}/MWh`, c: red },
              { l: "Arbitrage Spread", v: `€${(Math.max(...visible.map(d => d.price)) - Math.min(...visible.map(d => d.price))).toFixed(2)}/MWh`, c: green },
            ].map(k => (
              <div key={k.l} style={{ ...card, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 6 }}>{k.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "Weather Model" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ ...card, gridColumn: "span 2" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>24h Weather Forecast (Temperature · Cloud Cover · Humidity · Wind)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={hourlyWeather}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={3} />
                <YAxis yAxisId="temp" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="temp" type="monotone" dataKey="temp" stroke={red} strokeWidth={2} dot={false} name="Temp °C" />
                <Area yAxisId="pct" type="monotone" dataKey="cloud" stroke="#94a3b8" fill="#94a3b820" strokeWidth={1.5} name="Cloud %" />
                <Area yAxisId="pct" type="monotone" dataKey="humidity" stroke={blue} fill={`${blue}10`} strokeWidth={1.5} name="Humidity %" />
                <Bar yAxisId="pct" dataKey="wind" fill={`${green}60`} name="Wind m/s" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Today's Weather Summary</div>
            {[
              { icon: "🌡", l: "Avg Temperature", v: `${(hourlyWeather.reduce((a, d) => a + d.temp, 0) / hourlyWeather.length).toFixed(1)}°C` },
              { icon: "☁", l: "Avg Cloud Cover", v: `${(hourlyWeather.reduce((a, d) => a + d.cloud, 0) / hourlyWeather.length).toFixed(0)}%` },
              { icon: "💧", l: "Avg Humidity", v: `${(hourlyWeather.reduce((a, d) => a + d.humidity, 0) / hourlyWeather.length).toFixed(0)}%` },
              { icon: "💨", l: "Avg Wind Speed", v: `${(hourlyWeather.reduce((a, d) => a + d.wind, 0) / hourlyWeather.length).toFixed(1)} m/s` },
              { icon: "☀", l: "Peak Irradiance", v: `${Math.max(...visible.map(d => d.solar)).toFixed(0)} kW` },
              { icon: "🌅", l: "Sunrise / Sunset", v: "06:12 / 20:34" },
            ].map(m => (
              <div key={m.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                <span>{m.icon} {m.l}</span>
                <span style={{ fontWeight: 700 }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Solar Irradiance Forecast (kW/m²)</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={visible.slice(0, 24)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <Tooltip content={<CustomTooltip />} />
                {showBand && <Area type="monotone" dataKey="solarP90" fill={`${amber}15`} stroke="none" name="P90" />}
                <Area type="monotone" dataKey="solar" stroke={amber} fill={`${amber}30`} strokeWidth={2} name="Solar kW" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {view === "AI Confidence" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Forecast Confidence Over Horizon</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={visible}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={Math.floor(horizon / 6)} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={80} stroke={amber} strokeDasharray="3 3" label={{ value: "80%", fill: amber, fontSize: 10 }} />
                <Area type="monotone" dataKey="confidence" stroke={accent} fill={`${accent}25`} strokeWidth={2} name="Confidence %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Model Accuracy by Dimension</div>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--grid-line,#1f2937)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <PolarRadiusAxis domain={[60, 100]} tick={false} />
                <Radar name="Ensemble" dataKey="ensemble" stroke={green} fill={`${green}25`} strokeWidth={2} />
                <Radar name="LSTM" dataKey="lstm" stroke={accent} fill={`${accent}10`} strokeWidth={1.5} />
                <Radar name="Physical" dataKey="physical" stroke={amber} fill={`${amber}10`} strokeWidth={1.5} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...card, gridColumn: "span 2" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Model Performance Comparison</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Metric", "AI Ensemble", "LSTM", "Physical Model", "ARIMA+"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--sub)", fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modelPerf.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.metric}</td>
                    <td style={{ padding: "10px 12px", color: green, fontWeight: 700 }}>{r.ensemble}</td>
                    <td style={{ padding: "10px 12px" }}>{r.lstm}</td>
                    <td style={{ padding: "10px 12px" }}>{r.physical}</td>
                    <td style={{ padding: "10px 12px", color: "var(--sub)" }}>{r.arima}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "Scenario Analysis" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Generation Scenarios — Pessimist / Base / Optimist</div>
            <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 14 }}>Based on weather uncertainty range. Used to compute min/max BESS revenue bounds.</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={scenarioData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={Math.floor(horizon / 8)} />
                <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="optimist" stroke={green} fill={`${green}15`} strokeWidth={1.5} name="Optimist kW" />
                <Area type="monotone" dataKey="base" stroke={amber} fill={`${amber}20`} strokeWidth={2} name="Base kW" />
                <Area type="monotone" dataKey="pessimist" stroke={red} fill={`${red}10`} strokeWidth={1.5} name="Pessimist kW" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[
              { label: "Pessimist", energy: (totalSolarForecast * 0.65 / 1000).toFixed(2), rev: (totalRevForecast * 0.55).toFixed(0), color: red },
              { label: "Base Case", energy: (totalSolarForecast / 1000).toFixed(2), rev: totalRevForecast, color: amber },
              { label: "Optimist", energy: (totalSolarForecast * 1.2 / 1000).toFixed(2), rev: (totalRevForecast * 1.3).toFixed(0), color: green },
            ].map(s => (
              <div key={s.label} style={{ ...card, borderLeft: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--sub)" }}>Energy ({horizon}h)</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{s.energy} MWh</div>
                <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 8 }}>Proj. BESS Revenue</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: green }}>€{s.rev}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
