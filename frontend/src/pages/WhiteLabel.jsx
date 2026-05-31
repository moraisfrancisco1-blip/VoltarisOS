import { useState } from "react"

const CARD = {
  background: "rgba(15,18,32,0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "20px",
}

const LABEL = {
  display: "block",
  fontSize: "12px",
  fontWeight: "600",
  color: "rgba(148,163,184,0.6)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "8px",
}

const INPUT = {
  width: "100%",
  background: "rgba(10,12,24,0.98)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  color: "#f1f5f9",
  fontSize: "14px",
  padding: "10px 14px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
}

const TENANTS = [
  { id: "t1", name: "Voltaris Energy", domain: "app.voltaris.io", color: "#4ade80", plan: "Enterprise", users: 24, status: "active" },
  { id: "t2", name: "SolarGrid PT", domain: "solargrid.voltaris.io", color: "#60a5fa", plan: "Pro", users: 8, status: "active" },
  { id: "t3", name: "NordPower AS", domain: "nordpower.voltaris.io", color: "#f59e0b", plan: "Pro", users: 5, status: "pending" },
  { id: "t4", name: "Meridian Energy", domain: "meridian.voltaris.io", color: "#a78bfa", plan: "Starter", users: 3, status: "inactive" },
]

export default function WhiteLabel({ user }) {
  const color = user?.color || "#4ade80"
  const [tab, setTab] = useState("tenants")
  const [tenants, setTenants] = useState(TENANTS)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [saved, setSaved] = useState(false)
  const [logoName, setLogoName] = useState(null)

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

  const statusColor = (s) => s === "active" ? "#4ade80" : s === "pending" ? "#f59e0b" : "#6b7280"

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#f1f5f9" }}>White-label & Multi-tenant</h1>
        <p style={{ margin: "6px 0 0", color: "rgba(148,163,184,0.6)", fontSize: "14px" }}>Manage tenant brands, domains, and feature flags</p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Total Tenants", value: tenants.length, sub: "+1 this month" },
          { label: "Active", value: tenants.filter(t => t.status === "active").length, sub: "running live" },
          { label: "Total Users", value: tenants.reduce((a, t) => a + t.users, 0), sub: "across all tenants" },
          { label: "Pending Setup", value: tenants.filter(t => t.status === "pending").length, sub: "needs action" },
        ].map((s, i) => (
          <div key={i} style={{ ...CARD, marginBottom: 0, textAlign: "center" }}>
            <div style={{ fontSize: "28px", fontWeight: "700", color: i === 0 ? color : i === 1 ? "#4ade80" : i === 2 ? "#60a5fa" : "#f59e0b" }}>{s.value}</div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#f1f5f9", margin: "4px 0 2px" }}>{s.label}</div>
            <div style={{ fontSize: "11px", color: "rgba(148,163,184,0.6)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "rgba(15,18,32,0.92)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
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
            color: tab === t.id ? color : "#6b7280",
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
      {tab === "tenants" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "#f1f5f9" }}>All Tenants</h3>
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
                  <div style={{ fontSize: "15px", fontWeight: "600", color: "#f1f5f9" }}>{t.name}</div>
                  <div style={{ fontSize: "12px", color: "rgba(148,163,184,0.6)", marginTop: "2px" }}>{t.domain}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "13px", color: "rgba(148,163,184,0.6)" }}>{t.plan}</div>
                  <div style={{ fontSize: "11px", color: "rgba(148,163,184,0.6)" }}>Plan</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "13px", color: "rgba(148,163,184,0.6)" }}>{t.users}</div>
                  <div style={{ fontSize: "11px", color: "rgba(148,163,184,0.6)" }}>Users</div>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BRAND CONFIG TAB */}
      {tab === "brand" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Left col */}
          <div>
            <div style={CARD}>
              <h3 style={{ margin: "0 0 20px", fontSize: "15px", color: "#f1f5f9" }}>
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
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: "#f1f5f9" }}>Logo Upload</h3>
              <label style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: "10px", border: "2px dashed #1a2234", borderRadius: "10px", padding: "28px",
                cursor: "pointer", transition: "border-color 0.15s", color: "rgba(148,163,184,0.6)",
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = color + "66"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1a2234"}
              >
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={logoName ? color : "#374151"} strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span style={{ fontSize: "13px", color: logoName ? color : "#6b7280", fontWeight: logoName ? "600" : "400" }}>
                  {logoName || "Click to upload PNG or SVG"}
                </span>
                {!logoName && <span style={{ fontSize: "11px", color: "#374151" }}>Recommended: 200×60px</span>}
              </label>
            </div>
          </div>

          {/* Right col — colors + preview */}
          <div>
            <div style={CARD}>
              <h3 style={{ margin: "0 0 20px", fontSize: "14px", color: "#f1f5f9" }}>Brand Colors</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div>
                  <label style={LABEL}>Primary Color</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="color" value={brandForm.primaryColor}
                      onChange={e => setBrandForm(f => ({ ...f, primaryColor: e.target.value }))}
                      style={{ width: "44px", height: "40px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", background: "rgba(10,12,24,0.98)", cursor: "pointer" }}
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
                      style={{ width: "44px", height: "40px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", background: "rgba(10,12,24,0.98)", cursor: "pointer" }}
                    />
                    <input style={{ ...INPUT, flex: 1 }} value={brandForm.accentColor}
                      onChange={e => setBrandForm(f => ({ ...f, accentColor: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Mini preview */}
              <div style={{ background: "rgba(10,12,24,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "16px" }}>
                <div style={{ fontSize: "11px", color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Preview</div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ flex: 1, background: brandForm.primaryColor + "22", border: `1px solid ${brandForm.primaryColor}44`, borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: brandForm.primaryColor }}>142.3</div>
                    <div style={{ fontSize: "11px", color: "rgba(148,163,184,0.6)" }}>MWh</div>
                  </div>
                  <div style={{ flex: 1, background: brandForm.accentColor + "22", border: `1px solid ${brandForm.accentColor}44`, borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: brandForm.accentColor }}>98.1%</div>
                    <div style={{ fontSize: "11px", color: "rgba(148,163,184,0.6)" }}>Uptime</div>
                  </div>
                </div>
                <div style={{ height: "8px", background: "#1a2234", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: "74%", height: "100%", background: `linear-gradient(90deg, ${brandForm.primaryColor}, ${brandForm.accentColor})`, borderRadius: "4px" }} />
                </div>
                <div style={{ marginTop: "10px", display: "flex", gap: "6px" }}>
                  <button style={{ flex: 1, padding: "7px", background: brandForm.primaryColor + "22", border: `1px solid ${brandForm.primaryColor}44`, borderRadius: "6px", color: brandForm.primaryColor, fontSize: "12px", cursor: "pointer" }}>
                    Primary
                  </button>
                  <button style={{ flex: 1, padding: "7px", background: brandForm.accentColor + "22", border: `1px solid ${brandForm.accentColor}44`, borderRadius: "6px", color: brandForm.accentColor, fontSize: "12px", cursor: "pointer" }}>
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
      )}

      {/* DOMAINS TAB */}
      {tab === "domains" && (
        <div>
          <div style={CARD}>
            <h3 style={{ margin: "0 0 20px", fontSize: "15px", color: "#f1f5f9" }}>Domain Configuration</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {tenants.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 16px", background: "rgba(10,12,24,0.98)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: statusColor(t.status), flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#f1f5f9" }}>{t.domain}</div>
                    <div style={{ fontSize: "12px", color: "rgba(148,163,184,0.6)", marginTop: "2px" }}>{t.name}</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "#4ade8018", color: "#4ade80" }}>SSL Active</span>
                    <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: statusColor(t.status) + "18", color: statusColor(t.status), textTransform: "capitalize" }}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "20px", padding: "16px", background: "rgba(10,12,24,0.98)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: "13px", color: "rgba(148,163,184,0.6)", marginBottom: "12px", fontWeight: "600" }}>Add New Domain</div>
              <div style={{ display: "flex", gap: "10px" }}>
                <input style={{ ...INPUT, flex: 1 }} placeholder="custom.domain.com"
                  onFocus={e => e.target.style.borderColor = color}
                  onBlur={e => e.target.style.borderColor = "#1a2234"}
                />
                <button style={{ padding: "10px 20px", background: color + "22", border: `1px solid ${color}44`, borderRadius: "8px", color, cursor: "pointer", fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap" }}>
                  Provision SSL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEATURES TAB */}
      {tab === "features" && (
        <div style={CARD}>
          <h3 style={{ margin: "0 0 4px", fontSize: "15px", color: "#f1f5f9" }}>Feature Flags per Tenant</h3>
          <p style={{ margin: "0 0 24px", fontSize: "13px", color: "rgba(148,163,184,0.6)" }}>Control which modules each tenant can access</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: "rgba(148,163,184,0.6)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Tenant</th>
                  {["Trading", "Carbon", "Digital Twin", "Maintenance", "AI Copilot", "Forecasting"].map(f => (
                    <th key={f} style={{ textAlign: "center", padding: "10px 14px", color: "rgba(148,163,184,0.6)", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{f}</th>
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
                          <span style={{ color: "#f1f5f9", fontWeight: "500" }}>{t.name}</span>
                        </div>
                      </td>
                      {flags.map((on, fi) => (
                        <td key={fi} style={{ textAlign: "center", padding: "12px 14px" }}>
                          <div style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: "32px", height: "18px", borderRadius: "9px",
                            background: on ? color + "33" : "#1a2234",
                            border: `1px solid ${on ? color + "55" : "#374151"}`,
                            transition: "all 0.2s", cursor: "pointer",
                          }}>
                            <div style={{
                              width: "12px", height: "12px", borderRadius: "50%",
                              background: on ? color : "#374151",
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
      )}
    </div>
  )
}
