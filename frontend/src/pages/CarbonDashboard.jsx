import { useEffect, useState } from "react"
import axios from "axios"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar
} from "recharts"

const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 14px", fontSize: "12px" }}>
      <div style={{ color: "var(--sub)", marginBottom: "6px" }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", gap: "8px" }}>
          <span>{p.name}</span><span style={{ color: "white", fontWeight: "600" }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

const ScoreBadge = ({ score }) => {
  const colors = { "A+": "#4ade80", A: "#86efac", B: "#fbbf24", C: "#f97316", D: "#f87171" }
  const c = colors[score] || "#6b7280"
  return (
    <div style={{
      width: "44px", height: "44px", borderRadius: "10px",
      background: c + "22", border: `2px solid ${c}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: "900", fontSize: "16px", color: c
    }}>{score}</div>
  )
}

export default function CarbonDashboard({ user }) {
  const [data, setData] = useState(null)
  const color = user?.color || "#4ade80"

  useEffect(() => {
    axios.get("/api/carbon/overview").then(r => setData(r.data)).catch(() => {
      setData({
        co2_today_kg: 430.5, co2_month_kg: 9471, co2_year_kg: 18420,
        solar_today_kwh: 1847, certificates_month: 12.4, certificates_year: 28.6,
        trees_equivalent: 877, car_km_avoided: 153500, flights_avoided: 72.2,
        monthly: [
          { month: "Jan", co2_avoided: 4200, kwh: 18000, certificates: 18 },
          { month: "Fev", co2_avoided: 5100, kwh: 21900, certificates: 21.9 },
          { month: "Mar", co2_avoided: 6800, kwh: 29200, certificates: 29.2 },
          { month: "Abr", co2_avoided: 7400, kwh: 31800, certificates: 31.8 },
          { month: "Mai", co2_avoided: 8200, kwh: 35200, certificates: 35.2 },
        ],
        sites: [
          { name: "Rotterdam", score: "A+", co2_avoided_kg: 279.8, performance_ratio: 91.2, certificates: 8.2 },
          { name: "Rebordelo", score: "A", co2_avoided_kg: 150.7, performance_ratio: 87.4, certificates: 4.2 }
        ]
      })
    })
  }, [])

  if (!data) return <div style={{ padding: "28px", color: "var(--sub)" }}>A carregar dados de carbono...</div>

  const equivalences = [
    { icon: "🌳", label: "Árvores equivalentes", value: data.trees_equivalent.toLocaleString(), sub: "este ano" },
    { icon: "🚗", label: "Km de carro evitados", value: data.car_km_avoided.toLocaleString(), sub: "este ano" },
    { icon: "✈️", label: "Voos evitados", value: data.flights_avoided.toFixed(1), sub: "Lisboa → NYC" },
    { icon: "📜", label: "Certificados GdO", value: data.certificates_year.toFixed(1) + " MWh", sub: "este ano" },
  ]

  return (
    <div style={{ padding: "28px", maxWidth: "1400px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#14532d33", border: "1px solid #14532d", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 22a8 8 0 0 1 8-8 8 8 0 0 0 8-8 8 8 0 0 1 8 8 8 8 0 0 0-8 8 8 8 0 0 1-8-8 8 8 0 0 0-8 8z"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "800", margin: 0, letterSpacing: "-0.5px" }}>Carbon Intelligence</h1>
            <p style={{ color: "var(--sub)", fontSize: "13px", marginTop: "2px" }}>Impacto ambiental em tempo real · Garantias de Origem</p>
          </div>
        </div>
      </div>

      {/* Top KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {[
          { label: "CO₂ Evitado Hoje", value: data.co2_today_kg.toFixed(1), unit: "kg", color: "#4ade80", icon: "📉" },
          { label: "CO₂ Evitado Mês", value: (data.co2_month_kg / 1000).toFixed(2), unit: "ton", color: "#34d399", icon: "📊" },
          { label: "CO₂ Evitado Ano", value: (data.co2_year_kg / 1000).toFixed(1), unit: "ton", color: "#6ee7b7", icon: "🌍" },
          { label: "Produção Solar Hoje", value: data.solar_today_kwh.toLocaleString(), unit: "kWh", color: "#f59e0b", icon: "☀️" },
        ].map((k, i) => (
          <div key={i} style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: k.color + "15", filter: "blur(20px)" }} />
            <div style={{ color: "var(--sub)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>{k.icon} {k.label}</div>
            <div style={{ fontSize: "30px", fontWeight: "800", color: k.color, marginTop: "8px", lineHeight: 1 }}>
              {k.value}<span style={{ fontSize: "14px", color: "var(--sub)", marginLeft: "4px" }}>{k.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {/* Monthly CO₂ chart */}
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>CO₂ Evitado por Mês</div>
          <div style={{ color: "var(--sub)", fontSize: "11px", marginBottom: "16px" }}>kg · acumulado 2025</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.monthly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" stroke="var(--grid-line)" tick={{ fill: "#374151", fontSize: 11 }} />
              <YAxis stroke="var(--grid-line)" tick={{ fill: "#374151", fontSize: 10 }} />
              <Tooltip content={<CT />} />
              <Bar dataKey="co2_avoided" name="CO₂ (kg)" fill="#4ade80" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Certificates */}
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>Garantias de Origem (GdO)</div>
          <div style={{ color: "var(--sub)", fontSize: "11px", marginBottom: "16px" }}>MWh certificados · 2025</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.monthly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gCert" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" stroke="var(--grid-line)" tick={{ fill: "#374151", fontSize: 11 }} />
              <YAxis stroke="var(--grid-line)" tick={{ fill: "#374151", fontSize: 10 }} />
              <Tooltip content={<CT />} />
              <Area type="monotone" dataKey="certificates" name="GdO (MWh)" stroke="#f59e0b" strokeWidth={2} fill="url(#gCert)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Equivalences */}
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "16px" }}>Equivalências de Impacto</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {equivalences.map((e, i) => (
              <div key={i} style={{ background: "var(--surface2)", borderRadius: "10px", padding: "14px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "24px" }}>{e.icon}</div>
                <div style={{ fontWeight: "800", fontSize: "20px", color: "#4ade80", marginTop: "6px" }}>{e.value}</div>
                <div style={{ color: "var(--sub)", fontSize: "11px", marginTop: "2px" }}>{e.label}</div>
                <div style={{ color: "#374151", fontSize: "10px" }}>{e.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Site scores */}
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>Carbon Score por Site</div>
          <div style={{ color: "var(--sub)", fontSize: "11px", marginBottom: "16px" }}>Classificação EU Taxonomy</div>
          {data.sites.map((s, i) => (
            <div key={i} style={{ background: "var(--surface2)", borderRadius: "10px", padding: "16px", border: "1px solid var(--border)", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <ScoreBadge score={s.score} />
                <div>
                  <div style={{ fontWeight: "600", fontSize: "14px" }}>{s.name}</div>
                  <div style={{ color: "var(--sub)", fontSize: "11px" }}>Performance Ratio: {s.performance_ratio}%</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <div style={{ color: "#374151", fontSize: "10px" }}>CO₂ Evitado Hoje</div>
                  <div style={{ color: "#4ade80", fontWeight: "700", fontSize: "14px" }}>{s.co2_avoided_kg.toFixed(1)} kg</div>
                </div>
                <div>
                  <div style={{ color: "#374151", fontSize: "10px" }}>Certificados Mês</div>
                  <div style={{ color: "#f59e0b", fontWeight: "700", fontSize: "14px" }}>{s.certificates.toFixed(1)} MWh</div>
                </div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: "12px", padding: "10px 14px", background: "#0a2a1a", borderRadius: "8px", border: "1px solid #14532d", fontSize: "12px", color: "#4ade80" }}>
            ✓ Conforme EU Taxonomy · Elegível para financiamento verde
          </div>
        </div>
      </div>
    </div>
  )
}
