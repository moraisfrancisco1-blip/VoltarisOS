import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { C, PremiumTooltip, axisStyle, gridStyle, glassCard, KpiCard } from "../ChartTheme";

const API = import.meta.env.VITE_API_URL || "";

// kg -> "12.3 kg" / "1.25 t"
const fmtCo2 = (kg) => {
  const v = Number(kg) || 0;
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2)} t` : `${v.toFixed(1)} kg`;
};
const fmtKwh = (kwh) => `${(Number(kwh) || 0).toFixed(1)} kWh`;

const scoreColor = (score) =>
  score === "A+" || score === "A" ? C.green : score === "B" ? C.amber : score === "C" || score === "D" ? C.red : "var(--sub)";

// Carbon page with the tenant's REAL numbers (GET /api/carbon/overview): CO2 avoided
// is the solar energy actually recorded by the tenant's devices times a configurable
// emission factor. Shown when Simulation mode is off; the demo page stays as is.
export default function CarbonReal() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API}/api/carbon/overview`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch(e => { if (e.name !== "AbortError") setError(e.message || "Failed to load"); });
    return () => ctrl.abort();
  }, []);

  const wrap = { padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 };
  const header = (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "var(--text)", letterSpacing: -0.8 }}>Carbon</h1>
      <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 3 }}>
        CO₂ avoided by your solar production · calculated from your connected devices
      </div>
    </div>
  );

  if (error) {
    return (
      <div style={wrap}>
        {header}
        <div style={{ ...glassCard(C.red), color: "var(--sub)", fontSize: 13 }}>
          Could not load carbon data ({error}). Try again in a moment.
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={wrap}>
        {header}
        <div style={{ ...glassCard(C.green), color: "var(--sub)", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  const monthly = (data.monthly || []).map(m => ({ ...m, co2_avoided: Number(m.co2_avoided) || 0 }));
  const sites = data.sites || [];
  const hasProduction = (Number(data.solar_year_kwh) || 0) > 0;

  return (
    <div style={wrap}>
      {header}

      {!hasProduction && (
        <div style={{ ...glassCard(C.amber), color: "var(--sub)", fontSize: 13 }}>
          No solar production has been recorded yet. Once a solar device or inverter reports energy,
          the numbers below start filling in.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <KpiCard label="CO₂ avoided today" value={fmtCo2(data.co2_today_kg)} color={C.green} icon="🌿"
          sub={`${fmtKwh(data.solar_today_kwh)} solar`} />
        <KpiCard label="CO₂ avoided this month" value={fmtCo2(data.co2_month_kg)} color={C.teal} icon="📅"
          sub={`${fmtKwh(data.solar_month_kwh)} solar`} />
        <KpiCard label="CO₂ avoided this year" value={fmtCo2(data.co2_year_kg)} color={C.blue} icon="🌍"
          sub={`${fmtKwh(data.solar_year_kwh)} solar`} />
        <KpiCard label="Certificates (year)" value={`${(Number(data.certificates_year) || 0).toFixed(2)}`} color={C.amber} icon="🏅"
          sub="Estimate: 1 per MWh" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <KpiCard label="Trees equivalent" value={Number(data.trees_equivalent || 0).toLocaleString()} color={C.green} icon="🌳"
          sub="Estimate, per year" />
        <KpiCard label="Car km avoided" value={Number(data.car_km_avoided || 0).toLocaleString()} color={C.purple} icon="🚗"
          sub="Estimate" />
        <KpiCard label="Flight km avoided" value={`${Number(data.flights_avoided || 0).toLocaleString()}`} color={C.sky} icon="✈️"
          sub="Estimate (passenger flight-km)" />
      </div>

      <div style={glassCard(C.green)}>
        <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
          CO₂ avoided per month (kg)
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={monthly} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="month" tick={axisStyle} />
            <YAxis tick={axisStyle} unit=" kg" />
            <Tooltip content={<PremiumTooltip unit=" kg" />} />
            <Bar dataKey="co2_avoided" fill={C.green} name="CO₂ avoided" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={glassCard(C.blue)}>
        <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
          By site (today)
        </div>
        {sites.length === 0 ? (
          <div style={{ color: "var(--sub)", fontSize: 13 }}>No sites yet. Add one on the Sites page.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--sub)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {["Site", "Solar", "CO₂ avoided", "Capacity factor", "Score"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sites.map(s => (
                  <tr key={s.site_id}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text)" }}>{s.name}</td>
                    <td style={{ padding: "10px 12px", color: C.amber }}>{Number(s.solar_kw || 0).toFixed(1)} kW</td>
                    <td style={{ padding: "10px 12px", color: C.green }}>{fmtCo2(s.co2_avoided_kg)}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text)" }}>
                      {s.performance_ratio == null ? "—" : `${s.performance_ratio}%`}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: scoreColor(s.score) }}>{s.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ color: "var(--sub)", fontSize: 11, lineHeight: 1.6 }}>
        CO₂ avoided = real solar energy recorded by your devices × the configured grid emission factor
        (EU average 0.233 kg CO₂e/kWh by default). Certificates, trees, car and flight kilometres are
        estimates derived from that figure, not measurements. Capacity factor = today's energy ÷ (installed kW × hours so far).
      </div>
    </div>
  );
}
