import { useState } from "react";
import { useAppStore, THEMES } from "../store/appStore";
import { useTranslation } from "../i18n/useTranslation";
import { LANGUAGES } from "../i18n/translations";

// ─── Mini design tokens ────────────────────────────────────────────────────────
const BG    = "rgba(10,12,24,0.98)";
const SURF  = "rgba(15,18,32,0.92)";
const SURF2 = "rgba(255,255,255,0.04)";
const BORD  = "#1a2234";
const SUB   = "#6b7280";
const DANG  = "#ef4444";

// ─── Shared components ────────────────────────────────────────────────────────
const card = {
  background: SURF, border: `1px solid ${BORD}`, borderRadius: 12, padding: 24,
};

const Input = ({ label, value, onChange, type = "text", placeholder, unit, readOnly }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ fontSize: 12, color: SUB, display: "block", marginBottom: 6 }}>{label}</label>}
    <div style={{ display: "flex", alignItems: "center" }}>
      <input
        type={type} value={value} onChange={onChange ? e => onChange(e.target.value) : undefined}
        defaultValue={value === undefined ? undefined : undefined}
        placeholder={placeholder} readOnly={readOnly}
        style={{
          background: SURF2, border: `1px solid ${BORD}`, borderRadius: 8,
          padding: "9px 12px", color: readOnly ? SUB : "#e5e7eb", fontSize: 13,
          width: "100%", boxSizing: "border-box",
          borderRight: unit ? "none" : undefined, borderTopRightRadius: unit ? 0 : 8, borderBottomRightRadius: unit ? 0 : 8,
        }}
      />
      {unit && (
        <div style={{
          background: "#1f2937", border: `1px solid ${BORD}`, borderLeft: "none",
          borderRadius: "0 8px 8px 0", padding: "9px 12px", fontSize: 12, color: SUB, whiteSpace: "nowrap",
        }}>{unit}</div>
      )}
    </div>
  </div>
);

const NumInput = ({ label, value, onChange, min, max, step = 1, unit }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ fontSize: 12, color: SUB, display: "block", marginBottom: 6 }}>{label}</label>}
    <div style={{ display: "flex", alignItems: "center" }}>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          background: SURF2, border: `1px solid ${BORD}`, borderRadius: unit ? "8px 0 0 8px" : 8,
          borderRight: unit ? "none" : undefined,
          padding: "9px 12px", color: "#f1f5f9", fontSize: 13, width: "100%", boxSizing: "border-box",
        }}
      />
      {unit && (
        <div style={{
          background: "#1f2937", border: `1px solid ${BORD}`, borderLeft: "none",
          borderRadius: "0 8px 8px 0", padding: "9px 12px", fontSize: 12, color: SUB, whiteSpace: "nowrap",
        }}>{unit}</div>
      )}
    </div>
  </div>
);

const Toggle = ({ value, onChange, label, desc, accent }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${BORD}` }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      {desc && <div style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", marginTop: 2 }}>{desc}</div>}
    </div>
    <div onClick={() => onChange(!value)} style={{
      width: 40, height: 22, borderRadius: 11, background: value ? accent : "#374151",
      cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0, marginLeft: 16,
    }}>
      <div style={{ position: "absolute", top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </div>
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ fontSize: 12, color: SUB, display: "block", marginBottom: 6 }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      background: SURF2, border: `1px solid ${BORD}`, borderRadius: 8,
      padding: "9px 12px", color: "#f1f5f9", fontSize: 13, width: "100%", cursor: "pointer",
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Slider = ({ label, value, onChange, min, max, step = 1, unit, accent }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
      <label style={{ fontSize: 12, color: SUB }}>{label}</label>
      <span style={{ fontSize: 12, color: accent, fontWeight: 600 }}>{value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
      style={{ width: "100%", accentColor: accent, cursor: "pointer" }} />
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(148,163,184,0.6)", marginTop: 2 }}>
      <span>{min}{unit}</span><span>{max}{unit}</span>
    </div>
  </div>
);

const SectionTitle = ({ children }) => (
  <h3 style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, marginTop: 20 }}>{children}</h3>
);

const InfoRow = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORD}`, fontSize: 13 }}>
    <span style={{ color: SUB }}>{label}</span>
    <span style={{ fontWeight: 500 }}>{value}</span>
  </div>
);

const Btn = ({ children, onClick, variant = "primary", accent, style: s }) => {
  const styles = {
    primary:   { background: accent, color: "#000", border: "none" },
    secondary: { background: "#1f2937", color: "rgba(148,163,184,0.6)", border: "none" },
    danger:    { background: "#450a0a", color: DANG, border: `1px solid #7f1d1d` },
    outline:   { background: "transparent", color: accent, border: `1px solid ${accent}` },
  };
  return (
    <button onClick={onClick} style={{
      ...styles[variant], borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 500, ...s,
    }}>{children}</button>
  );
};

// ─── Reactive widget row (needs its own component for hook rules) ─────────────
function DashWidgetRow({ wkey, label, accent }) {
  const val = useAppStore(s => s.dashWidgets[wkey]);
  const setDashWidget = useAppStore(s => s.setDashWidget);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${BORD}` }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <div onClick={() => setDashWidget(wkey, !val)} style={{
        width: 34, height: 18, borderRadius: 9, background: val ? accent : "#374151",
        cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{ position: "absolute", top: 2, left: val ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </div>
    </div>
  );
}

// ─── API Keys data ────────────────────────────────────────────────────────────
const API_KEYS = [
  { label: "ENTSO-E API Key", key: "ENTSOE_API_KEY", value: "d8c3e2a1-****-****-****-7f4b19e2c0d1", scope: "Price forecasting" },
  { label: "Weather API Key", key: "WEATHER_API_KEY", value: "wapi_**********************8e4f", scope: "Solar irradiance forecast" },
  { label: "OCPP Endpoint", key: "OCPP_URL", value: "wss://ocpp.voltaris.com:9000", scope: "EV Charging" },
  { label: "Modbus Gateway", key: "MODBUS_IP", value: "192.168.1.100:502", scope: "BESS / Inverter comms" },
];

// ─── Tab definitions (icon + key) ─────────────────────────────────────────────
const TABS = [
  { id: "profile",       icon: "👤" },
  { id: "company",       icon: "🏢" },
  { id: "appearance",    icon: "🎨" },
  { id: "language",      icon: "🌐" },
  { id: "energy",        icon: "⚡" },
  { id: "trading",       icon: "📈" },
  { id: "notifications", icon: "🔔" },
  { id: "security",      icon: "🔒" },
  { id: "billing",       icon: "💳" },
  { id: "data",          icon: "🗄️" },
  { id: "api-keys",      icon: "🔑" },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function Settings() {
  const { t } = useTranslation();
  const accent     = useAppStore(s => s.accentColor);
  const theme      = useAppStore(s => s.theme);
  const setTheme   = useAppStore(s => s.setTheme);
  const accentColor  = useAppStore(s => s.accentColor);
  const setAccent  = useAppStore(s => s.setAccentColor);
  const density    = useAppStore(s => s.density);
  const setDensity = useAppStore(s => s.setDensity);
  const animations = useAppStore(s => s.animations);
  const setAnimations = useAppStore(s => s.setAnimations);
  const sidebarDefaultCollapsed = useAppStore(s => s.sidebarDefaultCollapsed);
  const setSidebarDefaultCollapsed = useAppStore(s => s.setSidebarDefaultCollapsed);
  const language   = useAppStore(s => s.language);
  const setLanguage = useAppStore(s => s.setLanguage);
  const energySettings  = useAppStore(s => s.energySettings);
  const setEnergySettings = useAppStore(s => s.setEnergySettings);
  const tradingSettings = useAppStore(s => s.tradingSettings);
  const setTradingSettings = useAppStore(s => s.setTradingSettings);
  const alertSettings   = useAppStore(s => s.alertSettings);
  const setAlertSettings = useAppStore(s => s.setAlertSettings);

  const [tab, setTab]       = useState("profile");
  const [saved, setSaved]   = useState(false);
  const [revealed, setRevealed] = useState({});
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(60);
  const [ipWhitelist, setIpWhitelist] = useState("91.122.45.0/24\n195.83.0.1");

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const tabLabel = (id) => {
    const map = {
      "profile": t("settings_profile"), "company": t("settings_company"),
      "appearance": t("settings_appearance"), "language": t("language"),
      "energy": t("settings_energy"), "trading": t("settings_trading"),
      "notifications": t("settings_notifications"), "security": t("settings_security"),
      "billing": t("settings_billing"), "data": t("settings_data"), "api-keys": t("nav_apikeys"),
    };
    return map[id] || id;
  };

  return (
    <div style={{ padding: 32, color: "#f1f5f9", minHeight: "100vh", background: BG }}>
      {/* Header */}
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>{t("settings_title")}</h1>
      <p style={{ color: SUB, marginBottom: 28, fontSize: 13 }}>{t("settings_sub")}</p>

      {/* Tab bar — wrapping */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 28, background: SURF, borderRadius: 12, padding: 6, border: `1px solid ${BORD}` }}>
        {TABS.map(({ id, icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: tab === id ? accent : "transparent",
            color: tab === id ? "#000" : SUB,
            border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer",
            fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5,
            transition: "all 0.15s",
          }}>
            <span>{icon}</span>{tabLabel(id)}
          </button>
        ))}
      </div>

      {/* ─── PROFILE ─────────────────────────────────────────────────────────── */}
      {tab === "profile" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>{t("settings_profile")}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%", background: `${accent}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 700, color: accent, flexShrink: 0,
              }}>FM</div>
              <div>
                <div style={{ fontWeight: 600 }}>Francisco Morais</div>
                <div style={{ fontSize: 12, color: SUB }}>admin@voltaris.com</div>
                <button style={{ fontSize: 11, color: accent, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}>
                  Change avatar
                </button>
              </div>
            </div>
            <Input label="Full Name" value="Francisco Morais" />
            <Input label="Email Address" value="admin@voltaris.com" type="email" />
            <Input label="Phone" value="+351 912 345 678" type="tel" />
            <Input label="Job Title" value="Energy Systems Engineer" />
            <Input label="Current Password" type="password" placeholder="••••••••" />
            <Input label="New Password" type="password" placeholder="••••••••" />
            <Btn onClick={save} accent={accent}>{saved ? t("saved") : t("save")}</Btn>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Preferences</h2>
              <Select label="Timezone" value="Europe/Lisbon" onChange={() => {}} options={[
                { value: "Europe/Lisbon", label: "Europe/Lisbon (WET)" },
                { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CET)" },
                { value: "Europe/London", label: "Europe/London (GMT)" },
                { value: "UTC", label: "UTC" },
              ]} />
              <Select label="Date Format" value="DD/MM/YYYY" onChange={() => {}} options={[
                { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
              ]} />
              <Select label="Number Format" value="1.234,56" onChange={() => {}} options={[
                { value: "1.234,56", label: "1.234,56 (EU)" },
                { value: "1,234.56", label: "1,234.56 (US)" },
              ]} />
            </div>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Connected Apps</h2>
              <p style={{ fontSize: 12, color: SUB, marginBottom: 16 }}>OAuth and SSO integrations</p>
              {[
                { name: "Google Workspace", icon: "G", connected: true },
                { name: "Microsoft 365", icon: "M", connected: false },
                { name: "Slack", icon: "S", connected: true },
              ].map(app => (
                <div key={app.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${BORD}`, fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#1f2937", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: accent }}>{app.icon}</div>
                    <span>{app.name}</span>
                  </div>
                  <button style={{ background: app.connected ? "#064e3b" : "#1e3a5f", color: app.connected ? "#10b981" : "#60a5fa", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                    {app.connected ? "Connected" : "Connect"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── COMPANY ─────────────────────────────────────────────────────────── */}
      {tab === "company" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>{t("settings_company")}</h2>
            <Input label="Company Name" value="Voltaris Energy B.V." />
            <Input label="VAT Number" value="NL123456789B01" />
            <Input label="Registered Address" value="Coolsingel 1, 3012 AA Rotterdam" />
            <Input label="Country" value="Netherlands" />
            <Input label="Website" value="https://voltaris.energy" />
            <Input label="Support Email" value="support@voltaris.energy" />
            <Input label="Billing Email" value="billing@voltaris.energy" />
            <div style={{ marginTop: 4 }}>
              <Btn onClick={save} accent={accent}>{saved ? t("saved") : t("save")}</Btn>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>System Info</h2>
              {[
                { label: "Platform Version", val: "VoltarisOS v1.2.0" },
                { label: "Backend", val: "FastAPI 0.115 / Python 3.12" },
                { label: "Database", val: "PostgreSQL 16" },
                { label: "Deployed On", val: "Railway.app" },
                { label: "Last Deploy", val: new Date().toLocaleDateString() },
                { label: "Node Count", val: "2 sites, 3 BESS, 6 EV chargers" },
                { label: "Active Users", val: "4" },
                { label: "Storage Used", val: "2.3 GB / 50 GB" },
              ].map(m => <InfoRow key={m.label} label={m.label} value={m.val} />)}
            </div>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>White-label Branding</h2>
              <p style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>Logo, colors, and OEM configuration are managed in the White-label section.</p>
              <Btn variant="outline" accent={accent} onClick={() => {}}>Open White-label Settings</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── APPEARANCE ──────────────────────────────────────────────────────── */}
      {tab === "appearance" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>{t("app_theme")}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
              {Object.values(THEMES).map(th => {
                const active = theme === th.name;
                // Premium preview colors for each theme
                const previewAccent = {
                  dark: "#4ade80", light: "#3b82f6", midnight: "#a78bfa",
                  forest: "#4ade80", ocean: "#60a5fa", ember: "#f97316",
                }[th.name] || accent;
                return (
                  <div key={th.name} onClick={() => setTheme(th.name)} style={{
                    border: `2px solid ${active ? accent : "transparent"}`,
                    borderRadius: 12, padding: 0, cursor: "pointer",
                    overflow: "hidden", transition: "all 0.2s",
                    boxShadow: active ? `0 0 0 1px ${accent}60, 0 4px 20px ${accent}20` : "0 2px 8px rgba(0,0,0,0.3)",
                    transform: active ? "scale(1.02)" : "scale(1)",
                    position: "relative",
                  }}>
                    {/* Full preview panel */}
                    <div style={{ background: th.bg, padding: "12px", height: "90px", position: "relative", overflow: "hidden" }}>
                      {/* Ambient glow */}
                      <div style={{ position: "absolute", top: "-10px", right: "-10px", width: "50px", height: "50px", borderRadius: "50%", background: previewAccent + "30", filter: "blur(15px)" }} />
                      {/* Fake sidebar */}
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "20px", background: th.sidebar }} />
                      {/* Mock widgets */}
                      <div style={{ marginLeft: "26px" }}>
                        <div style={{ display: "flex", gap: "4px", marginBottom: "5px" }}>
                          {[previewAccent, "#60a5fa", "#a78bfa"].map((c, i) => (
                            <div key={i} style={{ flex: 1, height: "18px", borderRadius: "4px", background: th.surface, border: `1px solid ${th.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ width: "40%", height: "3px", borderRadius: "2px", background: c, opacity: 0.8 }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <div style={{ flex: 2, height: "30px", borderRadius: "4px", background: th.surface, border: `1px solid ${th.border}` }}>
                            <div style={{ margin: "6px 6px 3px", height: "3px", borderRadius: "2px", background: `linear-gradient(90deg, transparent, ${previewAccent}90, transparent)` }} />
                            <div style={{ margin: "0 6px", height: "8px", borderRadius: "2px", background: `linear-gradient(90deg, ${previewAccent}20, ${previewAccent}50)` }} />
                          </div>
                          <div style={{ flex: 1, height: "30px", borderRadius: "4px", background: th.surface, border: `1px solid ${th.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: `3px solid ${previewAccent}`, borderTopColor: "transparent" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Label */}
                    <div style={{ background: th.surface, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${th.border}` }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: th.text }}>{th.label || th.name}</div>
                        <div style={{ fontSize: 9, color: th.sub, marginTop: "1px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{th.name}</div>
                      </div>
                      {active && (
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 900 }}>✓</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <SectionTitle>{t("app_accent")}</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <input type="color" value={accentColor} onChange={e => setAccent(e.target.value)}
                style={{ width: 48, height: 36, borderRadius: 6, border: "none", cursor: "pointer", background: "none", padding: 0 }} />
              <span style={{ fontSize: 13, fontFamily: "monospace", color: accentColor, fontWeight: 700 }}>{accentColor}</span>
            </div>
            {/* Preset swatches */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["#4ade80", "#6366f1", "#f59e0b", "#ec4899", "#0ea5e9", "#f97316", "#a78bfa", "#14b8a6"].map(c => (
                <div key={c} onClick={() => setAccent(c)} style={{
                  width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                  border: `2px solid ${accentColor === c ? "#fff" : "transparent"}`,
                  transition: "border-color 0.15s",
                }} />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{t("app_density")}</h2>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {["compact", "comfortable", "spacious"].map(d => (
                  <button key={d} onClick={() => setDensity(d)} style={{
                    flex: 1, background: density === d ? `${accent}22` : SURF2,
                    color: density === d ? accent : SUB,
                    border: `1px solid ${density === d ? accent : BORD}`,
                    borderRadius: 8, padding: "8px 4px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  }}>
                    {d === "compact" ? t("app_compact") : d === "comfortable" ? t("app_comfortable") : t("app_spacious")}
                  </button>
                ))}
              </div>
              <Toggle value={animations} onChange={setAnimations} label={t("app_animations")} desc={t("app_animations_desc")} accent={accent} />
              <Toggle value={sidebarDefaultCollapsed} onChange={setSidebarDefaultCollapsed} label={t("app_sidebar_collapsed")} desc="Applies on next page load" accent={accent} />
            </div>

            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Dashboard Layout</h2>
              <p style={{ fontSize: 12, color: SUB, marginBottom: 16 }}>Toggle which widgets appear on the dashboard. Use the Customize button on the dashboard for live reordering.</p>
              {[
                { key: "kpis", label: "KPI Cards" },
                { key: "prodVsConsumption", label: "Production vs Consumption" },
                { key: "marketPrice", label: "Market Price Chart" },
                { key: "battery", label: "Battery Status" },
                { key: "ai", label: "AI Engine" },
                { key: "sites", label: "Active Sites" },
                { key: "soc24h", label: "Battery 24h Chart" },
                { key: "revenue", label: "Revenue Summary" },
                { key: "weatherForecast", label: "Weather Forecast" },
                { key: "recentAlerts", label: "Recent Alerts" },
                { key: "co2saved", label: "CO₂ Saved" },
                { key: "gridBalance", label: "Grid Balance" },
              ].map(({ key, label }) => <DashWidgetRow key={key} wkey={key} label={label} accent={accent} />)}
            </div>
          </div>
        </div>
      )}

      {/* ─── LANGUAGE ────────────────────────────────────────────────────────── */}
      {tab === "language" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{t("language")}</h2>
            <p style={{ fontSize: 12, color: SUB, marginBottom: 20 }}>Select the interface language. All labels, menus, and tooltips will update instantly.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.values(LANGUAGES).map(lang => {
                const active = language === lang.code;
                return (
                  <div key={lang.code} onClick={() => setLanguage(lang.code)} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                    borderRadius: 10, cursor: "pointer",
                    background: active ? `${accent}18` : SURF2,
                    border: `1.5px solid ${active ? accent : BORD}`,
                    transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: 26 }}>{lang.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: active ? accent : "#e5e7eb" }}>{lang.label}</div>
                      <div style={{ fontSize: 11, color: SUB }}>{lang.code.toUpperCase()}</div>
                    </div>
                    {active && <div style={{ width: 20, height: 20, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 900 }}>✓</div>}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Regional Settings</h2>
            <Select label="Currency" value={energySettings.currency} onChange={v => setEnergySettings({ currency: v })} options={[
              { value: "EUR", label: "€ Euro (EUR)" },
              { value: "GBP", label: "£ Pound (GBP)" },
              { value: "USD", label: "$ Dollar (USD)" },
              { value: "CHF", label: "₣ Franc (CHF)" },
            ]} />
            <Select label="Measurement Units" value={energySettings.priceUnit} onChange={v => setEnergySettings({ priceUnit: v })} options={[
              { value: "MWh", label: "€/MWh (wholesale)" },
              { value: "kWh", label: "€/kWh (retail)" },
            ]} />
            <Select label="Power Units" value={energySettings.powerUnit} onChange={v => setEnergySettings({ powerUnit: v })} options={[
              { value: "kW", label: "kW / kWh" },
              { value: "MW", label: "MW / MWh" },
            ]} />
            <SectionTitle>Locale Preview</SectionTitle>
            <div style={{ background: SURF2, borderRadius: 8, padding: 14, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: SUB }}>Price</span>
                <span>{energySettings.currency === "EUR" ? "€" : energySettings.currency === "GBP" ? "£" : "$"}128.50/{energySettings.priceUnit}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: SUB }}>Energy</span>
                <span>4.80 MWh</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: SUB }}>Date</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENERGY ──────────────────────────────────────────────────────────── */}
      {tab === "energy" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Tariffs & Grid</h2>
            <p style={{ fontSize: 12, color: SUB, marginBottom: 16 }}>Configure import/export tariffs and grid connection parameters.</p>
            <NumInput label="Grid Import Tariff" value={energySettings.gridImportTariff} onChange={v => setEnergySettings({ gridImportTariff: v })} min={0} max={2} step={0.01} unit="€/kWh" />
            <NumInput label="Grid Export / Feed-in Tariff" value={energySettings.gridExportTariff} onChange={v => setEnergySettings({ gridExportTariff: v })} min={0} max={1} step={0.01} unit="€/kWh" />
            <NumInput label="Peak Shaving Threshold" value={energySettings.peakShavingThreshold} onChange={v => setEnergySettings({ peakShavingThreshold: v })} min={0} max={2000} step={10} unit="kW" />
            <NumInput label="Feed-in Limit" value={energySettings.feedInLimit} onChange={v => setEnergySettings({ feedInLimit: v })} min={0} max={100} step={1} unit="%" />
            <SectionTitle>Grid Parameters</SectionTitle>
            <Select label="Grid Frequency" value={String(energySettings.gridFrequency)} onChange={v => setEnergySettings({ gridFrequency: Number(v) })} options={[
              { value: "50", label: "50 Hz (Europe)" },
              { value: "60", label: "60 Hz (Americas)" },
            ]} />
            <Select label="Voltage Level" value={String(energySettings.voltageLevel)} onChange={v => setEnergySettings({ voltageLevel: Number(v) })} options={[
              { value: "230", label: "230 V (single phase)" },
              { value: "400", label: "400 V (three phase)" },
              { value: "11000", label: "11 kV (MV)" },
              { value: "33000", label: "33 kV (HV)" },
            ]} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Battery SOC Limits</h2>
              <Slider label="SOC Minimum" value={energySettings.socMin} onChange={v => setEnergySettings({ socMin: v })} min={0} max={50} unit="%" accent={accent} />
              <Slider label="SOC Maximum" value={energySettings.socMax} onChange={v => setEnergySettings({ socMax: v })} min={50} max={100} unit="%" accent={accent} />
              <Slider label="Self-Consumption Target" value={energySettings.selfConsumptionTarget} onChange={v => setEnergySettings({ selfConsumptionTarget: v })} min={0} max={100} unit="%" accent={accent} />
            </div>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Display Units</h2>
              <Select label="Currency" value={energySettings.currency} onChange={v => setEnergySettings({ currency: v })} options={[
                { value: "EUR", label: "€ Euro (EUR)" },
                { value: "GBP", label: "£ Pound (GBP)" },
                { value: "USD", label: "$ Dollar (USD)" },
              ]} />
              <Select label="Energy Price" value={energySettings.priceUnit} onChange={v => setEnergySettings({ priceUnit: v })} options={[
                { value: "MWh", label: "€/MWh" },
                { value: "kWh", label: "€/kWh" },
              ]} />
              <Select label="Timezone" value={energySettings.timezone} onChange={v => setEnergySettings({ timezone: v })} options={[
                { value: "Europe/Lisbon", label: "Europe/Lisbon" },
                { value: "Europe/Amsterdam", label: "Europe/Amsterdam" },
                { value: "UTC", label: "UTC" },
              ]} />
              <Btn onClick={save} accent={accent} style={{ marginTop: 4 }}>{saved ? t("saved") : t("save")}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── TRADING ─────────────────────────────────────────────────────────── */}
      {tab === "trading" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Auto-Trading Engine</h2>
            <p style={{ fontSize: 12, color: SUB, marginBottom: 16 }}>Configure autonomous trading parameters and risk profile.</p>
            <Toggle value={tradingSettings.autoTradingEnabled} onChange={v => setTradingSettings({ autoTradingEnabled: v })}
              label="Auto-Trading Enabled" desc="Allow AI agent to execute trades automatically" accent={accent} />
            <Toggle value={tradingSettings.notifyOnTrade} onChange={v => setTradingSettings({ notifyOnTrade: v })}
              label="Notify on Trade Execution" desc="Push notification for every executed order" accent={accent} />
            <Toggle value={tradingSettings.hedgingEnabled} onChange={v => setTradingSettings({ hedgingEnabled: v })}
              label="Hedging Enabled" desc="Use futures/options for portfolio hedging" accent={accent} />
            <SectionTitle>Price Thresholds</SectionTitle>
            <NumInput label="Min Sell Price" value={tradingSettings.minPriceSell} onChange={v => setTradingSettings({ minPriceSell: v })} min={0} max={500} unit="€/MWh" />
            <NumInput label="Max Buy Price" value={tradingSettings.maxPriceBuy} onChange={v => setTradingSettings({ maxPriceBuy: v })} min={0} max={500} unit="€/MWh" />
            <NumInput label="Max Position Size" value={tradingSettings.maxPositionSize} onChange={v => setTradingSettings({ maxPositionSize: v })} min={0} max={10000} step={50} unit="kWh" />
            <NumInput label="Slippage Tolerance" value={tradingSettings.slippageTolerance} onChange={v => setTradingSettings({ slippageTolerance: v })} min={0} max={10} step={0.5} unit="%" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Risk Profile</h2>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {["conservative", "balanced", "aggressive"].map(m => (
                  <button key={m} onClick={() => setTradingSettings({ tradingMode: m })} style={{
                    flex: 1, background: tradingSettings.tradingMode === m ? `${accent}22` : SURF2,
                    color: tradingSettings.tradingMode === m ? accent : SUB,
                    border: `1px solid ${tradingSettings.tradingMode === m ? accent : BORD}`,
                    borderRadius: 8, padding: "8px 4px", cursor: "pointer", fontSize: 11, fontWeight: 600, textTransform: "capitalize",
                  }}>{m}</button>
                ))}
              </div>
              <Slider label="Risk Score" value={tradingSettings.riskScore} onChange={v => setTradingSettings({ riskScore: v })} min={1} max={10} unit="" accent={accent} />
              <SectionTitle>Markets</SectionTitle>
              <Select label="Primary Market" value={tradingSettings.market} onChange={v => setTradingSettings({ market: v })} options={[
                { value: "EPEX", label: "EPEX SPOT (EU)" },
                { value: "N2EX", label: "N2EX (UK)" },
                { value: "OMIE", label: "OMIE (Iberia)" },
                { value: "NordPool", label: "Nord Pool (Nordic)" },
              ]} />
              <Toggle value={tradingSettings.dayAheadEnabled} onChange={v => setTradingSettings({ dayAheadEnabled: v })}
                label="Day-Ahead Market" desc="DA auction participation" accent={accent} />
              <Toggle value={tradingSettings.intraday} onChange={v => setTradingSettings({ intraday: v })}
                label="Intraday Market" desc="Continuous intraday trading" accent={accent} />
              <Toggle value={tradingSettings.balancingMarket} onChange={v => setTradingSettings({ balancingMarket: v })}
                label="Balancing Market" desc="TSO balancing bids" accent={accent} />
            </div>
            <div style={{ ...card, background: "#1a0a0a", border: "1px solid #7f1d1d" }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: DANG, marginBottom: 8 }}>⚠ Live Trading Warning</h3>
              <p style={{ fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>
                Enabling auto-trading will allow the AI agent to execute real energy market orders. Ensure your regulatory compliance and risk limits are correctly configured before enabling.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── NOTIFICATIONS ───────────────────────────────────────────────────── */}
      {tab === "notifications" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Alert Channels</h2>
            <p style={{ fontSize: 12, color: SUB, marginBottom: 16 }}>Configure how and where notifications are delivered.</p>
            <Toggle value={alertSettings.emailAlerts} onChange={v => setAlertSettings({ emailAlerts: v })} label="Email Alerts" desc="All alerts and reports by email" accent={accent} />
            <Toggle value={alertSettings.smsAlerts} onChange={v => setAlertSettings({ smsAlerts: v })} label="SMS Alerts" desc="Critical alerts only via SMS" accent={accent} />
            <Toggle value={alertSettings.pushAlerts} onChange={v => setAlertSettings({ pushAlerts: v })} label="Push Notifications" desc="In-app and browser push" accent={accent} />
            <SectionTitle>Slack Integration</SectionTitle>
            <Input label="Slack Webhook URL" value={alertSettings.slackWebhook} onChange={v => setAlertSettings({ slackWebhook: v })} placeholder="https://hooks.slack.com/services/..." />
            <Btn variant="secondary" accent={accent} onClick={() => {}}>Send Test Message</Btn>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Alert Thresholds</h2>
              <NumInput label="SOC Low Alert" value={alertSettings.socLowThreshold} onChange={v => setAlertSettings({ socLowThreshold: v })} min={0} max={50} unit="%" />
              <NumInput label="SOC High Alert" value={alertSettings.socHighThreshold} onChange={v => setAlertSettings({ socHighThreshold: v })} min={50} max={100} unit="%" />
              <NumInput label="Temperature High Alert" value={alertSettings.tempHighThreshold} onChange={v => setAlertSettings({ tempHighThreshold: v })} min={0} max={80} unit="°C" />
              <NumInput label="Price Spike Alert" value={alertSettings.priceSpike} onChange={v => setAlertSettings({ priceSpike: v })} min={0} max={999} unit="€/MWh" />
              <NumInput label="Price Dip Alert" value={alertSettings.priceDip} onChange={v => setAlertSettings({ priceDip: v })} min={0} max={999} unit="€/MWh" />
            </div>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Scheduled Digests</h2>
              <Toggle value={alertSettings.dailyDigest} onChange={v => setAlertSettings({ dailyDigest: v })} label="Daily Energy Digest" desc="Sent at 08:00 local time" accent={accent} />
              <Toggle value={alertSettings.weeklyReport} onChange={v => setAlertSettings({ weeklyReport: v })} label="Weekly Performance Report" desc="Sent every Monday 09:00" accent={accent} />
              <Toggle value={alertSettings.maintenanceReminder} onChange={v => setAlertSettings({ maintenanceReminder: v })} label="Maintenance Reminders" desc="Battery cycles and inverter checks" accent={accent} />
              <Toggle value={alertSettings.tradeAlerts} onChange={v => setAlertSettings({ tradeAlerts: v })} label="Trade Execution Alerts" desc="Notify on every trade" accent={accent} />
              <Toggle value={alertSettings.offlineAlert} onChange={v => setAlertSettings({ offlineAlert: v })} label="Device Offline Alerts" desc="Alert when a node goes offline" accent={accent} />
            </div>
          </div>
        </div>
      )}

      {/* ─── SECURITY ────────────────────────────────────────────────────────── */}
      {tab === "security" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Two-Factor Authentication</h2>
            <p style={{ fontSize: 12, color: SUB, marginBottom: 20 }}>Protect your account with an authenticator app or hardware key.</p>
            <Toggle value={twoFAEnabled} onChange={setTwoFAEnabled} label="2FA Enabled" desc="TOTP via Google Authenticator or Authy" accent={accent} />
            {twoFAEnabled && (
              <div style={{ marginTop: 16, background: SURF2, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>Scan this QR code with your authenticator app:</div>
                <div style={{ width: 120, height: 120, background: "#1f2937", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: SUB, marginBottom: 12 }}>QR Code</div>
                <Input label="Verification Code" placeholder="123456" />
                <Btn onClick={() => {}} accent={accent}>Verify & Activate</Btn>
              </div>
            )}
            <SectionTitle>Session</SectionTitle>
            <Select label="Session Timeout" value={String(sessionTimeout)} onChange={v => setSessionTimeout(Number(v))} options={[
              { value: "15", label: "15 minutes" },
              { value: "30", label: "30 minutes" },
              { value: "60", label: "1 hour" },
              { value: "240", label: "4 hours" },
              { value: "480", label: "8 hours" },
              { value: "0", label: "Never (not recommended)" },
            ]} />
            <SectionTitle>Active Sessions</SectionTitle>
            {[
              { device: "Chrome / macOS", ip: "91.122.45.1", location: "Rotterdam, NL", active: true, time: "Now" },
              { device: "Safari / iPhone 15", ip: "91.122.45.2", location: "Rotterdam, NL", active: false, time: "3h ago" },
              { device: "Chrome / Windows", ip: "195.83.0.1", location: "Amsterdam, NL", active: false, time: "2d ago" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${BORD}`, fontSize: 12 }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{s.device}</div>
                  <div style={{ color: SUB }}>{s.ip} · {s.location} · {s.time}</div>
                </div>
                {s.active
                  ? <span style={{ color: accent, fontSize: 11, fontWeight: 600 }}>Current</span>
                  : <button style={{ background: "transparent", color: DANG, border: `1px solid ${DANG}33`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11 }}>Revoke</button>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>IP Whitelist</h2>
              <p style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>Restrict API access to specific IP ranges (CIDR notation).</p>
              <textarea
                value={ipWhitelist} onChange={e => setIpWhitelist(e.target.value)}
                rows={4} placeholder="192.168.1.0/24&#10;10.0.0.1"
                style={{
                  background: SURF2, border: `1px solid ${BORD}`, borderRadius: 8,
                  padding: 12, color: "#f1f5f9", fontSize: 13, width: "100%",
                  boxSizing: "border-box", resize: "vertical", fontFamily: "monospace",
                }}
              />
              <Btn onClick={save} accent={accent} style={{ marginTop: 8 }}>{saved ? t("saved") : t("save")}</Btn>
            </div>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Password Policy</h2>
              {[
                { label: "Minimum length: 12 characters", ok: true },
                { label: "Uppercase required", ok: true },
                { label: "Special character required", ok: true },
                { label: "Password rotation: 90 days", ok: false },
              ].map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", fontSize: 12 }}>
                  <span style={{ color: p.ok ? accent : SUB }}>{p.ok ? "✓" : "○"}</span>
                  <span style={{ color: p.ok ? "#e5e7eb" : SUB }}>{p.label}</span>
                </div>
              ))}
            </div>
            <div style={{ ...card, background: "#0a1a0a", border: `1px solid #14532d` }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: accent }}>Security Audit</h2>
              <p style={{ fontSize: 12, color: "rgba(148,163,184,0.6)", marginBottom: 12 }}>Last full security scan: {new Date(Date.now() - 86400000 * 3).toLocaleDateString()}</p>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn variant="outline" accent={accent} onClick={() => {}}>Run Scan</Btn>
                <Btn variant="secondary" accent={accent} onClick={() => {}}>View Audit Log</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── BILLING ─────────────────────────────────────────────────────────── */}
      {tab === "billing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Current plan */}
          <div style={{ ...card, background: `linear-gradient(135deg, ${accent}18, ${SURF})`, border: `1px solid ${accent}44` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>CURRENT PLAN</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Enterprise</h2>
                <p style={{ fontSize: 13, color: SUB }}>Unlimited sites · AI trading · White-label · Priority support</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: accent }}>€1,200</div>
                <div style={{ fontSize: 12, color: SUB }}>/month</div>
              </div>
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <Btn variant="outline" accent={accent} onClick={() => {}}>Change Plan</Btn>
              <Btn variant="secondary" accent={accent} onClick={() => {}}>Download Contract</Btn>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Usage This Month</h2>
              {[
                { label: "API Calls", used: 142300, limit: 500000, unit: "" },
                { label: "Storage", used: 2.3, limit: 50, unit: " GB" },
                { label: "Active Sites", used: 2, limit: null, unit: "" },
                { label: "Users", used: 4, limit: null, unit: "" },
              ].map(u => (
                <div key={u.label} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: SUB }}>{u.label}</span>
                    <span style={{ fontWeight: 500 }}>
                      {u.used}{u.unit}{u.limit ? ` / ${u.limit}${u.unit}` : " (unlimited)"}
                    </span>
                  </div>
                  {u.limit && (
                    <div style={{ background: "#1f2937", borderRadius: 4, height: 4, overflow: "hidden" }}>
                      <div style={{ background: accent, width: `${(u.used / u.limit) * 100}%`, height: "100%", borderRadius: 4 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Payment Method</h2>
              <div style={{ background: SURF2, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <div style={{ width: 36, height: 24, background: "#1f3a8f", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>VISA</div>
                  <span style={{ fontSize: 13, fontFamily: "monospace" }}>•••• •••• •••• 4242</span>
                </div>
                <div style={{ fontSize: 11, color: SUB }}>Expires 12/2027 · Francisco Morais</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn variant="secondary" accent={accent} onClick={() => {}}>Update Card</Btn>
                <Btn variant="secondary" accent={accent} onClick={() => {}}>Add Method</Btn>
              </div>
            </div>
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Invoice History</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORD}` }}>
                    {["Invoice", "Date", "Amount", "Status", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: SUB, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "INV-2026-05", date: "May 1, 2026", amount: "€1,200.00", status: "paid" },
                    { id: "INV-2026-04", date: "Apr 1, 2026", amount: "€1,200.00", status: "paid" },
                    { id: "INV-2026-03", date: "Mar 1, 2026", amount: "€1,200.00", status: "paid" },
                    { id: "INV-2026-02", date: "Feb 1, 2026", amount: "€980.00", status: "paid" },
                  ].map(inv => (
                    <tr key={inv.id} style={{ borderBottom: `1px solid ${BORD}` }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{inv.id}</td>
                      <td style={{ padding: "10px 12px", color: SUB }}>{inv.date}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{inv.amount}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ background: "#064e3b", color: "#10b981", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <button style={{ background: "transparent", color: accent, border: "none", cursor: "pointer", fontSize: 12 }}>↓ PDF</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── DATA & PRIVACY ──────────────────────────────────────────────────── */}
      {tab === "data" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Data Export</h2>
            <p style={{ fontSize: 12, color: SUB, marginBottom: 20 }}>Export your energy data, trading history, and configuration as structured files.</p>
            {[
              { label: "Energy Readings (CSV)", icon: "⚡", size: "~12 MB" },
              { label: "Trading History (CSV)", icon: "📈", size: "~3 MB" },
              { label: "Alert History (JSON)", icon: "🔔", size: "~0.8 MB" },
              { label: "System Configuration (JSON)", icon: "⚙️", size: "~45 KB" },
              { label: "Audit Log (CSV)", icon: "📋", size: "~1.2 MB" },
              { label: "Full Archive (ZIP)", icon: "📦", size: "~20 MB" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${BORD}` }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: SUB }}>{item.size}</div>
                  </div>
                </div>
                <button style={{ background: "#1f2937", color: "rgba(148,163,184,0.6)", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>
                  Export
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Data Retention</h2>
              <Select label="Raw Readings Retention" value="365" onChange={() => {}} options={[
                { value: "90", label: "90 days" },
                { value: "180", label: "180 days" },
                { value: "365", label: "1 year" },
                { value: "730", label: "2 years" },
                { value: "0", label: "Forever" },
              ]} />
              <Select label="Audit Log Retention" value="730" onChange={() => {}} options={[
                { value: "365", label: "1 year" },
                { value: "730", label: "2 years" },
                { value: "0", label: "Forever (recommended)" },
              ]} />
              <Select label="Notification History" value="90" onChange={() => {}} options={[
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
                { value: "180", label: "180 days" },
              ]} />
            </div>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Privacy & Compliance</h2>
              <p style={{ fontSize: 12, color: SUB, marginBottom: 16 }}>GDPR compliance and data processing settings.</p>
              <InfoRow label="Data Controller" value="Voltaris Energy B.V." />
              <InfoRow label="DPA" value="AP Netherlands" />
              <InfoRow label="Privacy Policy" value="v2.1 — Jan 2026" />
              <InfoRow label="Data Processing" value="EU servers only" />
              <InfoRow label="Last GDPR audit" value="Mar 2026" />
              <div style={{ marginTop: 16 }}>
                <Btn variant="outline" accent={accent} onClick={() => {}}>Download Privacy Policy</Btn>
              </div>
            </div>
            <div style={{ ...card, background: "#1a0505", border: `1px solid #7f1d1d` }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: DANG }}>Danger Zone</h2>
              <p style={{ fontSize: 12, color: "#f87171", marginBottom: 16 }}>These actions are irreversible. Proceed with extreme caution.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Btn variant="danger" accent={accent} onClick={() => {}}>Delete All Historical Data</Btn>
                <Btn variant="danger" accent={accent} onClick={() => {}}>Delete Account & All Data</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── API KEYS ─────────────────────────────────────────────────────────── */}
      {tab === "api-keys" && (
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t("nav_apikeys")}</h2>
            <p style={{ fontSize: 12, color: SUB, marginBottom: 20 }}>Third-party API credentials. Keys are masked — click reveal to view.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {API_KEYS.map(k => (
                <div key={k.key} style={{ background: SURF2, borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{k.label}</div>
                      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.6)" }}>{k.scope}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setRevealed(r => ({ ...r, [k.key]: !r[k.key] }))} style={{
                        background: "#1f2937", color: "rgba(148,163,184,0.6)", border: "none",
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
                    background: SURF, borderRadius: 6, padding: "8px 12px",
                    color: revealed[k.key] ? "#e5e7eb" : "#4b5563",
                  }}>
                    {revealed[k.key] ? k.value : "•".repeat(36)}
                  </div>
                </div>
              ))}
            </div>
            <SectionTitle>VoltarisOS API Access</SectionTitle>
            <div style={{ background: SURF2, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>Your personal API token (read-only)</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, background: SURF, borderRadius: 6, padding: "8px 12px", color: SUB }}>
                vos_sk_live_••••••••••••••••••••••••••••••••
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <Btn onClick={() => {}} accent={accent}>Generate New Token</Btn>
                <Btn variant="secondary" accent={accent} onClick={() => {}}>View Docs</Btn>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Webhook Endpoints</h2>
              <p style={{ fontSize: 12, color: SUB, marginBottom: 16 }}>Configure endpoints for real-time event delivery.</p>
              {[
                { event: "trade.executed", url: "https://erp.voltaris.com/webhook/trade", active: true },
                { event: "alert.critical", url: "https://ops.voltaris.com/alerts", active: true },
                { event: "device.offline", url: "", active: false },
              ].map((wh, i) => (
                <div key={i} style={{ marginBottom: 12, background: SURF2, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <code style={{ fontSize: 11, color: accent }}>{wh.event}</code>
                    <span style={{ fontSize: 10, color: wh.active ? "#10b981" : SUB }}>{wh.active ? "Active" : "Inactive"}</span>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: wh.url ? SUB : "#4b5563" }}>
                    {wh.url || "No URL configured"}
                  </div>
                </div>
              ))}
              <Btn variant="outline" accent={accent} onClick={() => {}}>+ Add Webhook</Btn>
            </div>
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>API Rate Limits</h2>
              {[
                { label: "Requests / minute", val: "120 / 1000" },
                { label: "Requests today", val: "14,230 / 50,000" },
                { label: "Websocket connections", val: "4 / 50" },
                { label: "Batch export / day", val: "3 / 10" },
              ].map(r => <InfoRow key={r.label} label={r.label} value={r.val} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
