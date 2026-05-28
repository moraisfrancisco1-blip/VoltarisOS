import { useEffect, useState } from "react"
import axios from "axios"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

const mockPrices = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  price: 45 + Math.sin(i / 3) * 25 + Math.random() * 10,
  volume: 100 + Math.random() * 200,
}))

export default function TradingDashboard({ user }) {
  const [prices, setPrices] = useState(mockPrices)
  const [orders, setOrders] = useState([
    { id: 1, type: "BUY", volume: 50, price: 48.2, status: "executed", time: "08:00" },
    { id: 2, type: "SELL", volume: 30, price: 92.5, status: "executed", time: "14:00" },
    { id: 3, type: "SELL", volume: 20, price: 85.0, status: "pending", time: "17:00" },
  ])
  const [form, setForm] = useState({ type: "BUY", volume: "", price: "" })
  const color = user?.color || "#4ade80"

  const currentPrice = prices[new Date().getHours()]?.price || 60
  const avgPrice = (prices.reduce((s, p) => s + p.price, 0) / prices.length).toFixed(2)
  const maxPrice = Math.max(...prices.map(p => p.price)).toFixed(2)
  const minPrice = Math.min(...prices.map(p => p.price)).toFixed(2)

  const placeOrder = () => {
    if (!form.volume || !form.price) return
    setOrders(prev => [...prev, {
      id: Date.now(), type: form.type,
      volume: parseFloat(form.volume), price: parseFloat(form.price),
      status: "pending", time: new Date().toTimeString().slice(0, 5)
    }])
    setForm({ ...form, volume: "", price: "" })
  }

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "6px" }}>📈 Trading Dashboard</h1>
      <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "24px" }}>Day-ahead energy market — NL</p>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Preço Atual", value: `${currentPrice.toFixed(2)} €/MWh`, color },
          { label: "Média 24h", value: `${avgPrice} €/MWh`, color: "#f59e0b" },
          { label: "Máximo", value: `${maxPrice} €/MWh`, color: "#f87171" },
          { label: "Mínimo", value: `${minPrice} €/MWh`, color: "#60a5fa" },
        ].map(k => (
          <div key={k.label} style={{ background: "#111827", borderRadius: "12px", padding: "20px", border: "1px solid #1f2937" }}>
            <div style={{ color: "#6b7280", fontSize: "12px" }}>{k.label}</div>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: k.color, marginTop: "8px" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {/* Price Chart */}
        <div style={{ background: "#111827", borderRadius: "12px", padding: "20px", border: "1px solid #1f2937" }}>
          <h3 style={{ marginBottom: "16px" }}>Preço Day-Ahead (€/MWh)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={prices}>
              <XAxis dataKey="hour" stroke="#374151" tick={{ fill: "#6b7280", fontSize: 10 }} />
              <YAxis stroke="#374151" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: "8px" }} formatter={(v) => [`${v.toFixed(2)} €/MWh`]} />
              <ReferenceLine y={80} stroke="#f87171" strokeDasharray="4 4" label={{ value: "Sell threshold", fill: "#f87171", fontSize: 11 }} />
              <ReferenceLine y={50} stroke="#4ade80" strokeDasharray="4 4" label={{ value: "Buy threshold", fill: "#4ade80", fontSize: 11 }} />
              <Area type="monotone" dataKey="price" stroke={color} fill={color + "22"} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order Form */}
        <div style={{ background: "#111827", borderRadius: "12px", padding: "20px", border: "1px solid #1f2937" }}>
          <h3 style={{ marginBottom: "16px" }}>Nova Ordem</h3>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {["BUY", "SELL"].map(t => (
              <button key={t} onClick={() => setForm({ ...form, type: t })} style={{
                flex: 1, padding: "8px", border: "none", borderRadius: "8px", cursor: "pointer",
                background: form.type === t ? (t === "BUY" ? "#4ade8022" : "#f8717122") : "#1f2937",
                color: form.type === t ? (t === "BUY" ? "#4ade80" : "#f87171") : "#6b7280",
                fontWeight: "600"
              }}>{t}</button>
            ))}
          </div>
          <input placeholder="Volume (kWh)" value={form.volume} onChange={e => setForm({ ...form, volume: e.target.value })}
            style={{ width: "100%", padding: "10px", background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "white", marginBottom: "10px", boxSizing: "border-box" }} />
          <input placeholder="Preço (€/MWh)" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
            style={{ width: "100%", padding: "10px", background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "white", marginBottom: "16px", boxSizing: "border-box" }} />
          <button onClick={placeOrder} style={{
            width: "100%", padding: "12px", borderRadius: "8px", border: "none",
            background: form.type === "BUY" ? "#4ade80" : "#f87171",
            color: "#0a0f1a", fontWeight: "bold", cursor: "pointer"
          }}>
            {form.type === "BUY" ? "Comprar" : "Vender"} Energia
          </button>
        </div>
      </div>

      {/* Order Book */}
      <div style={{ background: "#111827", borderRadius: "12px", border: "1px solid #1f2937", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1f2937" }}>
          <h3>Histórico de Ordens</h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1f2937" }}>
              {["Tipo", "Volume", "Preço", "Status", "Hora"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontSize: "12px", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderBottom: "1px solid #111827" }}>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ color: o.type === "BUY" ? "#4ade80" : "#f87171", fontWeight: "bold" }}>{o.type}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>{o.volume} kWh</td>
                <td style={{ padding: "12px 16px" }}>{o.price} €/MWh</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ background: o.status === "executed" ? "#4ade8022" : "#f59e0b22", color: o.status === "executed" ? "#4ade80" : "#f59e0b", padding: "3px 10px", borderRadius: "20px", fontSize: "12px" }}>
                    {o.status}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "#6b7280" }}>{o.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
