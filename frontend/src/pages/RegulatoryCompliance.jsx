import { useState } from "react"
import { useAppStore } from "../store/appStore"

function daysFromNow(d) {
  const now = new Date()
  const target = new Date(d)
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

const DEADLINES = [
  { id: 1, name: "reg_entso_monthly",    body: "ENTSO-E",   dueDate: "2026-06-30", status: "pending",   type: "report",  country: "EU",   risk: "high",   note: "reg_note_monthly_gen" },
  { id: 2, name: "reg_ren_q2",           body: "REN",       dueDate: "2026-07-15", status: "pending",   type: "report",  country: "PT",   risk: "high",   note: "reg_note_q2" },
  { id: 3, name: "reg_bsc_renewal",      body: "BSC",       dueDate: "2026-09-01", status: "inprogress",type: "cert",    country: "NL",   risk: "medium", note: "reg_note_bsc" },
  { id: 4, name: "reg_iso50001",         body: "ISO",       dueDate: "2026-11-14", status: "pending",   type: "cert",    country: "EU",   risk: "low",    note: "reg_note_iso" },
  { id: 5, name: "reg_go_cert",          body: "AIB",       dueDate: "2026-06-05", status: "done",      type: "cert",    country: "EU",   risk: "none",   note: "reg_note_go" },
  { id: 6, name: "reg_mifid_report",     body: "AFM",       dueDate: "2026-07-31", status: "pending",   type: "report",  country: "NL",   risk: "high",   note: "reg_note_mifid" },
  { id: 7, name: "reg_necp_update",      body: "DGEG",      dueDate: "2026-08-20", status: "inprogress",type: "plan",    country: "PT",   risk: "medium", note: "reg_note_necp" },
  { id: 8, name: "reg_fcr_prequalify",   body: "TenneT",    dueDate: "2026-06-20", status: "done",      type: "cert",    country: "NL",   risk: "none",   note: "reg_note_fcr" },
  { id: 9, name: "reg_gdpr_audit",       body: "AP",        dueDate: "2026-10-01", status: "pending",   type: "audit",   country: "PT",   risk: "medium", note: "reg_note_gdpr" },
  { id: 10,name: "reg_red_ii",           body: "EC",        dueDate: "2026-12-31", status: "inprogress",type: "report",  country: "EU",   risk: "low",    note: "reg_note_red" },
]

const FINES = [
  { name: "reg_fine_mifid",   amount: "€500k–€5M",  probability: 78, if: "reg_fine_if_mifid" },
  { name: "reg_fine_entso",   amount: "€50k–€200k", probability: 45, if: "reg_fine_if_entso" },
  { name: "reg_fine_go",      amount: "€10k–€50k",  probability: 12, if: "reg_fine_if_go" },
]

const statusColor = { done: "#10b981", inprogress: "#f59e0b", pending: "#6b7280" }
const statusBg    = { done: "#10b98118", inprogress: "#f59e0b18", pending: "#6b728018" }
const riskColor   = { high: "#f87171", medium: "#f59e0b", low: "#60a5fa", none: "#10b981" }
const riskBg      = { high: "#f8717118", medium: "#f59e0b18", low: "#60a5fa18", none: "#10b98118" }
const typeIcon    = { report: "📄", cert: "🏅", plan: "📋", audit: "🔍" }

export default function RegulatoryCompliance() {
  const { t } = useAppStore()
  const [filter, setFilter] = useState("all")
  const [selected, setSelected] = useState(null)

  const filtered = filter === "all" ? DEADLINES : DEADLINES.filter(d => d.status === filter)

  const done = DEADLINES.filter(d => d.status === "done").length
  const inprog = DEADLINES.filter(d => d.status === "inprogress").length
  const pending = DEADLINES.filter(d => d.status === "pending").length
  const highRisk = DEADLINES.filter(d => d.risk === "high" && d.status !== "done").length
  const urgent = DEADLINES.filter(d => daysFromNow(d.dueDate) <= 30 && d.status !== "done").length

  const cardStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "22px 26px",
  }

  return (
    <div style={{ padding: "28px 32px", color: "var(--text)", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{t("reg_title")}</h1>
          <p style={{ color: "var(--sub)", fontSize: 14 }}>{t("reg_sub")}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            color: "var(--text)", padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
          }}>{t("reg_export_report")}</button>
          <button style={{
            background: "var(--accent)", border: "none",
            color: "#fff", padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13,
          }}>{t("reg_add_deadline")}</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: t("reg_compliance_score"), value: `${Math.round(done / DEADLINES.length * 100)}%`, color: "#10b981", sub: `${done}/${DEADLINES.length} ${t("reg_complete")}` },
          { label: t("reg_urgent"),           value: urgent,    color: "#f87171", sub: t("reg_due_30d") },
          { label: t("reg_high_risk"),        value: highRisk,  color: "#f87171", sub: t("reg_penalties") },
          { label: t("reg_in_progress"),      value: inprog,    color: "#f59e0b", sub: t("reg_need_action") },
          { label: t("reg_pending"),          value: pending,   color: "#6b7280", sub: t("reg_not_started") },
        ].map(k => (
          <div key={k.label} style={cardStyle}>
            <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Compliance Progress Bar */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>{t("reg_overall_progress")}</h3>
          <span style={{ color: "#10b981", fontWeight: 700 }}>{Math.round(done / DEADLINES.length * 100)}%</span>
        </div>
        <div style={{ height: 12, background: "var(--bg)", borderRadius: 8, overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${done / DEADLINES.length * 100}%`, background: "#10b981", transition: "width 0.5s" }} />
          <div style={{ width: `${inprog / DEADLINES.length * 100}%`, background: "#f59e0b", transition: "width 0.5s" }} />
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 12 }}>
          {[
            { label: t("reg_done"), color: "#10b981", val: done },
            { label: t("reg_in_progress"), color: "#f59e0b", val: inprog },
            { label: t("reg_pending"), color: "#6b7280", val: pending },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
              <span style={{ color: "var(--sub)" }}>{s.label}: </span>
              <span style={{ fontWeight: 700 }}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 20 }}>

        {/* Deadlines table */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>{t("reg_deadlines")}</h3>
            <div style={{ display: "flex", gap: 6 }}>
              {["all", "pending", "inprogress", "done"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: filter === f ? "var(--accent)" : "var(--bg)",
                  color: filter === f ? "#fff" : "var(--sub)",
                }}>
                  {f === "all" ? t("trading_all") : f === "inprogress" ? t("reg_in_progress") : f === "done" ? t("reg_done") : t("reg_pending")}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(item => {
              const days = daysFromNow(item.dueDate)
              const isUrgent = days <= 30 && item.status !== "done"
              return (
                <div key={item.id}
                  onClick={() => setSelected(selected?.id === item.id ? null : item)}
                  style={{
                    padding: "14px 18px", borderRadius: 12, cursor: "pointer",
                    border: `1px solid ${selected?.id === item.id ? "var(--accent)" : isUrgent ? "#f8717130" : "var(--border)"}`,
                    background: selected?.id === item.id ? "var(--bg)" : "transparent",
                    transition: "all 0.15s",
                  }}>
                  <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 80px 90px 90px 80px", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18 }}>{typeIcon[item.type]}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{t(item.name)}</div>
                      <div style={{ color: "var(--sub)", fontSize: 11 }}>{item.body} · {item.country}</div>
                    </div>
                    <span style={{ fontSize: 12, color: isUrgent ? "#f87171" : "var(--sub)", fontWeight: isUrgent ? 700 : 400 }}>
                      {item.status !== "done" ? `${days}d` : "✓"}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--sub)" }}>{new Date(item.dueDate).toLocaleDateString()}</span>
                    <span style={{ background: riskBg[item.risk], color: riskColor[item.risk], padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, textAlign: "center" }}>
                      {item.risk !== "none" ? t(`reg_risk_${item.risk}`) : "✓"}
                    </span>
                    <span style={{ background: statusBg[item.status], color: statusColor[item.status], padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, textAlign: "center" }}>
                      {item.status === "done" ? t("reg_done") : item.status === "inprogress" ? t("reg_wip") : t("reg_pending")}
                    </span>
                  </div>
                  {selected?.id === item.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--sub)" }}>
                      <p style={{ marginBottom: 8 }}>{t(item.note)}</p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                          {t("reg_action_start")}
                        </button>
                        <button style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}>
                          {t("reg_action_assign")}
                        </button>
                        <button style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}>
                          {t("reg_action_docs")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Fine calculator */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={cardStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t("reg_fine_risk")}</h3>
            <p style={{ color: "var(--sub)", fontSize: 12, marginBottom: 16 }}>{t("reg_fine_sub")}</p>
            {FINES.map(f => (
              <div key={f.name} style={{ marginBottom: 14, padding: "12px 14px", background: "var(--bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{t(f.name)}</span>
                  <span style={{ color: "#f87171", fontWeight: 800, fontSize: 14 }}>{f.amount}</span>
                </div>
                <div style={{ color: "var(--sub)", fontSize: 12, marginBottom: 8 }}>{t(f.if)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${f.probability}%`,
                      background: f.probability > 60 ? "#f87171" : f.probability > 40 ? "#f59e0b" : "#10b981",
                    }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: f.probability > 60 ? "#f87171" : "#f59e0b" }}>{f.probability}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Jurisdictions */}
          <div style={cardStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("reg_jurisdictions")}</h3>
            {[
              { flag: "🇪🇺", name: "EU", items: 4, done: 2 },
              { flag: "🇵🇹", name: "Portugal", items: 3, done: 1 },
              { flag: "🇳🇱", name: "Netherlands", items: 3, done: 2 },
            ].map(j => (
              <div key={j.name} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span>{j.flag} {j.name}</span>
                  <span style={{ color: "var(--sub)" }}>{j.done}/{j.items}</span>
                </div>
                <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${j.done / j.items * 100}%`, background: "#10b981", borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
