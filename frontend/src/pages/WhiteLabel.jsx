import { useState, useEffect } from "react"
import DemoNotice from "../components/DemoNotice"
import { useAppStore } from "../store/appStore"

import { useTranslation } from "../i18n/useTranslation";

const CARD = {
  background: "var(--surface)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "20px",
}

const LABEL = {
  display: "block",
  fontSize: "12px",
  fontWeight: "600",
  color: "var(--sub)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "8px",
}

const INPUT = {
  width: "100%",
  background: "var(--surface)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "8px",
  color: "var(--text)",
  fontSize: "14px",
  padding: "10px 14px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
}

function FakeTabNotice({ t }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13,
      background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
      {t("demo_whitelabel")}
    </div>
  )
}

const TENANTS = [
  { id: "t1", name: "Voltaris Energy", domain: "app.voltaris.io", color: "#4ade80", plan: "Enterprise", users: 24, status: "active" },
  { id: "t2", name: "SolarGrid PT", domain: "solargrid.voltaris.io", color: "#60a5fa", plan: "Pro", users: 8, status: "active" },
  { id: "t3", name: "NordPower AS", domain: "nordpower.voltaris.io", color: "#f59e0b", plan: "Pro", users: 5, status: "pending" },
  { id: "t4", name: "Meridian Energy", domain: "meridian.voltaris.io", color: "#a78bfa", plan: "Starter", users: 3, status: "inactive" },
]

export default function whitelabel({ user }) {
  const { t } = useTranslation();
  const simMode = useAppStore(s => s.simMode)
  const color = user?.color || "#4ade80"
  // "domains" is the one real, working tab (this tenant's own custom
  // domain, provisioned for real via Railway -- see backend/routers/
  // white_label.py). Tenants/Brand Config/Feature Flags below are a
  // separate, much larger reseller-admin console for managing OTHER
  // tenants that was never built for real and stays behind simMode.
  const [tab, setTab] = useState("domains")
  const [tenants, setTenants] = useState(TENANTS)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [saved, setSaved] = useState(false)
  const [logoName, setLogoName] = useState(null)

  const [domainInfo, setDomainInfo] = useState(null)
  const [domainLoaded, setDomainLoaded] = useState(false)
  const [domainError, setDomainError] = useState("")
  const [newDomainInput, setNewDomainInput] = useState("")
  const [domainBusy, setDomainBusy] = useState(false)

  const loadDomain = async () => {
    setDomainError("")
    try {
      const res = await fetch("/api/white-label/domain")
      const data = await res.json()
      if (!res.ok) {
        if (res.status !== 403) setDomainError(data.detail || t("whitelabel_domain_load_error"))
        return
      }
      setDomainInfo(data)
    } catch (e) {
      console.error(e)
      setDomainError(t("whitelabel_domain_load_error"))
    } finally {
      setDomainLoaded(true)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only (see AuditLog.jsx for why t() must not be a dep)
  useEffect(() => { loadDomain() }, [])

  const requestDomain = async () => {
    if (!newDomainInput.trim()) return
    setDomainBusy(true)
    setDomainError("")
    try {
      const res = await fetch("/api/white-label/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomainInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setDomainError(data.detail?.[0]?.msg || data.detail || t("whitelabel_domain_request_error")); return }
      setDomainInfo(data)
      setNewDomainInput("")
    } catch (e) {
      console.error(e)
      setDomainError(t("whitelabel_domain_request_error"))
    } finally {
      setDomainBusy(false)
    }
  }

  const removeDomain = async () => {
    setDomainBusy(true)
    setDomainError("")
    try {
      const res = await fetch("/api/white-label/domain", { method: "DELETE" })
      if (!res.ok && res.status !== 204) { setDomainError(t("whitelabel_domain_remove_error")); return }
      loadDomain()
    } catch (e) {
      console.error(e)
      setDomainError(t("whitelabel_domain_remove_error"))
    } finally {
      setDomainBusy(false)
    }
  }

  const [brandForm, setBrandForm] = useState({
    tenantName: "",
    domain: "",
    primaryColor: "#4ade80",
    accentColor: "#3b82f6",
    logoUrl: "",
    supportEmail: "",
    plan: "Pro",
    maxUsers: "10",
    features: {
      trading: true,
      carbon: true,
      twin: false,
      maintenance: true,
      ai: false,
    }
  })

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) setLogoName(file.name)
  }

  const selectTenant = (t) => {
    setSelectedTenant(t.id)
    setBrandForm(f => ({ ...f, tenantName: t.name, domain: t.domain, primaryColor: t.color }))
    setTab("brand")
  }

  const statusColor = (s) => s === "active" ? "#4ade80" : s === "pending" ? "#f59e0b" : "var(--sub)"

  // Only the "domains" tab below is real (this tenant's own custom domain).
  // The rest of this page (Tenants/Brand Config/Feature Flags -- a reseller
  // console for managing OTHER tenants) was never built for real and stays
  // behind simMode, same as before -- including its DemoNotice banner and
  // stats row, which (like the original top-level gate this replaced) must
  // only ever show together with simMode, not independently of it.
  const fakeReseller = tab !== "domains"

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1100px" }}>
      {fakeReseller && simMode && <DemoNotice />}
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "var(--text)" }}>white-label & Multi-tenant</h1>
        <p style={{ margin: "6px 0 0", color: "var(--sub)", fontSize: "14px" }}>Manage tenant brands, domains, and feature flags</p>
      </div>

      {/* Stats row — part of the (still fake) reseller console */}
      {fakeReseller && simMode && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
          {[
            { label: "Total Tenants", value: tenants.length, sub: "+1 this month" },
            { label: "Active", value: tenants.filter(t => t.status === "active").length, sub: "running live" },
            { label: "Total Users", value: tenants.reduce((a, t) => a + t.users, 0), sub: "across all tenants" },
            { label: "Pending Setup", value: tenants.filter(t => t.status === "pending").length, sub: "needs action" },
          ].map((s, i) => (
            <div key={i} style={{ ...CARD, marginBottom: 0, textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontWeight: "700", color: i === 0 ? color : i === 1 ? "#4ade80" : i === 2 ? "#60a5fa" : "#f59e0b" }}>{s.value}</div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", margin: "4px 0 2px" }}>{s.label}</div>
              <div style={{ fontSize: "11px", color: "var(--sub)" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
        {[
          { id: "tenants", label: "Tenants" },
          { id: "brand", label: "Brand Config" },
          { id: "domains", label: "Domains & SSL" },
          { id: "features", label: "Feature Flags" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 20px",
            background: tab === t.id ? color + "22" : "none",
            border: tab === t.id ? `1px solid ${color}44` : "1px solid transparent",
            borderRadius: "7px",
            color: tab === t.id ? color : "var(--sub)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: tab === t.id ? "600" : "400",
            transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TENANTS TAB */}
      {tab === "tenants" && (!simMode ? <FakeTabNotice t={t} /> : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "var(--text)" }}>All Tenants</h3>
            <button onClick={() => { setSelectedTenant(null); setBrandForm(f => ({ ...f, tenantName: "", domain: "" })); setTab("brand") }} style={{
              padding: "8px 16px", background: color + "22", border: `1px solid ${color}44`,
              borderRadius: "8px", color, cursor: "pointer", fontSize: "13px", fontWeight: "600",
            }}>
              + New Tenant
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {tenants.map(t => (
              <div key={t.id} style={{ ...CARD, marginBottom: 0, display: "flex", alignItems: "center", gap: "16px", cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = color + "55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1a2234"}
                onClick={() => selectTenant(t)}
              >
                {/* Color dot */}
                <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: t.color + "22", border: `1px solid ${t.color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: t.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text)" }}>{t.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--sub)", marginTop: "2px" }}>{t.domain}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "13px", color: "var(--sub)" }}>{t.plan}</div>
                  <div style={{ fontSize: "11px", color: "var(--sub)" }}>Plan</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "13px", color: "var(--sub)" }}>{t.users}</div>
                  <div style={{ fontSize: "11px", color: "var(--sub)" }}>Users</div>
                </div>
                <div>
                  <span style={{
                    display: "inline-block", padding: "3px 10px", borderRadius: "20px",
                    background: statusColor(t.status) + "18", color: statusColor(t.status),
                    fontSize: "11px", fontWeight: "600", textTransform: "capitalize",
                  }}>
                    {t.status}
                  </span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sub)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* BRAND CONFIG TAB */}
      {tab === "brand" && (!simMode ? <FakeTabNotice t={t} /> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Left col */}
          <div>
            <div style={CARD}>
              <h3 style={{ margin: "0 0 20px", fontSize: "15px", color: "var(--text)" }}>
                {selectedTenant ? `Edit: ${brandForm.tenantName}` : "New Tenant"}
              </h3>

              <div style={{ marginBottom: "16px" }}>
                <label style={LABEL}>Tenant Name</label>
                <input style={INPUT} value={brandForm.tenantName} placeholder="Acme Energy Corp"
                  onChange={e => setBrandForm(f => ({ ...f, tenantName: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = color}
                  onBlur={e => e.target.style.borderColor = "#1a2234"}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={LABEL}>Custom Domain</label>
                <input style={INPUT} value={brandForm.domain} placeholder="app.acme.com"
                  onChange={e => setBrandForm(f => ({ ...f, domain: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = color}
                  onBlur={e => e.target.style.borderColor = "#1a2234"}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={LABEL}>Support Email</label>
                <input style={INPUT} value={brandForm.supportEmail} placeholder="support@acme.com" type="email"
                  onChange={e => setBrandForm(f => ({ ...f, supportEmail: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = color}
                  onBlur={e => e.target.style.borderColor = "#1a2234"}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={LABEL}>Plan</label>
                  <select style={{ ...INPUT, cursor: "pointer" }} value={brandForm.plan}
                    onChange={e => setBrandForm(f => ({ ...f, plan: e.target.value }))}>
                    {["Starter", "Pro", "Enterprise"].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Max Users</label>
                  <input style={INPUT} value={brandForm.maxUsers} type="number" min="1"
                    onChange={e => setBrandForm(f => ({ ...f, maxUsers: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = color}
                    onBlur={e => e.target.style.borderColor = "#1a2234"}
                  />
                </div>
              </div>
            </div>

            {/* Logo upload */}
            <div style={CARD}>
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: "var(--text)" }}>Logo Upload</h3>
              <label style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: "10px", border: "2px dashed #1a2234", borderRadius: "10px", padding: "28px",
                cursor: "pointer", transition: "border-color 0.15s", color: "var(--sub)",
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = color + "66"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1a2234"}
              >
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={logoName ? color : "var(--sub)"} strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span style={{ fontSize: "13px", color: logoName ? color : "var(--sub)", fontWeight: logoName ? "600" : "400" }}>
                  {logoName || "Click to upload PNG or SVG"}
                </span>
                {!logoName && <span style={{ fontSize: "11px", color: "var(--sub)" }}>Recommended: 200×60px</span>}
              </label>
            </div>
          </div>

          {/* Right col — colors + preview */}
          <div>
            <div style={CARD}>
              <h3 style={{ margin: "0 0 20px", fontSize: "14px", color: "var(--text)" }}>Brand Colors</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div>
                  <label style={LABEL}>Primary Color</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="color" value={brandForm.primaryColor}
                      onChange={e => setBrandForm(f => ({ ...f, primaryColor: e.target.value }))}
                      style={{ width: "44px", height: "40px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", background: "var(--surface)", cursor: "pointer" }}
                    />
                    <input style={{ ...INPUT, flex: 1 }} value={brandForm.primaryColor}
                      onChange={e => setBrandForm(f => ({ ...f, primaryColor: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={LABEL}>Accent Color</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="color" value={brandForm.accentColor}
                      onChange={e => setBrandForm(f => ({ ...f, accentColor: e.target.value }))}
                      style={{ width: "44px", height: "40px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", background: "var(--surface)", cursor: "pointer" }}
                    />
                    <input style={{ ...INPUT, flex: 1 }} value={brandForm.accentColor}
                      onChange={e => setBrandForm(f => ({ ...f, accentColor: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Mini preview */}
              <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "16px" }}>
                <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Preview</div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ flex: 1, background: brandForm.primaryColor + "22", border: `1px solid ${brandForm.primaryColor}44`, borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: brandForm.primaryColor }}>142.3</div>
                    <div style={{ fontSize: "11px", color: "var(--sub)" }}>MWh</div>
                  </div>
                  <div style={{ flex: 1, background: brandForm.accentColor + "22", border: `1px solid ${brandForm.accentColor}44`, borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: brandForm.accentColor }}>98.1%</div>
                    <div style={{ fontSize: "11px", color: "var(--sub)" }}>Uptime</div>
                  </div>
                </div>
                <div style={{ height: "8px", background: "#1a2234", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: "74%", height: "100%", background: `linear-gradient(90deg, ${brandForm.primaryColor}, ${brandForm.accentColor})`, borderRadius: "4px" }} />
                </div>
                <div style={{ marginTop: "10px", display: "flex", gap: "6px" }}>
                  <button onClick={() => alert(`Primary color: ${brandForm.primaryColor}`)} style={{ flex: 1, padding: "7px", background: brandForm.primaryColor + "22", border: `1px solid ${brandForm.primaryColor}44`, borderRadius: "6px", color: brandForm.primaryColor, fontSize: "12px", cursor: "pointer" }}>
                    Primary
                  </button>
                  <button onClick={() => alert(`Accent color: ${brandForm.accentColor}`)} style={{ flex: 1, padding: "7px", background: brandForm.accentColor + "22", border: `1px solid ${brandForm.accentColor}44`, borderRadius: "6px", color: brandForm.accentColor, fontSize: "12px", cursor: "pointer" }}>
                    Accent
                  </button>
                </div>
              </div>
            </div>

            <button onClick={handleSave} style={{
              width: "100%", padding: "13px", background: saved ? "#4ade8022" : color + "22",
              border: `1px solid ${saved ? "#4ade8044" : color + "44"}`,
              borderRadius: "10px", color: saved ? "#4ade80" : color,
              fontSize: "14px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s",
            }}>
              {saved ? "✓ Saved successfully" : "Save Brand Config"}
            </button>
          </div>
        </div>
      ))}

      {/* DOMAINS TAB — real, single-tenant (this org's own custom domain) */}
      {tab === "domains" && (
        <div style={CARD}>
          <h3 style={{ margin: "0 0 4px", fontSize: "15px", color: "var(--text)" }}>{t("whitelabel_your_domain") || "Your Custom Domain"}</h3>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--sub)" }}>{t("whitelabel_your_domain_sub") || "Serve VoltarisOS at your own domain instead of voltarisos.com."}</p>

          {domainError && (
            <div style={{ padding: "10px 14px", marginBottom: 16, background: "#2d0a0a", border: "1px solid #7f1d1d", borderRadius: 8, color: "#f87171", fontSize: 13 }}>
              {domainError}
            </div>
          )}

          {!domainLoaded && <div style={{ fontSize: 13, color: "var(--sub)" }}>{t("loading")}</div>}

          {domainLoaded && !domainInfo?.domain && (
            <div style={{ display: "flex", gap: "10px" }}>
              <input style={{ ...INPUT, flex: 1 }} placeholder="app.suaempresa.com"
                value={newDomainInput} onChange={e => setNewDomainInput(e.target.value)}
                onFocus={e => e.target.style.borderColor = color}
                onBlur={e => e.target.style.borderColor = "#1a2234"}
              />
              <button onClick={requestDomain} disabled={domainBusy || !newDomainInput.trim()} style={{
                padding: "10px 20px", background: color + "22", border: `1px solid ${color}44`, borderRadius: "8px",
                color, cursor: domainBusy ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "600",
                whiteSpace: "nowrap", opacity: domainBusy || !newDomainInput.trim() ? 0.6 : 1,
              }}>
                {domainBusy ? (t("loading")) : (t("whitelabel_add_domain") || "Add Domain")}
              </button>
            </div>
          )}

          {domainInfo?.domain && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 16px", background: "var(--surface)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", marginBottom: 16 }}>
                <div style={{
                  width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
                  background: domainInfo.status === "active" ? "#4ade80" : domainInfo.status === "error" ? "#f87171" : "#f59e0b",
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)" }}>{domainInfo.domain}</div>
                  <div style={{ fontSize: "12px", color: "var(--sub)", marginTop: "2px", textTransform: "capitalize" }}>
                    {(t(`whitelabel_status_${domainInfo.status}`) || domainInfo.status || "").replace(/_/g, " ")}
                  </div>
                </div>
                <button onClick={loadDomain} disabled={domainBusy} style={{
                  background: "#1f2937", color: "var(--sub)", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12,
                }}>{t("whitelabel_refresh") || "Refresh"}</button>
                <button onClick={removeDomain} disabled={domainBusy} style={{
                  background: "#2d0a0a", color: "#f87171", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12,
                }}>{t("whitelabel_remove_domain") || "Remove"}</button>
              </div>

              {domainInfo.status === "pending_manual_setup" && (
                <div style={{ padding: "14px 16px", background: "var(--surface)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, color: "var(--sub)" }}>
                  {t("whitelabel_manual_setup_note") || "This instance isn't connected to a domain provider yet — a platform admin needs to finish setting this up. You'll see DNS instructions here automatically once that's done."}
                </div>
              )}

              {domainInfo.cname_target && (
                <div style={{ padding: "14px 16px", background: "var(--surface)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)" }}>
                  <div style={{ fontSize: "13px", color: "var(--sub)", marginBottom: 10, fontWeight: 600 }}>{t("whitelabel_dns_instructions") || "Add these DNS records at your domain provider:"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: "6px 16px", fontSize: 12, fontFamily: "monospace" }}>
                    <div style={{ color: "var(--sub)" }}>CNAME</div>
                    <div style={{ color: "var(--text)" }}>{domainInfo.domain}</div>
                    <div style={{ color: color, wordBreak: "break-all" }}>{domainInfo.cname_target}</div>
                    {domainInfo.verification_host && (
                      <>
                        <div style={{ color: "var(--sub)" }}>TXT</div>
                        <div style={{ color: "var(--text)" }}>{domainInfo.verification_host}</div>
                        <div style={{ color: color, wordBreak: "break-all" }}>{domainInfo.verification_value}</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FEATURES TAB */}
      {tab === "features" && (!simMode ? <FakeTabNotice t={t} /> : (
        <div style={CARD}>
          <h3 style={{ margin: "0 0 4px", fontSize: "15px", color: "var(--text)" }}>Feature Flags per Tenant</h3>
          <p style={{ margin: "0 0 24px", fontSize: "13px", color: "var(--sub)" }}>Control which modules each tenant can access</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: "var(--sub)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>Tenant</th>
                  {["Trading", "Carbon", "Digital Twin", "Maintenance", "AI Copilot", "Forecasting"].map(f => (
                    <th key={f} style={{ textAlign: "center", padding: "10px 14px", color: "var(--sub)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, ti) => {
                  const flags = [true, true, ti < 2, ti < 3, ti < 1, true]
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #0d1525" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                          <span style={{ color: "var(--text)", fontWeight: "500" }}>{t.name}</span>
                        </div>
                      </td>
                      {flags.map((on, fi) => (
                        <td key={fi} style={{ textAlign: "center", padding: "12px 14px" }}>
                          <div style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: "32px", height: "18px", borderRadius: "9px",
                            background: on ? color + "33" : "#1a2234",
                            border: `1px solid ${on ? color + "55" : "var(--sub)"}`,
                            transition: "all 0.2s", cursor: "pointer",
                          }}>
                            <div style={{
                              width: "12px", height: "12px", borderRadius: "50%",
                              background: on ? color : "var(--sub)",
                              transition: "all 0.2s",
                              transform: on ? "translateX(7px)" : "translateX(-7px)",
                            }} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
