import { useState } from "react";

const accent = "#6366f1";
const card = { background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 24 };

const Input = ({ label, defaultValue, type = "text", placeholder }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 6 }}>{label}</label>
    <input type={type} defaultValue={defaultValue} placeholder={placeholder} style={{
      background: "#0d1117", border: "1px solid #1f2937", borderRadius: 8,
      padding: "9px 12px", color: "#e5e7eb", fontSize: 13, width: "100%", boxSizing: "border-box",
    }} />
  </div>
);

const Toggle = ({ value, onChange, label, desc }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #0d1117" }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      {desc && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{desc}</div>}
    </div>
    <div onClick={() => onChange(!value)} style={{
      width: 40, height: 22, borderRadius: 11, background: value ? accent : "#374151",
      cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0, marginLeft: 16,
    }}>
      <div style={{ position: "absolute", top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </div>
  </div>
);

const apiKeys = [
  { label: "ENTSO-E API Key", key: "ENTSOE_API_KEY", value: "d8c3e2a1-****-****-****-7f4b19e2c0d1", scope: "Price forecasting" },
  { label: "Weather API Key", key: "WEATHER_API_KEY", value: "wapi_**********************8e4f", scope: "Solar irradiance forecast" },
  { label: "OCPP Endpoint", key: "OCPP_URL", value: "wss://ocpp.voltaris.com:9000", scope: "EV Charging" },
  { label: "Modbus Gateway", key: "MODBUS_IP", value: "192.168.1.100:502", scope: "BESS / Inverter comms" },
];

export default function Settings() {
  const [tab, setTab] = useState("profile");
  const [brandColor, setBrandColor] = useState("#6366f1");
  const [saved, setSaved] = useState(false);
  const [notifs, setNotifs] = useState({ email: true, sms: false, daily: true, events: true, maintenance: false });
  const [revealed, setRevealed] = useState({});

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding: 32, color: "#e5e7eb", minHeight: "100vh", background: "#0a0f1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Settings</h1>
      <p style={{ color: "#6b7280", marginBottom: 28 }}>Profile, company, branding, integrations, and notification preferences</p>

      <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "#111827", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid #1f2937" }}>
        {["profile", "company", "notifications", "api-keys"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? accent : "transparent",
            color: tab === t ? "#fff" : "#6b7280",
            border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 500,
            textTransform: t === "api-keys" ? "none" : "capitalize",
          }}>{t === "api-keys" ? "API Keys" : t}</button>
        ))}
      </div>

      {tab === "profile" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Profile Information</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: `${accent}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 700, color: accent,
              }}>FM</div>
              <div>
                <div style={{ fontWeight: 600 }}>Francisco Morais</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>admin@voltaris.com</div>
                <button style={{ fontSize: 11, color: accent, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}>
                  Change avatar
                </button>
              </div>
            </div>
            <Input label="Full Name" defaultValue="Francisco Morais" />
            <Input label="Email Address" defaultValue="admin@voltaris.com" type="email" />
            <Input label="Phone Number" defaultValue="+351 912 345 678" type="tel" />
            <Input label="Current Password" type="password" placeholder="••••••••" />
            <Input label="New Password" type="password" placeholder="••••••••" />
            <button onClick={save} style={{
              background: saved ? "#064e3b" : accent, color: saved ? "#10b981" : "#fff",
              border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 13,
            }}>{saved ? "Saved!" : "Save Changes"}</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Appearance</h2>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 8 }}>Brand Accent Color</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                    style={{ width: 48, height: 36, borderRadius: 6, border: "none", cursor: "pointer", background: "none" }} />
                  <span style={{ fontSize: 13, fontFamily: "monospace" }}>{brandColor}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 8 }}>Timezone</label>
                <select defaultValue="Europe/Amsterdam" style={{
                  background: "#0d1117", border: "1px solid #1f2937", borderRadius: 8,
                  padding: "9px 12px", color: "#e5e7eb", fontSize: 13, width: "100%",
                }}>
                  <option value="Europe/Amsterdam">Europe/Amsterdam (CET)</option>
                  <option value="Europe/Lisbon">Europe/Lisbon (WET)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Two-Factor Auth</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Add an extra layer of security to your account</p>
              <button style={{
                background: "#1e3a5f", color: "#60a5fa", border: "1px solid #1f2937",
                borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13,
              }}>Enable 2FA</button>
            </div>
          </div>
        </div>
      )}

      {tab === "company" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Company Details</h2>
            <Input label="Company Name" defaultValue="Voltaris Energy B.V." />
            <Input label="VAT Number" defaultValue="NL123456789B01" />
            <Input label="Registered Address" defaultValue="Coolsingel 1, 3012 AA Rotterdam" />
            <Input label="Website" defaultValue="https://voltaris.energy" />
            <Input label="Support Email" defaultValue="support@voltaris.energy" />
            <button onClick={save} style={{
              background: saved ? "#064e3b" : accent, color: saved ? "#10b981" : "#fff",
              border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 13,
            }}>{saved ? "Saved!" : "Save"}</button>
          </div>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>System Info</h2>
            {[
              { label: "Platform Version", val: "VoltarisOS v1.2.0" },
              { label: "Backend", val: "FastAPI 0.115 / Python 3.12" },
              { label: "Database", val: "SQLite (production: PostgreSQL)" },
              { label: "Deployed On", val: "Railway.app" },
              { label: "Last Deploy", val: new Date().toLocaleDateString() },
              { label: "Node Count", val: "2 sites, 3 BESS, 6 EV chargers" },
            ].map(m => (
              <div key={m.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #0d1117", fontSize: 13 }}>
                <span style={{ color: "#6b7280" }}>{m.label}</span>
                <span style={{ fontWeight: 500 }}>{m.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Notification Preferences</h2>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Choose how and when to receive alerts</p>
            <Toggle value={notifs.email} onChange={v => setNotifs(p => ({ ...p, email: v }))} label="Email Notifications" desc="All alerts and reports by email" />
            <Toggle value={notifs.sms} onChange={v => setNotifs(p => ({ ...p, sms: v }))} label="SMS Notifications" desc="Critical alerts only" />
            <Toggle value={notifs.daily} onChange={v => setNotifs(p => ({ ...p, daily: v }))} label="Daily Summary Email" desc="Sent at 08:00 local time" />
            <Toggle value={notifs.events} onChange={v => setNotifs(p => ({ ...p, events: v }))} label="Grid Event Notifications" desc="DR events, frequency alerts" />
            <Toggle value={notifs.maintenance} onChange={v => setNotifs(p => ({ ...p, maintenance: v }))} label="Maintenance Reminders" desc="Battery cycles, inverter checks" />
          </div>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Email Configuration</h2>
            <Input label="From Address" defaultValue="noreply@voltaris.energy" />
            <Input label="SMTP Host" defaultValue="smtp.voltaris.energy" />
            <Input label="SMTP Port" defaultValue="587" />
            <Input label="SMTP Username" defaultValue="smtp_user@voltaris.energy" />
            <Input label="SMTP Password" type="password" placeholder="••••••••" />
            <button style={{
              background: "#1f2937", color: "#9ca3af", border: "none",
              borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, marginRight: 10,
            }}>Send Test Email</button>
            <button onClick={save} style={{
              background: saved ? "#064e3b" : accent, color: saved ? "#10b981" : "#fff",
              border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13,
            }}>{saved ? "Saved!" : "Save"}</button>
          </div>
        </div>
      )}

      {tab === "api-keys" && (
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>API Keys & Integrations</h2>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Manage third-party API credentials. Keys are masked — click reveal to view.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {apiKeys.map(k => (
              <div key={k.key} style={{ background: "#0d1117", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{k.label}</div>
                    <div style={{ fontSize: 11, color: "#4b5563" }}>{k.scope}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setRevealed(r => ({ ...r, [k.key]: !r[k.key] }))} style={{
                      background: "#1f2937", color: "#9ca3af", border: "none",
                      borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12,
                    }}>{revealed[k.key] ? "Hide" : "Reveal"}</button>
                    <button style={{
                      background: "#1e3a5f", color: "#60a5fa", border: "none",
                      borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12,
                    }}>Rotate</button>
                  </div>
                </div>
                <div style={{
                  fontFamily: "monospace", fontSize: 13,
                  background: "#111827", borderRadius: 6, padding: "8px 12px",
                  color: revealed[k.key] ? "#e5e7eb" : "#4b5563",
                  letterSpacing: revealed[k.key] ? "normal" : 2,
                }}>
                  {revealed[k.key] ? k.value : "•".repeat(36)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>VoltarisOS API Access</h3>
            <div style={{ background: "#0d1117", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Your personal API token (read-only)</div>
              <div style={{
                fontFamily: "monospace", fontSize: 12, background: "#111827", borderRadius: 6,
                padding: "8px 12px", color: "#6b7280",
              }}>
                vos_sk_live_••••••••••••••••••••••••••••••••
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <button style={{
                  background: accent, color: "#fff", border: "none",
                  borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13,
                }}>Generate New Token</button>
                <button style={{
                  background: "#1f2937", color: "#9ca3af", border: "none",
                  borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13,
                }}>View Docs</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
