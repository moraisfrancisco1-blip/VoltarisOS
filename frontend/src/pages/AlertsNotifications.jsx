import { useState, useEffect } from "react";
import { C, glassCard } from "../components/ChartTheme";

const accent = C.indigo;
const API = import.meta.env.VITE_API_URL || "";

const SEVERITY_STYLE = {
  critical: { color: C.red, bg: `${C.red}18`, border: `${C.red}44`, glow: `0 0 12px ${C.red}33`, icon: "🔴" },
  warning:  { color: C.amber, bg: `${C.amber}15`, border: `${C.amber}44`, glow: `0 0 12px ${C.amber}33`, icon: "🟡" },
  info:     { color: C.blue, bg: `${C.blue}15`, border: `${C.blue}44`, glow: "none", icon: "🔵" },
};
const SEVERITIES = ["warning", "critical", "info"];
const OPERATORS = ["gt", "lt", "eq", "ne"];

const BLANK_RULE = { name: "", metric: "", operator: "gt", threshold: "", severity: "warning" };

function fmtTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
}

function InputField({ label: lb, value, onChange, type = "text", options, unit }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{lb}{unit && <span style={{ color: "var(--sub)", marginLeft: 4 }}>({unit})</span>}</div>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13 }}>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }} />
      )}
    </div>
  );
}

export default function AlertsNotifications() {
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ackingId, setAckingId] = useState(null);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState(null);
  const [ruleForm, setRuleForm] = useState({ ...BLANK_RULE });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deletingRuleId, setDeletingRuleId] = useState(null);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/alerts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Não foi possível carregar os alertas.");
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const res = await fetch(`${API}/api/alert-rules`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRules(Array.isArray(data) ? data : []);
    } catch (e) {
      setRulesError("Não foi possível carregar as regras de alerta.");
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    loadRules();
  }, []);

  const ack = async (id) => {
    setAckingId(id);
    setError(null);
    try {
      const res = await fetch(`${API}/api/alerts/${id}/ack?by=user`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadAlerts();
    } catch (e) {
      setError("Não foi possível reconhecer o alerta.");
    } finally {
      setAckingId(null);
    }
  };

  const ackAll = async () => {
    const unacked = alerts.filter(a => !a.acknowledged);
    setError(null);
    try {
      await Promise.all(unacked.map(a => fetch(`${API}/api/alerts/${a.id}/ack?by=user`, { method: "POST" })));
      await loadAlerts();
    } catch (e) {
      setError("Não foi possível reconhecer os alertas.");
    }
  };

  const createRule = async () => {
    if (!ruleForm.name || !ruleForm.metric) { setFormError("Nome e métrica são obrigatórios."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: ruleForm.name,
        metric: ruleForm.metric,
        operator: ruleForm.operator,
        severity: ruleForm.severity,
        ...(ruleForm.threshold !== "" ? { threshold: Number(ruleForm.threshold) } : {}),
      };
      const res = await fetch(`${API}/api/alert-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).detail || ""; } catch (e) { /* ignore */ }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      setRuleForm({ ...BLANK_RULE });
      await loadRules();
    } catch (e) {
      setFormError(e.message || "Erro ao criar a regra.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id) => {
    setDeletingRuleId(id);
    setRulesError(null);
    try {
      const res = await fetch(`${API}/api/alert-rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadRules();
    } catch (e) {
      setRulesError("Não foi possível apagar a regra.");
    } finally {
      setDeletingRuleId(null);
    }
  };

  const f = (k) => v => setRuleForm(prev => ({ ...prev, [k]: v }));

  const unacked = alerts.filter(a => !a.acknowledged).length;
  const filtered = alerts.filter(a => filter === "all" || a.severity === filter);

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Alerts & Notifications</h1>
          <p style={{ color: "var(--sub)", margin: 0 }}>Active alerts and alert rules</p>
        </div>
        {unacked > 0 && (
          <div style={{
            background: `${C.red}15`, border: `1px solid ${C.red}55`,
            borderRadius: 10, padding: "10px 18px", fontSize: 13, color: C.red,
            boxShadow: `0 0 16px ${C.red}22`, fontWeight: 600,
          }}>
            ⚠ {unacked} unacknowledged alert{unacked > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "#ef444418", border: "1px solid #ef4444", color: C.red, fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 24,
        background: "var(--surface2)", borderRadius: 10, padding: 4,
        width: "fit-content", border: "1px solid rgba(255,255,255,0.12)"
      }}>
        {["active", "rules"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? accent : "transparent",
            color: tab === t ? "#fff" : "rgba(148,163,184,0.85)",
            border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 500,
            textTransform: "capitalize",
            boxShadow: tab === t ? `0 0 12px ${accent}55` : "none",
            transition: "all 0.15s",
          }}>{t === "rules" ? "Alert Rules" : t}</button>
        ))}
      </div>

      {tab === "active" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {["all", "critical", "warning", "info"].map(f => {
              const ts = SEVERITY_STYLE[f] || {};
              const active = filter === f;
              const count = f === "all" ? alerts.length : alerts.filter(a => a.severity === f).length;
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: active ? (ts.bg || "rgba(255,255,255,0.1)") : "var(--surface2)",
                  color: active ? (ts.color || "var(--text)") : "rgba(148,163,184,0.85)",
                  border: `1px solid ${active ? (ts.border || "rgba(255,255,255,0.2)") : "var(--surface2)"}`,
                  borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 13,
                  textTransform: "capitalize",
                  boxShadow: active && ts.glow ? ts.glow : "none",
                }}>
                  {f} ({count})
                </button>
              );
            })}
            <button onClick={ackAll} disabled={unacked === 0} style={{
              marginLeft: "auto", background: `${C.green}18`, color: C.green,
              border: `1px solid ${C.green}44`, borderRadius: 8, padding: "6px 16px",
              cursor: "pointer", fontSize: 13, boxShadow: `0 0 10px ${C.green}22`, opacity: unacked === 0 ? 0.5 : 1,
            }}>Acknowledge All</button>
          </div>

          {loading ? (
            <div style={{ ...glassCard(C.indigo), textAlign: "center", color: "var(--sub)", padding: 40 }}>Carregando alertas…</div>
          ) : error && alerts.length === 0 ? (
            <div style={{ ...glassCard(C.indigo), textAlign: "center", color: "var(--sub)", padding: 40 }}>Não foi possível carregar os alertas.</div>
          ) : alerts.length === 0 ? (
            <div style={{ ...glassCard(C.indigo), textAlign: "center", color: "var(--sub)", padding: 40 }}>Sem alertas.</div>
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 && (
              <div style={{ ...glassCard(C.indigo), textAlign: "center", color: "var(--sub)", padding: 40 }}>
                No alerts in this category
              </div>
            )}
            {filtered.map(alert => {
              const sev = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.info;
              return (
                <div key={alert.id} style={{
                  ...glassCard(sev.color), borderRadius: 12,
                  boxShadow: sev.glow, borderLeft: `3px solid ${sev.color}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 18 }}>{sev.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "var(--text)" }}>
                          {alert.title}
                          <span style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 99,
                            background: sev.bg, color: sev.color,
                            border: `1px solid ${sev.border}`,
                            marginLeft: 8, textTransform: "uppercase", letterSpacing: 0.5,
                          }}>
                            {alert.severity}
                          </span>
                          {alert.acknowledged && <span style={{ fontSize: 11, color: "var(--sub)", marginLeft: 8 }}>acknowledged</span>}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--sub)" }}>{alert.message}</div>
                        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.45)", marginTop: 4 }}>
                          {alert.device_name ? `Device: ${alert.device_name}` : ""} · {fmtTime(alert.fired_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {!alert.acknowledged && (
                        <button onClick={() => ack(alert.id)} disabled={ackingId === alert.id} style={{
                          background: `${C.green}18`, color: C.green,
                          border: `1px solid ${C.green}44`, borderRadius: 6, padding: "5px 12px",
                          cursor: "pointer", fontSize: 12, boxShadow: `0 0 8px ${C.green}22`, opacity: ackingId === alert.id ? 0.6 : 1,
                        }}>{ackingId === alert.id ? "…" : "Ack"}</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </>
      )}

      {tab === "rules" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Rules list */}
          <div style={glassCard(C.indigo)}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "var(--text)" }}>Alert Rules</h2>
            <p style={{ color: "var(--sub)", fontSize: 12, marginBottom: 16 }}>When a reading matches a rule, an alert fires.</p>
            {rulesError && (
              <div style={{ padding: 10, borderRadius: 8, background: "#ef444418", border: "1px solid #ef4444", color: C.red, fontSize: 12, marginBottom: 12 }}>
                {rulesError}
              </div>
            )}
            {rulesLoading ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Carregando regras…</div>
            ) : rules.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Sem regras de alerta.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rules.map(rule => (
                  <div key={rule.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px", borderRadius: 8, background: "var(--surface2)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{rule.name}</div>
                      <div style={{ fontSize: 11, color: "var(--sub)" }}>
                        {rule.metric} {rule.operator} {rule.threshold ?? "—"} · {rule.severity} · {rule.enabled ? "enabled" : "disabled"}
                      </div>
                    </div>
                    <button onClick={() => deleteRule(rule.id)} disabled={deletingRuleId === rule.id} style={{
                      padding: "4px 10px", background: "#ef444415", border: "1px solid #ef4444", borderRadius: 6,
                      color: C.red, fontSize: 11, cursor: "pointer", opacity: deletingRuleId === rule.id ? 0.6 : 1,
                    }}>{deletingRuleId === rule.id ? "…" : "Del"}</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create rule */}
          <div style={glassCard(C.blue)}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "var(--text)" }}>Add Rule</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <InputField label="Name" value={ruleForm.name} onChange={f("name")} />
              <InputField label="Metric" value={ruleForm.metric} onChange={f("metric")} />
              <InputField label="Operator" value={ruleForm.operator} onChange={f("operator")} options={OPERATORS} />
              <InputField label="Threshold" value={ruleForm.threshold} onChange={f("threshold")} type="number" />
              <InputField label="Severity" value={ruleForm.severity} onChange={f("severity")} options={SEVERITIES} />
            </div>
            {formError && (
              <div style={{ padding: 10, borderRadius: 8, background: "#ef444418", border: "1px solid #ef4444", color: C.red, fontSize: 12, marginBottom: 12 }}>
                {formError}
              </div>
            )}
            <button onClick={createRule} disabled={saving} style={{
              background: accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px",
              cursor: "pointer", fontSize: 13, boxShadow: `0 0 16px ${accent}55`, fontWeight: 600, opacity: saving ? 0.6 : 1,
            }}>{saving ? "A criar…" : "Create Rule"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

