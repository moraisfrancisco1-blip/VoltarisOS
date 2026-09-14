import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "../i18n/useTranslation"

const ACTION_PREFIX_COLORS = {
  "2fa": "#f59e0b",
  user: "#4ade80",
  trade: "#a78bfa",
  asset: "#22d3ee",
  vpp: "#818cf8",
  settings: "var(--sub)",
  api_key: "#f59e0b",
  export: "#22d3ee",
}

const LOCALES = { pt: "pt-PT", en: "en-GB", fr: "fr-FR", es: "es-ES", nl: "nl-NL" }

const PAGE_SIZE = 50

function actionColor(action) {
  const prefix = (action || "").split(".")[0]
  return ACTION_PREFIX_COLORS[prefix] || "var(--sub)"
}

function toCsv(entries) {
  const header = ["timestamp", "user_email", "action", "target_resource", "target_id", "ip_address"]
  const rows = entries.map(e => header.map(k => JSON.stringify(e[k] ?? "")).join(","))
  return [header.join(","), ...rows].join("\n")
}

export default function AuditLog({ user }) {
  const { t, lang } = useTranslation()
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const color = user?.color || "#4ade80"

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/audit-log?limit=${PAGE_SIZE}&offset=0`)
      const data = await res.json()
      if (!res.ok) {
        setError(res.status === 403 ? t("audit_forbidden") : (data.detail || t("audit_load_error")))
        setEntries([])
        setTotal(0)
        return
      }
      setEntries(data.entries || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error(e)
      setError(t("audit_load_error"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  const fmt = (iso) => {
    const d = new Date(iso)
    return d.toLocaleString(LOCALES[lang] || "en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  const filtered = entries.filter(e => {
    const q = search.toLowerCase()
    if (!q) return true
    return (e.user_email || "").toLowerCase().includes(q)
      || (e.action || "").toLowerCase().includes(q)
      || (e.target_resource || "").toLowerCase().includes(q)
  })

  const todayCount = entries.filter(e => new Date(e.timestamp).toDateString() === new Date().toDateString()).length
  const userCount = new Set(entries.map(e => e.user_email).filter(Boolean)).size
  const ipCount = new Set(entries.map(e => e.ip_address).filter(Boolean)).size

  const exportCsv = () => {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: "32px", maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text)", fontSize: "24px", fontWeight: "700", marginBottom: "6px" }}>{t("audit_title")}</h1>
        <p style={{ color: "var(--sub)", fontSize: "14px" }}>{t("audit_sub")}</p>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", marginBottom: 20, background: "#2d0a0a", border: "1px solid #7f1d1d", borderRadius: 10, color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
        {[
          { label: t("audit_stat_total"), value: total, color: "#818cf8" },
          { label: t("audit_stat_today"), value: todayCount, color: color },
          { label: t("audit_stat_users"), value: userCount, color: "#22d3ee" },
          { label: t("audit_stat_ips"), value: ipCount, color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} style={{
            background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "12px", padding: "18px 20px",
          }}>
            <div style={{ color: s.color, fontSize: "24px", fontWeight: "700" }}>{s.value}</div>
            <div style={{ color: "var(--sub)", fontSize: "12px", marginTop: "4px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "12px", alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sub)" strokeWidth="2"
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            placeholder={t("audit_search_ph")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px 10px 38px",
              background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "10px", color: "var(--text)", fontSize: "14px",
              outline: "none", boxSizing: "border-box",
            }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e => e.target.style.borderColor = "#1a2234"}
          />
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          style={{
            padding: "10px 18px", background: `${color}15`,
            border: `1px solid ${color}30`, borderRadius: "10px",
            color: color, cursor: filtered.length === 0 ? "not-allowed" : "pointer",
            opacity: filtered.length === 0 ? 0.5 : 1,
            fontSize: "13px", fontWeight: "600",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {t("audit_export_csv")}
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "14px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              {[t("audit_col_timestamp"), t("audit_col_user"), t("audit_col_action"), t("audit_col_resource"), t("audit_col_ip")].map(h => (
                <th key={h} style={{
                  padding: "12px 16px", textAlign: "left",
                  color: "var(--sub)", fontSize: "11px", fontWeight: "700",
                  textTransform: "uppercase", letterSpacing: "0.5px",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry, i) => {
              const ac = actionColor(entry.action)
              return (
                <tr
                  key={entry.id}
                  style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid #1a223430" : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#ffffff04"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <td style={{ padding: "12px 16px", color: "var(--sub)", fontSize: "12px", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                    {fmt(entry.timestamp)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{
                        width: "24px", height: "24px", borderRadius: "50%",
                        background: `${color}20`, border: `1px solid ${color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "10px", fontWeight: "700", color: color, flexShrink: 0,
                      }}>{(entry.user_email || "?").charAt(0).toUpperCase()}</div>
                      <span style={{ color: "var(--sub)", fontSize: "13px" }}>{entry.user_email || "—"}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "3px 10px",
                      background: `${ac}18`, border: `1px solid ${ac}30`,
                      borderRadius: "20px", color: ac, fontSize: "12px", fontWeight: "600",
                    }}>{entry.action}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--sub)", fontSize: "13px" }}>
                    {entry.target_resource ? `${entry.target_resource}${entry.target_id ? ` #${entry.target_id}` : ""}` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--sub)", fontSize: "12px", fontFamily: "monospace" }}>{entry.ip_address || "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && !error && (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--sub)" }}>
            {t("audit_empty")}
          </div>
        )}
        {loading && (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--sub)" }}>
            {t("loading")}
          </div>
        )}
      </div>
      {!loading && total > entries.length && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--sub)" }}>
          {t("audit_showing_subset").replace("{shown}", entries.length).replace("{total}", total)}
        </div>
      )}
    </div>
  )
}
