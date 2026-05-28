import { useEffect, useState } from "react"
import axios from "axios"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"

const KPI = ({ label, value, unit, color, icon }) => (
  <div style={{ background: "#111827", borderRadius: "12px", padding: "20px", border: "1px solid #1f2937" }}>
    <div style={{ color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>{icon} {label}</div>
    <div style={{ fontSize: "28px", fontWeight: "bold", color: color || "white", marginTop: "8px" }}>{value}</div>
    <div style={{ color: "#6b7280", fontSize: "12px" }}>{unit}</div>
  </div>
)

export default function Dashboard({ user }) {
  const [simulation, setSimulation] = useState(null)
  const [decision, setDecision] = useState(null)
  const color = user?.color || "#4ade80"

  useEffect(() => {
    axios.get("/simulation").then(r => setSimulation(r.data)).catch(() => {})
    axios.get("/ai_decision?price=75&battery=0.5").then(r => setDecision(r.data.decision)).catch(() => {})
  }, [])

  const chartData = simulation?.timeseries?.map((t, i) => ({
    time: `${i}h`,
    solar: simulation.solar?.[i] || 0,
    load: simulation.load?.[i] || 0,
    grid: simulation.grid?.[i] || 0,
    battery: (simulation.battery?.[i] || 0) * 100,
  })) || []

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>⚡ Dashboard</h1>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>Overview em tempo real — {new Date().toLocaleDateString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <KPI icon="☀️" label="Solar" value={simulation ? (simulation.solar?.[0] || 0).toFixed(1) : "—"} unit="kW atual" color={color} />
        <KPI icon="🔋" label="Bateria" value={simulation ? ((simulation.battery?.[0] || 0) * 100).toFixed(0) : "—"} unit="% SoC" color="#60a5fa" />
        <KPI icon="🔌" label="Rede" value={simulation ? (simulation.grid?.[0] || 0).toFixed(1) : "—"} unit="kW" color="#f59e0b" />
        <KPI icon="🏠" label="Consumo" value={simulation ? (simulation.load?.[0] || 0).toFixed(1) : "—"} unit="kW" color="#a78bfa" />
        <KPI icon="🤖" label="AI Decision" value={decision || "—"} unit="recomendação" color={decision === "charge" ? "#4ade80" : decision === "discharge" ? "#f87171" : "#f59e0b"} />
        <KPI icon="💶" label="Preço" value="74.2" unit="€/MWh" color="#34d399" />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={{ background: "#111827", borderRadius: "12px", padding: "20px", border: "1px solid #1f2937" }}>
          <h3 style={{ marginBottom: "16px", color: "#d1d5db" }}>Produção Solar vs Consumo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <XAxis dataKey="time" stroke="#374151" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis stroke="#374151" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: "8px" }} />
              <Area type="monotone" dataKey="solar" stroke={color} fill={color + "22"} name="Solar (kW)" />
              <Area type="monotone" dataKey="load" stroke="#a78bfa" fill="#a78bfa22" name="Consumo (kW)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#111827", borderRadius: "12px", padding: "20px", border: "1px solid #1f2937" }}>
          <h3 style={{ marginBottom: "16px", color: "#d1d5db" }}>Estado da Bateria (SoC %)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="time" stroke="#374151" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke="#374151" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: "8px" }} />
              <Line type="monotone" dataKey="battery" stroke="#60a5fa" dot={false} name="SoC %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
