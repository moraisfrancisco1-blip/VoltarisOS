import { useState, useEffect } from "react";

const accent = "#6366f1";
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 };

const LineChart = ({ data, color, label, unit, height = 100 }) => {
  if (!data || data.length === 0) return null;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const w = 480, h = height;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d.value - min) / range) * (h - 10) - 5}`);
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--sub)", marginBottom: 6 }}>{label}</div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon fill={`url(#grad-${label})`} points={`0,${h} ${pts.join(" ")} ${w},${h}`} />
        <polyline fill="none" stroke={color} strokeWidth={2} points={pts.join(" ")} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--sub)", marginTop: 2 }}>
        <span>{data[0]?.hour}</span>
        <span>{data[Math.floor(data.length / 2)]?.hour}</span>
        <span>{data[data.length - 1]?.hour}</span>
      </div>
    </div>
  );
};

const generateMockForecast = (siteId) => {
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    irradiance: i >= 6 && i <= 20 ? Math.max(0, Math.sin(((i - 6) / 14) * Math.PI) * 800 + (Math.random() - 0.5) * 60) : 0,
    price: 40 + Math.sin(i / 3) * 25 + (Math.random() - 0.5) * 10,
    wind: 2 + Math.random() * 8,
    load: 200 + Math.sin((i - 8) / 6) * 80 + Math.random() * 20,
    battery_action: i >= 10 && i <= 14 ? "charge" : i >= 17 && i <= 21 ? "discharge" : "idle",
    revenue: i >= 17 && i <= 21 ? (40 + Math.random() * 20) : 0,
  }));

  // Simulate Rotterdam vs Rebordelo slight difference
  if (siteId === 2) {
    hours.forEach(h => {
      h.irradiance *= 0.85;
      h.wind *= 1.4;
    });
  }
  return hours;
};

export default function ForecastingDashboard() {
  const [siteId, setSiteId] = useState(1);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useReal, setUseReal] = useState(false);

  const loadForecast = async (id, real) => {
    setLoading(true);
    setError(null);
    if (real) {
      try {
        const res = await fetch(`/api/forecast/combined/${id}`);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json();
        // Normalize API response to our chart format
        const mapped = (data.hours || data.forecast || []).map(h => ({
          hour: h.hour || h.time,
          irradiance: h.irradiance ?? h.solar_irradiance ?? 0,
          price: h.price ?? h.da_price ?? 0,
          wind: h.wind_speed ?? 0,
          load: h.load ?? 0,
          battery_action: h.recommendation || h.battery_action || "idle",
          revenue: h.expected_revenue ?? 0,
        }));
        setForecast(mapped.length > 0 ? mapped : generateMockForecast(id));
      } catch (e) {
        setError(e.message);
        setForecast(generateMockForecast(id));
      }
    } else {
      await new Promise(r => setTimeout(r, 400));
      setForecast(generateMockForecast(id));
    }
    setLoading(false);
  };

  useEffect(() => { loadForecast(siteId, useReal); }, [siteId, useReal]);

  const actionColor = a => a === "charge" ? "#10b981" : a === "discharge" ? "#f59e0b" : "#374151";
  const actionLabel = a => a === "charge" ? "CHG" : a === "discharge" ? "DIS" : "—";

  const peakSolar = forecast ? Math.round(Math.max(...forecast.map(h => h.irradiance))) : 0;
  const maxPrice = forecast ? Math.round(Math.max(...forecast.map(h => h.price))) : 0;
  const minPrice = forecast ? Math.round(Math.min(...forecast.map(h => h.price))) : 0;
  const estRevenue = forecast ? forecast.reduce((a, h) => a + h.revenue, 0).toFixed(2) : 0;

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Forecasting Dashboard</h1>
          <p style={{ color: "var(--sub)" }}>24h irradiance, price, wind, and BESS dispatch recommendations</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select value={siteId} onChange={e => setSiteId(Number(e.target.value))}
            style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 13 }}>
            <option value={1}>Rotterdam</option>
            <option value={2}>Rebordelo</option>
          </select>
          <button onClick={() => setUseReal(!useReal)} style={{
            background: useReal ? "#064e3b" : "#1f2937", color: useReal ? "#10b981" : "#9ca3af",
            border: `1px solid ${useReal ? "#10b981" : "#374151"}`, borderRadius: 8,
            padding: "8px 14px", fontSize: 13, cursor: "pointer"
          }}>{useReal ? "Live API" : "Simulated"}</button>
          <button onClick={() => loadForecast(siteId, useReal)} style={{
            background: accent, color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 16px", fontSize: 13, cursor: "pointer"
          }}>Refresh</button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#7f1d1d", border: "1px solid #ef4444", borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13, color: "#fca5a5" }}>
          API error: {error}. Showing simulated data.
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Peak Irradiance", value: loading ? "—" : `${peakSolar} W/m²`, color: "#f59e0b" },
          { label: "Max Price", value: loading ? "—" : `€${maxPrice}/MWh`, color: "#ef4444" },
          { label: "Min Price", value: loading ? "—" : `€${minPrice}/MWh`, color: "#10b981" },
          { label: "Est. Revenue", value: loading ? "—" : `€${estRevenue}`, color: accent },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ color: "var(--sub)", fontSize: 12, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: "center", padding: 60, color: "var(--sub)" }}>
          Loading forecast data...
        </div>
      ) : forecast ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div style={card}>
              <LineChart
                data={forecast.map(h => ({ hour: h.hour, value: h.irradiance }))}
                color="#f59e0b" label="Solar Irradiance (W/m²)" unit="W/m²" height={110}
              />
            </div>
            <div style={card}>
              <LineChart
                data={forecast.map(h => ({ hour: h.hour, value: h.price }))}
                color="#6366f1" label="Day-Ahead Price (€/MWh)" unit="€/MWh" height={110}
              />
            </div>
            <div style={card}>
              <LineChart
                data={forecast.map(h => ({ hour: h.hour, value: h.wind }))}
                color="#60a5fa" label="Wind Speed (m/s)" unit="m/s" height={110}
              />
            </div>
            <div style={card}>
              <LineChart
                data={forecast.map(h => ({ hour: h.hour, value: h.load }))}
                color="#10b981" label="Forecasted Load (kW)" unit="kW" height={110}
              />
            </div>
          </div>

          {/* BESS dispatch recommendation */}
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>BESS Dispatch Recommendation</h2>
            <p style={{ color: "var(--sub)", fontSize: 12, marginBottom: 16 }}>Optimal charge/discharge schedule based on price + solar forecast</p>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {forecast.map((h, i) => (
                <div key={i} title={`${h.hour}: ${h.battery_action} | Price: €${h.price.toFixed(0)}/MWh`}
                  style={{
                    width: 32, height: 48, borderRadius: 6,
                    background: actionColor(h.battery_action),
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", cursor: "default"
                  }}>
                  <div style={{ fontSize: 8, color: "#fff", fontWeight: 700 }}>{actionLabel(h.battery_action)}</div>
                  <div style={{ fontSize: 8, color: "#ffffff88", marginTop: 2 }}>{h.hour.slice(0, 2)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--sub)" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#10b981", borderRadius: 2, marginRight: 4 }} />Charge</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#f59e0b", borderRadius: 2, marginRight: 4 }} />Discharge</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#374151", borderRadius: 2, marginRight: 4 }} />Idle</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
