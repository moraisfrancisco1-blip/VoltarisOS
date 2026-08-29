import { useState, useEffect } from "react";
import {
  ComposedChart, Bar, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { C, PremiumTooltip, axisStyle, gridStyle, glassCard } from "../components/ChartTheme";

const API = import.meta.env.VITE_API_URL || "";

const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

// Open-Meteo hourly time is ISO-ish "YYYY-MM-DDTHH:00".
function fmtHour(iso) {
  if (typeof iso !== "string") return iso;
  const idx = iso.indexOf("T");
  return idx >= 0 ? iso.slice(idx + 1, idx + 6) : iso;
}

export default function ForecastingDashboard() {
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [horizon, setHorizon] = useState(48);
  const [forecast, setForecast] = useState(null);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [error, setError] = useState(null);

  const loadSites = async () => {
    setLoadingSites(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/sites`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setSites(list);
      if (list.length > 0) {
        setSelectedSiteId(list[0].id);
      }
    } catch (e) {
      setError("Não foi possível carregar os sites.");
    } finally {
      setLoadingSites(false);
    }
  };

  const loadForecast = async (siteId, hours) => {
    if (!siteId) { setForecast(null); return; }
    setLoadingForecast(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/forecast/combined/${siteId}?hours=${hours}`);
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).detail || ""; } catch (e) { /* ignore */ }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setForecast(data);
    } catch (e) {
      setError(`Não foi possível obter a previsão: ${e.message}`);
      setForecast(null);
    } finally {
      setLoadingForecast(false);
    }
  };

  useEffect(() => { loadSites(); }, []);

  useEffect(() => {
    if (selectedSiteId != null) loadForecast(selectedSiteId, horizon);
  }, [selectedSiteId, horizon]);

  const series = Array.isArray(forecast && forecast.forecast)
    ? forecast.forecast.map(e => ({
        label: fmtHour(e.time),
        solar: e.estimated_kwh ?? 0,
        price: e.price_eur_mwh,
        temp: e.temperature_c,
        irradiance: e.irradiance_wm2,
      }))
    : [];

  const totalKwh = series.reduce((a, e) => a + (e.solar || 0), 0);
  const peakSolar = series.reduce((a, e) => Math.max(a, e.solar || 0), 0);
  const installed = forecast ? forecast.solar_kw_installed : null;
  const bess = forecast ? forecast.battery_kwh : null;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Forecasting</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}>
            Solar production forecast{forecast && forecast.site_name ? ` · ${forecast.site_name}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={selectedSiteId ?? ""} onChange={e => setSelectedSiteId(Number(e.target.value))}
            disabled={loadingSites || sites.length === 0}
            style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: 13 }}>
            {sites.length === 0 && <option value="">No sites</option>}
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {[24, 48].map(h => (
            <button key={h} onClick={() => setHorizon(h)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              background: horizon === h ? C.indigo : "var(--surface2)",
              color: horizon === h ? "#fff" : "rgba(148,163,184,0.85)",
              border: `1px solid ${horizon === h ? C.indigo : "var(--surface2)"}`,
            }}>{h}h</button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "#ef444418", border: "1px solid #ef4444", color: C.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Installed Solar", value: installed != null ? `${installed} kW` : "—", color: C.amber },
          { label: "BESS Capacity", value: bess != null ? `${bess} kWh` : "—", color: C.purple },
          { label: "Forecast Total", value: series.length ? `${totalKwh.toFixed(1)} kWh` : "—", color: C.green },
          { label: "Peak Solar", value: series.length ? `${peakSolar.toFixed(1)} kW` : "—", color: C.blue },
        ].map(k => (
          <div key={k.label} style={glassCard(k.color)}>
            <div style={label}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {loadingSites ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Carregando sites…</div>
      ) : sites.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>
          Sem sites disponíveis. Cria um site primeiro para gerar previsões.
        </div>
      ) : loadingForecast ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>A calcular previsão…</div>
      ) : !forecast || series.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>
          Previsão não disponível para este site.
        </div>
      ) : (
        <>
          {/* Main chart: solar production + price */}
          <div style={glassCard(C.amber)}>
            <div style={{ ...label, marginBottom: 12 }}>Solar Forecast &amp; Price ({horizon}h)</div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                <XAxis dataKey="label" tick={axisStyle} minTickGap={24} />
                <YAxis yAxisId="gen" tick={axisStyle} unit=" kWh" />
                <YAxis yAxisId="price" orientation="right" tick={axisStyle} unit=" €" />
                <Tooltip content={<PremiumTooltip />} />
                <Bar yAxisId="gen" dataKey="solar" fill={C.amber} fillOpacity={0.85} radius={[4, 4, 0, 0]} name="Solar (kWh)" />
                <Line yAxisId="price" type="monotone" dataKey="price" stroke={C.green} strokeWidth={2.5} dot={false} name="Price €/MWh" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Weather trend: temperature + irradiance */}
          <div style={glassCard(C.blue)}>
            <div style={{ ...label, marginBottom: 12 }}>Weather Trend (from forecast)</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                <XAxis dataKey="label" tick={axisStyle} minTickGap={24} />
                <YAxis yAxisId="t" tick={axisStyle} unit="°C" />
                <YAxis yAxisId="irr" orientation="right" tick={axisStyle} />
                <Tooltip content={<PremiumTooltip />} />
                <Area yAxisId="t" type="monotone" dataKey="temp" stroke={C.red} fill={C.red} fillOpacity={0.15} name="Temp °C" />
                <Area yAxisId="irr" type="monotone" dataKey="irradiance" stroke={C.blue} fill={C.blue} fillOpacity={0.2} name="Irradiance W/m²" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
