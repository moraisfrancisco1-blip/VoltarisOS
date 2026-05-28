import { useEffect, useState } from "react"
import axios from "axios"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

const SEVERITY_STYLE = {
  critical: { bg: "#450a0a", border: "#7f1d1d", color: "#f87171", label: "CRÍTICO" },
  warning: { bg: "#451a03", border: "#78350f", color: "#f59e0b", label: "ATENÇÃO" },
  ok: { bg: "#0a2a1a", border: "#14532d", color: "#4ade80", label: "OK" },
}

const TYPE_ICONS = { battery: "🔋", inverter: "⚡", solar: "☀️" }

const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#0d1525", border: "1px solid #1f2937", borderRadius: "8px", padding: "8px 12px", fontSize: "11px" }}>
      <div style={{ color: "#6b7280", marginBottom: "4px" }}>Mês {label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name}: <span style={{ color: "white", fontWeight: "600" }}>{p.value}%</span></div>
      ))}
    </div>
  )
}

export default function PredictiveMaintenance({ user }) {
  const [assets, setAssets] = useState([])
  const [schedule, setSchedule] = useState([])
  const [selected, setSelected] = useState(null)
  const [degradation, setDegradation] = useState([])
  const color = user?.color || "#4ade80"

  useEffect(() => {
    axios.get("/api/maintenance/assets").then(r => {
      setAssets(r.data.assets || [])
      const critical = r.data.assets?.find(a => a.severity === "critical")
      if (critical) { setSelected(critical); loadDeg(critical.id) }
    }).catch(() => {})
    axios.get("/api/maintenance/schedule").then(r => setSchedule(r.data.schedule || [])).catch(() => {})
  }, [])

  const loadDeg = (id) => {
    axios.get(`/api/maintenance/degradation/${id}`).then(r => setDegradation(r.data.degradation || [])).catch(() => {})
  }

  const selectAsset = (a) => { setSelected(a); loadDeg(a.id) }

  const criticalCount = assets.filter(a => a.severity === "critical").length
  const warningCount = assets.filter(a => a.severity === "warning").length

  return (
    <div style={{ padding: "28px", maxWidth: "1400px" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#451a0333", border: "1px solid #78350f", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "800", margin: 0, letterSpacing: "-0.5px" }}>Predictive Maintenance AI</h1>
          <p style={{ color: "#4b5563", fontSize: "13px", marginTop: "2px" }}>Antecipa falhas antes que aconteçam · ML de degradação</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
          {criticalCount > 0 && (
            <div style={{ padding: "6px 14px", borderRadius: "20px", background: "#450a0a", border: "1px solid #7f1d1d", color: "#f87171", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f87171", animation: "pulse 1s infinite" }} />
              {criticalCount} crítico{criticalCount > 1 ? "s" : ""}
            </div>
          )}
          {warningCount > 0 && (
            <div style={{ padding: "6px 14px", borderRadius: "20px", background: "#451a03", border: "1px solid #78350f", color: "#f59e0b", fontSize: "12px", fontWeight: "700" }}>
              {warningCount} em atenção
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "16px" }}>
        {/* Asset list */}
        <div>
          <div style={{ background: "linear-gradient(135deg,#111827,#0f1724)", borderRadius: "14px", border: "1px solid #1a2234", overflow: "hidden", marginBottom: "16px" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a2234" }}>
              <div style={{ fontWeight: "700", fontSize: "14px" }}>Ativos Monitorizados</div>
              <div style={{ color: "#4b5563", fontSize: "11px" }}>{assets.length} componentes · análise contínua por AI</div>
            </div>
            {assets.map((a, i) => {
              const sev = SEVERITY_STYLE[a.severity]
              const isSelected = selected?.id === a.id
              return (
                <div key={a.id} onClick={() => selectAsset(a)} style={{
                  padding: "14px 20px", cursor: "pointer",
                  background: isSelected ? color + "0a" : "transparent",
                  borderLeft: isSelected ? `3px solid ${color}` : "3px solid transparent",
                  borderBottom: i < assets.length - 1 ? "1px solid #1a2234" : "none",
                  transition: "all 0.12s",
                }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#ffffff05" }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "22px" }}>{TYPE_ICONS[a.type]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: "600", fontSize: "13px" }}>{a.name}</span>
                        <span style={{ color: "#374151", fontSize: "11px" }}>·</span>
                        <span style={{ color: "#6b7280", fontSize: "11px" }}>{a.site}</span>
                        <span style={{ color: "#374151", fontSize: "11px" }}>·</span>
                        <span style={{ color: "#374151", fontSize: "11px" }}>{a.id}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {/* Health bar */}
                        <div style={{ flex: 1, height: "4px", background: "#1f2937", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${a.health}%`,
                            background: a.health > 80 ? "#4ade80" : a.health > 60 ? "#f59e0b" : "#f87171",
                            borderRadius: "4px",
                          }} />
                        </div>
                        <span style={{ color: "#9ca3af", fontSize: "11px", minWidth: "32px" }}>{a.health}%</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ padding: "2px 8px", borderRadius: "6px", background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color, fontSize: "9px", fontWeight: "700", letterSpacing: "0.5px", marginBottom: "4px" }}>
                        {sev.label}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: "10px" }}>Falha 30d: <span style={{ color: sev.color, fontWeight: "700" }}>{a.failure_prob_30d}%</span></div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Schedule */}
          <div style={{ background: "linear-gradient(135deg,#111827,#0f1724)", borderRadius: "14px", border: "1px solid #1a2234", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a2234" }}>
              <div style={{ fontWeight: "700", fontSize: "14px" }}>Agenda de Manutenção AI</div>
            </div>
            {schedule.slice(0, 5).map((s, i) => {
              const sev = SEVERITY_STYLE[s.severity === "planned" ? "ok" : s.severity]
              return (
                <div key={i} style={{ padding: "12px 20px", borderBottom: i < 4 ? "1px solid #1a2234" : "none", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: sev.bg, border: `1px solid ${sev.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ color: sev.color, fontWeight: "800", fontSize: "14px" }}>{s.days_remaining}</div>
                    <div style={{ color: sev.color, fontSize: "8px" }}>dias</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>{s.asset_name} · {s.site}</div>
                    <div style={{ color: "#6b7280", fontSize: "11px" }}>{s.due_date} · {s.type === "preventive" ? "🤖 preventiva" : "📅 programada"}</div>
                  </div>
                  <div style={{ color: "#f59e0b", fontWeight: "700", fontSize: "13px" }}>€{s.estimated_cost}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {selected ? (
            <>
              <div style={{ background: "linear-gradient(135deg,#111827,#0f1724)", borderRadius: "14px", padding: "20px", border: `1px solid ${SEVERITY_STYLE[selected.severity].border}` }}>
                <div style={{ display: "flex", align: "center", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "28px" }}>{TYPE_ICONS[selected.type]}</div>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "15px" }}>{selected.name}</div>
                    <div style={{ color: "#6b7280", fontSize: "11px" }}>{selected.site} · {selected.id}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    { l: "Saúde", v: `${selected.health}%`, c: selected.health > 80 ? "#4ade80" : "#f59e0b" },
                    { l: "Falha 30d", v: `${selected.failure_prob_30d}%`, c: selected.failure_prob_30d > 50 ? "#f87171" : "#f59e0b" },
                    { l: "Falha 90d", v: `${selected.failure_prob_90d?.toFixed(0)}%`, c: "#f59e0b" },
                    { l: "Próx. serviço", v: `${selected.next_service_days}d`, c: selected.next_service_days < 10 ? "#f87171" : "#4ade80" },
                    { l: "Anomalias", v: selected.anomalies, c: selected.anomalies > 0 ? "#f87171" : "#4ade80" },
                    { l: "Idade", v: `${selected.age_months}m`, c: "#9ca3af" },
                  ].map(m => (
                    <div key={m.l} style={{ background: "#0d1525", borderRadius: "8px", padding: "10px", border: "1px solid #1a2234" }}>
                      <div style={{ color: "#374151", fontSize: "10px" }}>{m.l}</div>
                      <div style={{ color: m.c, fontWeight: "800", fontSize: "18px" }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                {selected.severity === "critical" && (
                  <div style={{ marginTop: "14px", padding: "12px", background: "#450a0a", borderRadius: "8px", border: "1px solid #7f1d1d" }}>
                    <div style={{ color: "#f87171", fontWeight: "700", fontSize: "12px", marginBottom: "4px" }}>⚠ AI Alert</div>
                    <div style={{ color: "#fca5a5", fontSize: "11px" }}>Padrão anómalo detetado. Probabilidade de falha crítica: {selected.failure_prob_30d}% nos próximos 30 dias. Recomendo inspeção imediata.</div>
                  </div>
                )}
              </div>

              {/* Degradation chart */}
              {degradation.length > 0 && (
                <div style={{ background: "linear-gradient(135deg,#111827,#0f1724)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234" }}>
                  <div style={{ fontWeight: "700", fontSize: "13px", marginBottom: "4px" }}>Degradação Histórica</div>
                  <div style={{ color: "#4b5563", fontSize: "10px", marginBottom: "12px" }}>Health score ao longo do tempo (%)</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={degradation} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <XAxis dataKey="month" stroke="#1f2937" tick={{ fill: "#374151", fontSize: 9 }} />
                      <YAxis domain={[60, 100]} stroke="#1f2937" tick={{ fill: "#374151", fontSize: 9 }} />
                      <Tooltip content={<CT />} />
                      <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="3 2" />
                      <Line type="monotone" dataKey="health" stroke={SEVERITY_STYLE[selected.severity].color} strokeWidth={2} dot={false} name="Health" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div style={{ background: "linear-gradient(135deg,#111827,#0f1724)", borderRadius: "14px", padding: "40px 20px", border: "1px solid #1a2234", textAlign: "center", color: "#374151" }}>
              Seleciona um ativo para ver o diagnóstico AI
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
