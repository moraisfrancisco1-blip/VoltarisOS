import { useEffect, useState } from "react";
import { C, glassCard } from "../components/ChartTheme";
import { useTranslation } from "../i18n/useTranslation";
import { useAppStore } from "../store/appStore";

const API = import.meta.env.VITE_API_URL || "";

const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

// Plans supported by the Tenant model (mirrors backend PlanTier).
const PLANS = ["beta", "home", "smart", "starter", "pro", "enterprise"];

const BLANK_FORM = {
  name: "", slug: "", plan: "beta",
  max_sites: "", max_devices: "",
  primary_color: "#f59e0b", logo_url: "",
  // Optional first user for the new tenant (onboarding).
  admin_name: "", admin_email: "", admin_password: "",
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const inputStyle = {
  width: "100%", padding: "9px 12px", background: "var(--surface2)",
  border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)",
  fontSize: 13, outline: "none", boxSizing: "border-box",
};

function Field({ label: lbl, hint, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: "var(--sub)", marginBottom: 6 }}>
        {lbl}{required ? " *" : ""}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// SUPER_ADMIN only — lists every tenant on the platform.
// Backend: GET /api/admin/tenants (require_super_admin_or_service).
export default function SuperAdminTenants() {
  const { t } = useTranslation();
  const addToast = useAppStore(s => s.addToast);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  // Credentials of the first user just created (temporary password shown once).
  const [credentials, setCredentials] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/admin/tenants`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTenants(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(t("sa_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openForm = () => { setForm({ ...BLANK_FORM }); setFormError(null); setShowForm(true); };

  const create = async () => {
    if (!form.name.trim()) { setFormError(t("sa_required_name")); return; }
    const adminEmail = form.admin_email.trim().toLowerCase();
    if (adminEmail && !EMAIL_RE.test(adminEmail)) { setFormError(t("sa_invalid_email")); return; }
    if (adminEmail && form.admin_password && form.admin_password.length < 8) {
      setFormError(t("sa_short_password")); return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        plan: form.plan,
        primary_color: form.primary_color || undefined,
        logo_url: form.logo_url.trim() || undefined,
      };
      if (form.slug.trim()) payload.slug = form.slug.trim();
      if (form.max_sites !== "") payload.max_sites = Number(form.max_sites);
      if (form.max_devices !== "") payload.max_devices = Number(form.max_devices);
      // Optional first user (TENANT_ADMIN) with a temporary password the
      // account must change on first login.
      if (adminEmail) {
        payload.admin_email = adminEmail;
        if (form.admin_name.trim()) payload.admin_name = form.admin_name.trim();
        if (form.admin_password) payload.admin_password = form.admin_password;
      }

      const res = await fetch(`${API}/api/admin/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || t("sa_create_error"));

      if (data.first_user) {
        setCredentials({
          email: data.first_user.email,
          name: data.first_user.name,
          password: data.first_user.temporary_password || form.admin_password,
        });
        addToast(t("sa_created_user"), "success");
      } else {
        addToast(t("sa_created"), "success");
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setFormError(e.message || t("sa_create_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{t("page_super_tenants")}</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 4 }}>{t("sa_tenants_sub")}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={openForm}
            style={{
              padding: "8px 18px", background: C.indigo, color: "#fff",
              border: "none", borderRadius: 8, cursor: "pointer",
              fontSize: 13, fontWeight: 700,
            }}
          >
            {t("sa_add_tenant")}
          </button>
          <button
            onClick={load}
            style={{
              padding: "8px 18px", background: `${C.indigo}18`, color: C.indigo,
              border: `1px solid ${C.indigo}44`, borderRadius: 8, cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >
            {t("sa_refresh")}
          </button>
        </div>
      </div>

      {/* First-user credentials — the temporary password is shown only once */}
      {credentials && (
        <div style={{ ...glassCard(C.amber), border: `1px solid ${C.amber}66` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>
              {t("sa_first_user_title")} — {credentials.name}
            </div>
            <button
              onClick={() => setCredentials(null)}
              style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", fontSize: 14 }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--sub)", marginBottom: 10 }}>{t("sa_temp_pass_once")}</div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "10px 12px", fontFamily: "monospace", fontSize: 13, color: "var(--text)",
          }}>
            <span data-testid="first-user-credentials">{credentials.email} · {credentials.password}</span>
            <button
              onClick={() => navigator.clipboard?.writeText(`${credentials.email} · ${credentials.password}`)}
              style={{
                padding: "5px 12px", background: `${C.amber}22`, color: C.amber,
                border: `1px solid ${C.amber}55`, borderRadius: 6, cursor: "pointer",
                fontSize: 11, fontWeight: 600, flexShrink: 0,
              }}
            >
              {t("sa_copy")}
            </button>
          </div>
        </div>
      )}

      <div style={glassCard(C.indigo)}>
        <div style={{ ...label, marginBottom: 12 }}>{t("page_super_tenants")} ({tenants.length})</div>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>{t("sa_loading")}</div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: "center", color: C.red, fontSize: 13 }}>{error}</div>
        ) : tenants.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>{t("sa_empty")}</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[t("sa_col_name"), t("sa_col_slug"), t("sa_col_plan"), t("sa_col_max_sites"), t("sa_col_status"), t("sa_col_created")].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, color: "var(--sub)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map(tn => (
                <tr key={tn.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{tn.name}</td>
                  <td style={{ padding: "10px", fontSize: 12, color: "var(--sub)", fontFamily: "monospace" }}>{tn.slug}</td>
                  <td style={{ padding: "10px", fontSize: 12, color: "var(--text)", textTransform: "capitalize" }}>{tn.plan}</td>
                  <td style={{ padding: "10px", fontSize: 12, color: "var(--sub)" }}>{tn.max_sites ?? "—"}</td>
                  <td style={{ padding: "10px" }}>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 10,
                      background: tn.active ? `${C.green}18` : `${C.red}18`,
                      color: tn.active ? C.green : C.red,
                      border: `1px solid ${tn.active ? C.green : C.red}44`,
                    }}>{tn.active ? t("sa_active") : t("sa_inactive")}</span>
                  </td>
                  <td style={{ padding: "10px", fontSize: 12, color: "var(--sub)" }}>
                    {tn.created_at ? new Date(tn.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div
          onClick={() => { if (!saving) setShowForm(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(5,10,20,0.72)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 540, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 16, padding: 24,
            }}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              {t("sa_form_title")}
            </h2>

            <Field label={t("sa_col_name")} required>
              <input value={form.name} onChange={set("name")} autoFocus style={inputStyle} />
            </Field>

            <Field label={t("sa_field_slug")} hint={t("sa_slug_hint")}>
              <input value={form.slug} onChange={set("slug")} placeholder={t("sa_field_slug_ph")} style={inputStyle} />
            </Field>

            <Field label={t("sa_col_plan")}>
              <select value={form.plan} onChange={set("plan")} style={inputStyle}>
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label={t("sa_col_max_sites")}>
                <input type="number" min="1" value={form.max_sites} onChange={set("max_sites")} style={inputStyle} />
              </Field>
              <Field label={t("sa_field_max_devices")}>
                <input type="number" min="1" value={form.max_devices} onChange={set("max_devices")} style={inputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label={t("sa_field_color")}>
                <input value={form.primary_color} onChange={set("primary_color")} placeholder="#f59e0b" style={inputStyle} />
              </Field>
              <Field label={t("sa_field_logo")}>
                <input value={form.logo_url} onChange={set("logo_url")} placeholder="https://..." style={inputStyle} />
              </Field>
            </div>

            {/* ── Optional first user (tenant onboarding) ─────────────────── */}
            <div style={{ marginTop: 4, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{t("sa_first_user_title")}</div>
              <div style={{ fontSize: 11, color: "var(--sub)", margin: "2px 0 12px" }}>{t("sa_first_user_hint")}</div>

              <Field label={t("sa_field_admin_name")}>
                <input value={form.admin_name} onChange={set("admin_name")} style={inputStyle} />
              </Field>

              <Field label={t("sa_field_admin_email")}>
                <input value={form.admin_email} onChange={set("admin_email")} placeholder="nome@empresa.com" style={inputStyle} />
              </Field>

              <Field label={t("sa_field_admin_pass")} hint={t("sa_admin_pass_ph")}>
                <input value={form.admin_password} onChange={set("admin_password")} style={inputStyle} />
              </Field>
            </div>

            {formError && (
              <div style={{
                padding: 10, borderRadius: 8, marginBottom: 14,
                background: `${C.red}18`, border: `1px solid ${C.red}`, color: C.red, fontSize: 12,
              }}>
                {formError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowForm(false)}
                disabled={saving}
                style={{
                  padding: "9px 18px", background: "none", border: "1px solid var(--border)",
                  borderRadius: 8, color: "var(--sub)", cursor: "pointer", fontSize: 13,
                }}
              >
                {t("um_cancel")}
              </button>
              <button
                onClick={create}
                disabled={saving}
                style={{
                  padding: "9px 20px", background: C.indigo, border: "none", borderRadius: 8,
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? t("state_creating") : t("sa_create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
