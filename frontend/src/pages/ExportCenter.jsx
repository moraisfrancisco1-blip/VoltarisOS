import { useState } from "react"
import { useAppStore } from "../store/appStore"
import { useTranslation } from "../i18n/useTranslation"

const FORMATS = ["PDF", "CSV", "Excel", "JSON"]

export default function ExportCenter({ user }) {
  const { t } = useTranslation()
  const { addToast, addAuditEntry } = useAppStore()
  const color = user?.color || "#4ade80"
  const [format, setFormat] = useState("PDF")
  const [range, setRange] = useState("30d")
  const [selected, setSelected] = useState({})
  const [exporting, setExporting] = useState(null)
  const [includeBranding, setIncludeBranding] = useState(true)

  const EXPORT_ITEMS = [
    { id: "dashboard", label: "Dashboard Overview", desc: t("exp_desc_dashboard") || "Main KPIs, energy charts, battery status", icon: "⊞", category: t("exp_cat_reports") || "Reports" },
    { id: "battery", label: "Battery BMS Report", desc: t("exp_desc_battery") || "Historical SOC, cycles, temperature, cell health", icon: "🔋", category: t("exp_cat_reports") || "Reports" },
    { id: "trading", label: "Trading P&L", desc: t("exp_desc_trading") || "Profit/loss per session, executed orders, market exposure", icon: "📈", category: t("exp_cat_reports") || "Reports" },
    { id: "carbon", label: "Carbon Footprint", desc: t("exp_desc_carbon") || "Avoided emissions, green certificates, monthly comparison", icon: "🌱", category: t("exp_cat_reports") || "Reports" },
    { id: "maintenance", label: "Maintenance Schedule", desc: t("exp_desc_maintenance") || "Maintenance plan, predictive alerts, failure history", icon: "🔧", category: t("exp_cat_reports") || "Reports" },
    { id: "alerts_hist", label: "Alerts History", desc: t("exp_desc_alerts") || "All triggered alerts with timestamp and resolution", icon: "🔔", category: t("exp_cat_operations") || "Operations" },
    { id: "sites", label: "Sites Overview", desc: t("exp_desc_sites") || "Site list, capacity, status, geolocation", icon: "📍", category: t("exp_cat_operations") || "Operations" },
    { id: "users", label: "User Activity", desc: t("exp_desc_users") || "Logins, actions per user, access audit", icon: "👥", category: t("exp_cat_operations") || "Operations" },
    { id: "investor", label: "Investor Report", desc: t("exp_desc_investor") || "Revenue, EBITDA, ROI per project — boardroom format", icon: "💰", category: t("exp_cat_financial") || "Financial" },
    { id: "audit", label: "Audit Log Export", desc: t("exp_desc_audit") || "Complete action log for compliance", icon: "📋", category: t("exp_cat_compliance") || "Compliance" },
  ]

  const toggle = (id) => setSelected(s => ({ ...s, [id]: !s[id] }))

  const doExport = async (item) => {
    setExporting(item.id)
    await new Promise(r => setTimeout(r, 1800))
    setExporting(null)
    addToast(`${item.label} ${t("exported_as") || "exported as"} ${format}`, "success")
    addAuditEntry({ user: user?.email || "admin@voltaris.com", action: "Exported report", resource: item.label })
  }

  const exportAll = async () => {
    const sel = EXPORT_ITEMS.filter(i => selected[i.id])
    if (!sel.length) { addToast(t("exp_select_one") || "Select at least one report", "warning"); return }
    for (const item of sel) await doExport(item)
    addToast(`${sel.length} ${t("exp_files_exported") || "files exported successfully"}`, "success")
  }

  const grouped = {}
  EXPORT_ITEMS.forEach(i => {
    if (!grouped[i.category]) grouped[i.category] = []
    grouped[i.category].push(i)
  })

  const anySelected = Object.values(selected).some(Boolean)

  return (
    <div style={{ padding: "32px", maxWidth: "1000px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "white", fontSize: "24px", fontWeight: "700", marginBottom: "6px" }}>Export Center</h1>
        <p style={{ color: "rgba(148,163,184,0.85)", fontSize: "14px" }}>{t("exp_sub") || "Export any report with custom branding"}</p>
      </div>

      {/* Options bar */}
      <div style={{
        background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "12px", padding: "18px 20px",
        display: "flex", alignItems: "center", gap: "20px",
        marginBottom: "24px", flexWrap: "wrap",
      }}>
        <div>
          <div style={{ color: "rgba(148,163,184,0.85)", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{t("format") || "Format"}</div>
          <div style={{ display: "flex", gap: "6px" }}>
            {FORMATS.map(f => (
              <button key={f} onClick={() => setFormat(f)} style={{
                padding: "6px 14px",
                background: format === f ? `${color}18` : "var(--surface2)",
                border: `1px solid ${format === f ? color + "50" : "#1e2d45"}`,
                borderRadius: "8px", color: format === f ? color : "#6b7280",
                cursor: "pointer", fontSize: "13px", fontWeight: format === f ? "700" : "400",
              }}>{f}</button>
            ))}
          </div>
        </div>

        <div style={{ width: "1px", height: "40px", background: "var(--surface2)" }} />

        <div>
          <div style={{ color: "rgba(148,163,184,0.85)", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{t("period") || "Period"}</div>
          <select value={range} onChange={e => setRange(e.target.value)} style={{
            padding: "7px 14px", background: "var(--surface2)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px",
            color: "white", fontSize: "13px", outline: "none",
          }}>
            <option value="7d">{t("last_7d") || "Last 7 days"}</option>
            <option value="30d">{t("last_30d") || "Last 30 days"}</option>
            <option value="3m">{t("last_3m") || "Last 3 months"}</option>
            <option value="6m">{t("last_6m") || "Last 6 months"}</option>
            <option value="1y">{t("last_1y") || "Last year"}</option>
          </select>
        </div>

        <div style={{ width: "1px", height: "40px", background: "var(--surface2)" }} />

        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={includeBranding}
            onChange={e => setIncludeBranding(e.target.checked)}
            style={{ accentColor: color, width: "16px", height: "16px" }}
          />
          <span style={{ color: "rgba(148,163,184,0.85)", fontSize: "13px" }}>{t("include_branding") || "Include logo & branding"}</span>
        </label>

        <div style={{ marginLeft: "auto" }}>
          {anySelected && (
            <button onClick={exportAll} style={{
              padding: "10px 20px",
              background: `linear-gradient(135deg, ${color}, #22d3ee)`,
              border: "none", borderRadius: "10px",
              color: "#0a0f1a", cursor: "pointer", fontWeight: "700", fontSize: "13px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {t("exp_export_selected") || "Export Selected"}
            </button>
          )}
        </div>
      </div>

      {/* Items by category */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: "28px" }}>
          <div style={{
            color: "#374151", fontSize: "10px", fontWeight: "700",
            textTransform: "uppercase", letterSpacing: "1px",
            marginBottom: "12px",
          }}>{cat}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
            {items.map(item => {
              const isSel = !!selected[item.id]
              const isExp = exporting === item.id
              return (
                <div
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  style={{
                    background: isSel ? `${color}08` : "var(--surface)",
                    border: `1px solid ${isSel ? color + "40" : "#1a2234"}`,
                    borderRadius: "12px", padding: "16px 18px",
                    cursor: "pointer", transition: "all 0.15s",
                    position: "relative", overflow: "hidden",
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = "#2a3a55" }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = "#1a2234" }}
                >
                  {isSel && (
                    <div style={{
                      position: "absolute", top: "10px", right: "10px",
                      width: "18px", height: "18px", borderRadius: "50%",
                      background: color, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0f1a" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "20px" }}>{item.icon}</span>
                    <span style={{ color: "white", fontWeight: "600", fontSize: "14px" }}>{item.label}</span>
                  </div>
                  <div style={{ color: "rgba(148,163,184,0.85)", fontSize: "12px", lineHeight: "1.5", marginBottom: "14px" }}>{item.desc}</div>
                  <button
                    onClick={e => { e.stopPropagation(); doExport(item) }}
                    disabled={isExp}
                    style={{
                      padding: "7px 14px",
                      background: isExp ? "#1a2234" : `${color}12`,
                      border: `1px solid ${isExp ? "#1a2234" : color + "30"}`,
                      borderRadius: "8px", color: isExp ? "#4b5563" : color,
                      cursor: isExp ? "not-allowed" : "pointer",
                      fontSize: "12px", fontWeight: "600",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    {isExp ? (
                      <>
                        <span style={{
                          width: "12px", height: "12px", border: `2px solid ${color}40`,
                          borderTopColor: color, borderRadius: "50%",
                          animation: "spin 0.6s linear infinite", display: "inline-block",
                        }} />
                        {t("exporting") || "Exporting..."}
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        {t("export") || "Export"} {format}
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <style>{`@keyframes spin { to { transform: rotate(360deg) }}`}</style>
    </div>
  )
}
