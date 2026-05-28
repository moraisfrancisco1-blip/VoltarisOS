import { useEffect, useState, useRef } from "react"
import axios from "axios"
import { useTranslation } from "../i18n/useTranslation"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

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

const ACTION_COLORS = { BUY: "#4ade80", SELL: "#f87171", HOLD: "#f59e0b" }

export default function AutonomousTrading({ user }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState(null)
  const [log, setLog] = useState([])
  const [config, setConfig] = useState({ sell_min_price: 80, buy_max_price: 50, soc_min: 20, soc_max: 90, max_trade_kwh: 150 })
  const [pnlHistory, setPnlHistory] = useState([])
  const color = user?.color || "#4ade80"
  const logRef = useRef()

  const fetch = () => {
    axios.get("/api/trading-agent/status").then(r => {
      setStatus(r.data)
      setPnlHistory(p => [...p.slice(-29), { t: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), pnl: r.data.pnl }])
    }).catch(() => {})
    axios.get("/api/trading-agent/log").then(r => setLog(r.data.log || [])).catch(() => {})
  }

  useEffect(() => { fetch(); const iv = setInterval(fetch, 4000); return () => clearInterval(iv) }, [])

  const toggle = () => axios.post("/api/trading-agent/toggle").then(fetch)
  const isRunning = status?.status === "running"

  return (
    <div style={{ padding: "28px", maxWidth: "1400px" }}>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#1e3a5f33", border: "1px solid #1e3a5f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.22 4.22l2.12 2.12m11.32 11.32 2.12 2.12M2 12h3m14 0h3M4.22 19.78l2.12-2.12M18.66 5.34l-2.12 2.12"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "800", margin: 0, letterSpacing: "-0.5px" }}>Autonomous Trading Agent</h1>
            <p style={{ color: "var(--sub)", fontSize: "13px", marginTop: "2px" }}>AI executa ordens automaticamente · Override manual disponível</p>
          </div>
        </div>
        <button onClick={toggle} style={{
          padding: "10px 24px", borderRadius: "10px", fontSize: "14px", fontWeight: "700",
          border: "none", cursor: "pointer",
          background: isRunning ? "#450a0a" : "#0a2a1a",
          color: isRunning ? "#f87171" : "#4ade80",
          border: `1px solid ${isRunning ? "#7f1d1d" : "#14532d"}`,
        }}>
          {isRunning ? "⏸ Pausar Agente" : "▶ Ativar Agente"}
        </button>
      </div>

      {/* Status bar */}
      {status && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          {[
            { label: "Estado", value: status.status.toUpperCase(), color: isRunning ? "#4ade80" : "#f59e0b", extra: isRunning ? <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", display: "inline-block", marginRight: "6px", animation: "blink 1s infinite" }} /> : null },
            { label: "P&L Total", value: `€ ${status.pnl?.toFixed(2)}`, color: status.pnl > 0 ? "#4ade80" : "#f87171" },
            { label: "Trades Hoje", value: status.trades_today, color: color },
            { label: "Trades Total", value: status.trades_total, color: "#60a5fa" },
            { label: "Win Rate", value: `${(status.win_rate * 100).toFixed(0)}%`, color: "#a78bfa" },
            { label: "Última Ação", value: status.last_action, color: "var(--sub)", small: true },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--surface)", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)" }}>
              <div style={{ color: "var(--sub)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>{s.label}</div>
              <div style={{ color: s.color, fontWeight: "700", fontSize: s.small ? "11px" : "18px", display: "flex", alignItems: "center" }}>
                {s.extra}{s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", marginBottom: "16px" }}>
        {/* P&L Chart */}
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>P&L em Tempo Real</div>
          <div style={{ color: "var(--sub)", fontSize: "11px", marginBottom: "16px" }}>Lucro acumulado do agente (€)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={pnlHistory} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" stroke="var(--grid-line)" tick={{ fill: "#374151", fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis stroke="var(--grid-line)" tick={{ fill: "#374151", fontSize: 10 }} />
              <Tooltip content={<CT />} />
              <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 2" />
              <Line type="monotone" dataKey="pnl" name="P&L €" stroke="#4ade80" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Config */}
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "16px" }}>Regras do Agente</div>
          {[
            { label: "Vender acima de (€/MWh)", key: "sell_min_price" },
            { label: "Comprar abaixo de (€/MWh)", key: "buy_max_price" },
            { label: "SoC mínimo (%)", key: "soc_min" },
            { label: "SoC máximo (%)", key: "soc_max" },
            { label: "Max trade (kWh)", key: "max_trade_kwh" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: "12px" }}>
              <label style={{ color: "var(--sub)", fontSize: "11px", display: "block", marginBottom: "4px" }}>{f.label}</label>
              <input
                type="number"
                value={config[f.key]}
                onChange={e => setConfig(c => ({ ...c, [f.key]: +e.target.value }))}
                style={{
                  width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                  borderRadius: "6px", padding: "7px 10px", color: "white",
                  fontSize: "13px", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          ))}
          <button onClick={() => axios.post("/api/trading-agent/config", config)} style={{
            width: "100%", padding: "9px", borderRadius: "8px", border: "none",
            background: color + "22", color, fontWeight: "700", fontSize: "13px",
            cursor: "pointer", border: `1px solid ${color}44`,
          }}>{t("save") || "Save Configuration"}</button>
        </div>
      </div>

      {/* Live log */}
      <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <div style={{ fontWeight: "700", fontSize: "14px" }}>Log de Decisões</div>
          {isRunning && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", animation: "blink 1s infinite" }} />}
          <div style={{ color: "#374151", fontSize: "11px" }}>atualiza a cada 4s</div>
        </div>
        <div ref={logRef} style={{ maxHeight: "300px", overflowY: "auto" }}>
          {log.map((entry, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "80px 60px 70px 80px 80px 1fr",
              gap: "12px", padding: "10px 12px", borderRadius: "8px",
              background: i % 2 === 0 ? "var(--surface2)" : "transparent",
              borderLeft: `3px solid ${ACTION_COLORS[entry.action] || "#374151"}`,
              marginBottom: "3px", fontSize: "12px", alignItems: "center",
            }}>
              <div style={{ color: "var(--sub)" }}>{entry.date} {entry.time}</div>
              <div style={{ fontWeight: "700", color: ACTION_COLORS[entry.action] }}>{entry.action}</div>
              <div style={{ color: "white" }}>{entry.qty} kWh</div>
              <div style={{ color: "#f59e0b" }}>€{entry.price}/MWh</div>
              <div style={{ color: entry.pnl >= 0 ? "#4ade80" : "#f87171", fontWeight: "700" }}>
                {entry.pnl >= 0 ? "+" : ""}€{entry.pnl?.toFixed(2)}
              </div>
              <div style={{ color: "#374151", fontSize: "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.reason}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
