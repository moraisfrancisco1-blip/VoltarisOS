import { useState, useEffect } from "react"
import { useAppStore } from "../store/appStore"

// White-label customer portal — shows end-customer view
// Industrial clients see their consumption, savings, carbon offset

const CUSTOMERS = [
  { id: 1, name: "Renault Factory Lisbon", type: "Industrial", contract_kw: 8000, sector: "Automotive", contact: "Ana Ferreira" },
  { id: 2, name: "EDP Office Campus", type: "Commercial", contract_kw: 3500, sector: "Energy", contact: "João Silva" },
  { id: 3, name: "Lidl Distribution Center", type: "Logistics", contract_kw: 5200, sector: "Retail", contact: "Maria Santos" },
  { id: 4, name: "NXP Semiconductors NL", type: "Industrial", contract_kw: 12000, sector: "Tech", contact: "Pieter van Dijk" },
  { id: 5, name: "Siemens Berlin", type: "Industrial", contract_kw: 9800, sector: "Engineering", contact: "Klaus Weber" },
]

function generateCustomerData(seed) {
  const base = 1000 + seed * 234
  return {
    consumption_kwh: base + Math.floor(Math.random() * 200),
    savings_eur: Math.round(base * 0.082),
    carbon_kg: Math.round(base * 0.31),
    peak_kw: Math.round(base / 8 + Math.random() * 50),
    self_sufficiency: 35 + Math.round(Math.random() * 40),
  }
}

const HOURLY = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  consumption: 200 + Math.round(Math.sin(i / 4) * 80 + Math.random() * 60),
  bess_supply: 50 + Math.round(Math.sin(i / 3 + 1) * 40 + Math.random() * 30),
  grid: 150 + Math.round(Math.cos(i / 4) * 50 + Math.random() * 40),
}))

export default function CustomerPortal() {
  const { color } = useAppStore()
  const [selectedCustomer, setSelectedCustomer] = useState(CUSTOMERS[0])
  const [view, setView] = useState("portal") // "portal" | "preview" | "embed"
  const [customerData, setCustomerData] = useState(() => generateCustomerData(1))
  const [whitelabelConfig, setWhitelabelConfig] = useState({
    companyName: "Voltaris Energy",
    primaryColor: "#6366f1",
    logo: "⚡",
    showCarbon: true,
    showSavings: true,
    showForecasting: true,
  })

  useEffect(() => {
    setCustomerData(generateCustomerData(selectedCustomer.id))
  }, [selectedCustomer])

  // Live tick
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000)
    return () => clearInterval(id)
  }, [])

  const embedCode = `<iframe 
  src="https://app.voltaris.io/portal/${selectedCustomer.id}?token=cust_${selectedCustomer.id}_demo"
  width="100%" height="600" 
  style="border:none;border-radius:12px"
  allow="fullscreen">
</iframe>`

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text)", margin: 0 }}>Customer Portal</h1>
          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "12px", background: `${color}18`, color, fontWeight: "700", letterSpacing: "1px" }}>WHITE-LABEL</span>
          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "12px", background: "#f59e0b18", color: "#f59e0b", fontWeight: "700", letterSpacing: "1px" }}>IFRAME READY</span>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--sub)" }}>
          Embeddable white-label portal for industrial clients. Each customer sees their own consumption, savings, carbon offset — branded with your identity.
        </p>
      </div>

      {/* View toggle */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "var(--surface2)", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
        {[["portal", "Portal Builder"], ["preview", "Customer Preview"], ["embed", "Embed Code"]].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "7px 18px", borderRadius: "7px", border: "none",
            background: view === v ? color : "transparent",
            color: view === v ? "#fff" : "var(--sub)",
            cursor: "pointer", fontSize: "12px", fontWeight: view === v ? "600" : "400",
          }}>{l}</button>
        ))}
      </div>

      {view === "portal" && (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "20px" }}>
          {/* Customer list */}
          <div>
            <div style={{ fontSize: "11px", color: "var(--sub)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Customers</div>
            {CUSTOMERS.map(c => (
              <div key={c.id} onClick={() => setSelectedCustomer(c)} style={{
                padding: "12px", borderRadius: "8px", marginBottom: "6px",
                border: selectedCustomer.id === c.id ? `1.5px solid ${color}` : "1px solid var(--border)",
                background: selectedCustomer.id === c.id ? `${color}08` : "var(--surface2)",
                cursor: "pointer", transition: "all 0.15s"
              }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)", marginBottom: "2px" }}>{c.name}</div>
                <div style={{ fontSize: "10px", color: "var(--sub)" }}>{c.type} · {c.sector}</div>
                <div style={{ fontSize: "10px", color: "var(--sub)" }}>{(c.contract_kw / 1000).toFixed(1)} MW contract</div>
              </div>
            ))}
          </div>

          {/* Whitelabel config */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "16px" }}>Brand Configuration</div>
              {[
                { label: "Company Name", key: "companyName", type: "text" },
                { label: "Primary Color", key: "primaryColor", type: "color" },
                { label: "Logo / Icon", key: "logo", type: "text" },
              ].map(field => (
                <div key={field.key} style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "5px" }}>{field.label}</div>
                  {field.type === "color" ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input type="color" value={whitelabelConfig[field.key]}
                        onChange={e => setWhitelabelConfig(c => ({ ...c, [field.key]: e.target.value }))}
                        style={{ width: "36px", height: "36px", borderRadius: "6px", border: "1px solid var(--border)", cursor: "pointer", padding: "2px" }}
                      />
                      <input value={whitelabelConfig[field.key]}
                        onChange={e => setWhitelabelConfig(c => ({ ...c, [field.key]: e.target.value }))}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", outline: "none" }}
                      />
                    </div>
                  ) : (
                    <input value={whitelabelConfig[field.key]}
                      onChange={e => setWhitelabelConfig(c => ({ ...c, [field.key]: e.target.value }))}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
                    />
                  )}
                </div>
              ))}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "8px" }}>Visible Modules</div>
                {[["showCarbon", "Carbon Offset"], ["showSavings", "Cost Savings"], ["showForecasting", "Demand Forecast"]].map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", cursor: "pointer" }}>
                    <input type="checkbox" checked={whitelabelConfig[key]}
                      onChange={e => setWhitelabelConfig(c => ({ ...c, [key]: e.target.checked }))}
                      style={{ accentColor: color }}
                    />
                    <span style={{ fontSize: "12px", color: "var(--text)" }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Mini customer preview */}
            <div style={{
              padding: "16px", borderRadius: "12px", overflow: "hidden",
              border: `2px solid ${whitelabelConfig.primaryColor}`,
              background: "var(--surface2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", padding: "8px 12px", borderRadius: "8px", background: whitelabelConfig.primaryColor }}>
                <span style={{ fontSize: "18px" }}>{whitelabelConfig.logo}</span>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>{whitelabelConfig.companyName}</span>
                <span style={{ marginLeft: "auto", fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>Customer Portal</span>
              </div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)", marginBottom: "10px" }}>{selectedCustomer.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[
                  { label: "Today's Usage", value: `${(customerData.consumption_kwh / 1000).toFixed(1)} MWh`, show: true },
                  { label: "Peak Demand", value: `${customerData.peak_kw} kW`, show: true },
                  whitelabelConfig.showSavings && { label: "Cost Savings", value: `€${customerData.savings_eur}`, show: true },
                  whitelabelConfig.showCarbon && { label: "CO₂ Avoided", value: `${(customerData.carbon_kg / 1000).toFixed(2)} t`, show: true },
                ].filter(Boolean).map(stat => (
                  <div key={stat.label} style={{ padding: "10px", borderRadius: "7px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "10px", color: "var(--sub)" }}>{stat.label}</div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: whitelabelConfig.primaryColor }}>{stat.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "10px", fontSize: "10px", color: "var(--sub)", textAlign: "center" }}>
                Powered by {whitelabelConfig.companyName}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "preview" && (
        <div style={{
          borderRadius: "16px", overflow: "hidden", border: `2px solid ${whitelabelConfig.primaryColor}`,
          background: "var(--surface2)",
        }}>
          {/* Customer portal header */}
          <div style={{ padding: "16px 24px", background: whitelabelConfig.primaryColor, display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px" }}>{whitelabelConfig.logo}</span>
            <span style={{ fontSize: "16px", fontWeight: "700", color: "#fff" }}>{whitelabelConfig.companyName}</span>
            <span style={{ marginLeft: "auto", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>{selectedCustomer.name}</span>
            <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "rgba(255,255,255,0.2)", color: "#fff" }}>Customer Portal</span>
          </div>

          <div style={{ padding: "24px" }}>
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
              {[
                { label: "Today's Consumption", value: `${(customerData.consumption_kwh / 1000).toFixed(1)} MWh`, icon: "⚡" },
                { label: "Self-Sufficiency", value: `${customerData.self_sufficiency}%`, icon: "☀️" },
                whitelabelConfig.showSavings && { label: "Monthly Savings", value: `€${(customerData.savings_eur * 30).toLocaleString()}`, icon: "💰" },
                whitelabelConfig.showCarbon && { label: "CO₂ Avoided YTD", value: `${(customerData.carbon_kg * 365 / 1000).toFixed(1)} t`, icon: "🌱" },
              ].filter(Boolean).map(stat => (
                <div key={stat.label} style={{ padding: "16px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
                  <div style={{ fontSize: "20px", marginBottom: "6px" }}>{stat.icon}</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: whitelabelConfig.primaryColor }}>{stat.value}</div>
                  <div style={{ fontSize: "11px", color: "var(--sub)", marginTop: "2px" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Hourly chart */}
            <div style={{ padding: "20px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)", marginBottom: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "14px" }}>24-Hour Energy Profile</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "100px" }}>
                {HOURLY.map((h, i) => {
                  const maxV = 400
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1px", alignItems: "center" }}>
                      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1px" }}>
                        <div style={{ width: "100%", height: `${(h.bess_supply / maxV) * 85}px`, background: "#10b981", borderRadius: "2px 2px 0 0", opacity: 0.8 }} />
                        <div style={{ width: "100%", height: `${(h.grid / maxV) * 85}px`, background: "#64748b", opacity: 0.5 }} />
                      </div>
                      {i % 4 === 0 && <div style={{ fontSize: "8px", color: "var(--sub)" }}>{String(h.hour).padStart(2, "0")}h</div>}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: "flex", gap: "14px", marginTop: "8px" }}>
                {[["#10b981", "BESS Supply"], ["#64748b", "Grid"]].map(([c, l]) => (
                  <div key={l} style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                    <div style={{ width: "8px", height: "8px", background: c, borderRadius: "2px" }} />
                    <span style={{ fontSize: "11px", color: "var(--sub)" }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {whitelabelConfig.showForecasting && (
              <div style={{ padding: "16px 20px", borderRadius: "10px", background: `${whitelabelConfig.primaryColor}10`, border: `1px solid ${whitelabelConfig.primaryColor}30` }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)", marginBottom: "8px" }}>Tomorrow's Forecast</div>
                <div style={{ fontSize: "12px", color: "var(--sub)" }}>
                  Expected consumption: <strong style={{ color: "var(--text)" }}>{(customerData.consumption_kwh * 1.05 / 1000).toFixed(1)} MWh</strong> ·
                  Projected savings: <strong style={{ color: "#10b981" }}>€{(customerData.savings_eur * 1.08).toFixed(0)}</strong> ·
                  Peak demand window: <strong style={{ color: "var(--text)" }}>16:00–19:00</strong>
                </div>
              </div>
            )}

            <div style={{ marginTop: "16px", textAlign: "center", fontSize: "11px", color: "var(--sub)" }}>
              Powered by {whitelabelConfig.companyName} · Real-time data
            </div>
          </div>
        </div>
      )}

      {view === "embed" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "14px" }}>Embed Code</div>
            <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "10px" }}>
              Select customer:
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
              {CUSTOMERS.map(c => (
                <button key={c.id} onClick={() => setSelectedCustomer(c)} style={{
                  padding: "4px 12px", borderRadius: "20px", border: "none",
                  background: selectedCustomer.id === c.id ? color : "var(--surface)",
                  color: selectedCustomer.id === c.id ? "#fff" : "var(--sub)",
                  cursor: "pointer", fontSize: "11px"
                }}>{c.name.split(" ")[0]}</button>
              ))}
            </div>
            <pre style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px",
              padding: "14px", fontSize: "12px", color: "#10b981", fontFamily: "monospace",
              overflowX: "auto", whiteSpace: "pre-wrap", margin: 0
            }}>
              {embedCode}
            </pre>
            <button onClick={() => navigator.clipboard.writeText(embedCode)} style={{
              marginTop: "10px", padding: "8px 16px", borderRadius: "7px",
              border: `1px solid ${color}40`, background: `${color}10`, color,
              cursor: "pointer", fontSize: "12px", fontWeight: "600"
            }}>
              Copy to Clipboard
            </button>
          </div>

          <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "14px" }}>Access Control</div>
            {[
              { label: "Auth method", value: "JWT token per customer" },
              { label: "Token expiry", value: "30 days (configurable)" },
              { label: "Rate limit", value: "1,000 req/hour" },
              { label: "Allowed origins", value: "CORS whitelist per tenant" },
              { label: "Data scope", value: "Isolated per customer_id" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "12px", color: "var(--sub)" }}>{item.label}</span>
                <span style={{ fontSize: "12px", color: "var(--text)", fontWeight: "500" }}>{item.value}</span>
              </div>
            ))}
            <div style={{ marginTop: "16px", padding: "12px", borderRadius: "8px", background: `${color}08`, border: `1px solid ${color}20` }}>
              <div style={{ fontSize: "12px", color, fontWeight: "600" }}>✓ Zero-trust by design</div>
              <div style={{ fontSize: "11px", color: "var(--sub)", marginTop: "4px" }}>
                Each customer token is scoped to their site IDs only. Operators cannot access other customers' data.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
