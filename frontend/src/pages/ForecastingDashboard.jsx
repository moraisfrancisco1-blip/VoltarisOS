import { useState, useMemo } from 'react';
import {
  AreaChart, Area, ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend
} from 'recharts';
import { useAppStore } from '../store/appStore';

// ─── Mock Data Generator ──────────────────────────────────────────────────────
function generateMockForecast(hours = 24) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return Array.from({ length: hours }, (_, i) => {
    const t = new Date(now.getTime() + i * 3600000);
    const h = t.getHours();
    const dayFactor = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    const noise = () => (Math.random() - 0.5) * 0.15;
    const solar = h >= 6 && h <= 20
      ? +(dayFactor * (850 + Math.random() * 200) * (0.85 + noise())).toFixed(1)
      : 0;
    const cloudCover = +(20 + Math.random() * 60).toFixed(0);
    const solarAdj = +(solar * (1 - cloudCover / 150)).toFixed(1);
    const windSpeed = +(3 + Math.random() * 12).toFixed(1);
    const windDirs = ['N','NE','E','SE','S','SW','W','NW'];
    return {
      time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hour: h,
      solar: solarAdj,
      price: +(35 + Math.sin(i / 3) * 25 + Math.random() * 10).toFixed(2),
      wind: +(windSpeed).toFixed(1),
      load: +(180 + Math.sin(i / 4) * 60 + Math.random() * 20).toFixed(1),
      temp: +(18 + dayFactor * 10 + noise() * 5).toFixed(1),
      humidity: +(55 + noise() * 30).toFixed(0),
      cloudCover,
      uvIndex: h >= 7 && h <= 18 ? +(dayFactor * 9 + noise() * 2).toFixed(1) : 0,
      windDir: windDirs[Math.floor(Math.random() * 8)],
      aiConfidence: +(72 + Math.random() * 22).toFixed(0),
      bessRevenue: i % 4 === 3 ? +(Math.random() * 180 + 40).toFixed(0) : 0,
    };
  });
}

const BESS_SCHEDULE = [
  { start: '02:00', end: '06:00', action: 'charge', label: 'Charge', revenue: null },
  { start: '08:00', end: '10:00', action: 'discharge', label: 'Discharge', revenue: 142 },
  { start: '12:00', end: '14:00', action: 'idle', label: 'Idle / Solar Absorb', revenue: null },
  { start: '17:00', end: '20:00', action: 'discharge', label: 'Peak Discharge', revenue: 318 },
  { start: '21:00', end: '23:00', action: 'charge', label: 'Night Charge', revenue: null },
];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--tooltip-bg, var(--surface))',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
      color: 'var(--text)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--sub)' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}{p.unit || ''}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Weather Widget Card ──────────────────────────────────────────────────────
const WeatherWidget = ({ icon, label, value, unit, trend, trendDir, color }) => (
  <div style={{
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '14px 16px',
    flex: 1,
    minWidth: 110,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color: color || 'var(--text)', lineHeight: 1 }}>
      {value}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--sub)', marginLeft: 2 }}>{unit}</span>
    </div>
    {trend != null && (
      <div style={{ fontSize: 11, color: trendDir === 'up' ? '#22c55e' : trendDir === 'down' ? '#ef4444' : 'var(--sub)', display: 'flex', alignItems: 'center', gap: 3 }}>
        {trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→'} {trend}
      </div>
    )}
  </div>
);

// ─── AI Prediction Panel ──────────────────────────────────────────────────────
const AIPredictionPanel = ({ data }) => {
  const current = data[0] || {};
  const next6 = data.slice(0, 6);
  const avgCloud = (next6.reduce((a, d) => a + d.cloudCover, 0) / next6.length).toFixed(0);
  const avgSolar = (next6.reduce((a, d) => a + d.solar, 0) / next6.length).toFixed(0);
  const peakPriceSlot = [...data].sort((a, b) => b.price - a.price)[0];
  const confidence = current.aiConfidence || 84;
  const cloudAlert = avgCloud > 60;
  const solarDipHour = next6.find(d => d.solar < 200 && d.hour >= 10 && d.hour <= 16);

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${cloudAlert ? '#f59e0b55' : 'var(--border)'}`,
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>AI Weather Forecast</div>
            <div style={{ fontSize: 11, color: 'var(--sub)' }}>Next 6h prediction</div>
          </div>
        </div>
        {/* Confidence ring */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: `conic-gradient(var(--accent) ${confidence * 3.6}deg, var(--border) 0deg)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            }}>{confidence}%</div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 2 }}>Confidence</div>
        </div>
      </div>

      {/* Alert */}
      {cloudAlert && (
        <div style={{
          background: '#f59e0b22',
          border: '1px solid #f59e0b66',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          color: '#f59e0b',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ⚠️ Cloud cover &gt;60% — expect solar output drop ~{Math.round(avgCloud * 0.6)}% in next 6h
        </div>
      )}

      {/* Predictions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PredictionRow icon="☁️" label="Avg cloud cover" value={`${avgCloud}%`} />
        <PredictionRow icon="☀️" label="Avg solar irradiance" value={`${avgSolar} W/m²`} />
        {solarDipHour && <PredictionRow icon="📉" label="Solar dip expected" value={`~${solarDipHour.time}`} warn />}
        <PredictionRow icon="⚡" label="Peak price window" value={peakPriceSlot ? `${peakPriceSlot.time} @ €${peakPriceSlot.price}/MWh` : '—'} />
        <PredictionRow icon="💰" label="Weather-adj revenue est." value={`€ ${(avgSolar * 0.42 + peakPriceSlot?.price * 3.1).toFixed(0)}`} />
      </div>

      {/* Summary blurb */}
      <div style={{
        background: 'var(--bg, var(--surface))',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12,
        color: 'var(--sub)',
        lineHeight: 1.6,
        borderLeft: '3px solid var(--accent)',
      }}>
        {cloudAlert
          ? `Overcast conditions likely. Recommend pre-charging BESS before ${solarDipHour?.time || '13:00'} and scheduling peak discharge 17–19h for max revenue.`
          : `Clear-to-partly-cloudy forecast. Solar generation tracking nominal. Maintain standard BESS dispatch schedule.`}
      </div>
    </div>
  );
};

const PredictionRow = ({ icon, label, value, warn }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--sub)' }}>
      <span>{icon}</span><span>{label}</span>
    </div>
    <span style={{ fontWeight: 600, color: warn ? '#f59e0b' : 'var(--text)' }}>{value}</span>
  </div>
);

// ─── BESS Block Timeline ──────────────────────────────────────────────────────
const BessTimeline = () => {
  const slotColors = { charge: '#3b82f6', discharge: '#10b981', idle: 'var(--border)' };
  const slotTextColors = { charge: '#fff', discharge: '#fff', idle: 'var(--sub)' };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        🔋 BESS Dispatch Timeline
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--sub)' }}>— Today's optimized schedule</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {BESS_SCHEDULE.map((slot, i) => (
          <div key={i} style={{
            flex: 1, minWidth: 120,
            background: slotColors[slot.action],
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: slotTextColors[slot.action], opacity: 0.8 }}>
              {slot.start} – {slot.end}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: slotTextColors[slot.action] }}>{slot.label}</div>
            {slot.revenue ? (
              <div style={{ fontSize: 11, color: slotTextColors[slot.action], opacity: 0.9, marginTop: 2 }}>
                +€{slot.revenue} est.
              </div>
            ) : (
              <div style={{ fontSize: 11, color: slotTextColors[slot.action], opacity: 0.5 }}>—</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 11, color: 'var(--sub)' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#3b82f6', marginRight: 4 }} />Charging</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#10b981', marginRight: 4 }} />Discharging</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--border)', marginRight: 4 }} />Idle</span>
      </div>
    </div>
  );
};

// ─── Chart Section ────────────────────────────────────────────────────────────
const ChartCard = ({ title, icon, children, height = 200 }) => (
  <div style={{
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
  }}>
    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>{icon}</span>{title}
    </div>
    <div style={{ height }}>{children}</div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ForecastingDashboard() {
  const { t } = useAppStore();
  const [horizon, setHorizon] = useState(24);
  const data = useMemo(() => generateMockForecast(horizon), [horizon]);

  // Current conditions (first data point)
  const now = data[0] || {};
  const prev = data[1] || {};

  // Tick reducer — show every 3h
  const tickFormatter = (val, idx) => idx % 3 === 0 ? val : '';

  const gridColor = 'var(--grid-line, rgba(128,128,128,0.12))';
  const axisColor = 'var(--sub)';

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
            ⚡ Forecasting Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--sub)' }}>
            Solar · Wind · BESS · Day-Ahead Price — AI-enhanced predictions
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--sub)' }}>Horizon:</span>
          {[12, 24, 48].map(h => (
            <button key={h} onClick={() => setHorizon(h)} style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${horizon === h ? 'var(--accent)' : 'var(--border)'}`,
              background: horizon === h ? 'var(--accent)' : 'transparent',
              color: horizon === h ? '#fff' : 'var(--text)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}>{h}h</button>
          ))}
        </div>
      </div>

      {/* ── Weather Widgets Row ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Current Conditions
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <WeatherWidget
            icon="🌡️" label="Temperature"
            value={now.temp} unit="°C"
            trend={`${Math.abs((now.temp - prev.temp) || 0).toFixed(1)}°C`}
            trendDir={now.temp > prev.temp ? 'up' : 'down'}
            color="#f97316"
          />
          <WeatherWidget
            icon="💧" label="Humidity"
            value={now.humidity} unit="%"
            trend={now.humidity > 70 ? 'High' : now.humidity < 40 ? 'Low' : 'Normal'}
            trendDir={now.humidity > 70 ? 'up' : 'down'}
            color="#38bdf8"
          />
          <WeatherWidget
            icon="☁️" label="Cloud Cover"
            value={now.cloudCover} unit="%"
            trend={now.cloudCover > 60 ? 'Heavy cover' : now.cloudCover > 30 ? 'Partly cloudy' : 'Clear'}
            trendDir={now.cloudCover > 60 ? 'up' : 'neutral'}
            color={now.cloudCover > 60 ? '#94a3b8' : '#fbbf24'}
          />
          <WeatherWidget
            icon="🔆" label="UV Index"
            value={now.uvIndex} unit=""
            trend={now.uvIndex >= 7 ? 'Very High' : now.uvIndex >= 4 ? 'Moderate' : 'Low'}
            trendDir={now.uvIndex >= 7 ? 'up' : 'neutral'}
            color="#a78bfa"
          />
          <WeatherWidget
            icon="💨" label="Wind Speed"
            value={now.wind} unit="m/s"
            trend={`${now.windDir || 'NW'} direction`}
            trendDir="neutral"
            color="#34d399"
          />
        </div>
      </div>

      {/* ── AI Panel + BESS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 }}>
        <AIPredictionPanel data={data} />
        <BessTimeline />
      </div>

      {/* ── Charts Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Solar Irradiance */}
        <ChartCard title="Solar Irradiance" icon="☀️" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: axisColor }} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: 10, fill: axisColor }} unit=" W" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="solar" name="Solar" stroke="#f59e0b" strokeWidth={2} fill="url(#solarGrad)" unit=" W/m²" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Day-Ahead Price */}
        <ChartCard title="Day-Ahead Price" icon="📈" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: axisColor }} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: 10, fill: axisColor }} unit="€" />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Peak', fill: '#ef4444', fontSize: 10 }} />
              <Bar dataKey="price" name="Price" fill="url(#priceGrad)" stroke="#a855f7" strokeWidth={1} unit=" €/MWh" radius={[2,2,0,0]} />
              <Line type="monotone" dataKey="price" name="Trend" stroke="#a855f7" strokeWidth={2} dot={false} unit=" €/MWh" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Wind Speed */}
        <ChartCard title="Wind Speed" icon="💨" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: axisColor }} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: 10, fill: axisColor }} unit=" m/s" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="wind" name="Wind" stroke="#38bdf8" strokeWidth={2} fill="url(#windGrad)" unit=" m/s" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Load Forecast */}
        <ChartCard title="Load Forecast" icon="⚡" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: axisColor }} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: 10, fill: axisColor }} unit=" MW" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="load" name="Load" stroke="#10b981" strokeWidth={2} fill="url(#loadGrad)" unit=" MW" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── Combined Overview ── */}
      <ChartCard title="Combined 24h Overview" icon="📊" height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: axisColor }} tickFormatter={tickFormatter} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: axisColor }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: axisColor }} unit="€" />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: axisColor }} />
            <Area yAxisId="left" type="monotone" dataKey="solar" name="Solar (W/m²)" stroke="#f59e0b" fill="#f59e0b22" strokeWidth={2} dot={false} />
            <Area yAxisId="left" type="monotone" dataKey="wind" name="Wind (m/s)" stroke="#38bdf8" fill="#38bdf822" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="price" name="Price (€/MWh)" stroke="#a855f7" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  );
}
