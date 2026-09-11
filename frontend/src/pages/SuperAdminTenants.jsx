import { useEffect, useState } from "react";
import { C, glassCard } from "../components/ChartTheme";
import { useTranslation } from "../i18n/useTranslation";

const API = import.meta.env.VITE_API_URL || "";

const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

// SUPER_ADMIN only — lists every tenant on the platform.
// Backend: GET /api/admin/tenants (require_super_admin_or_service).
export default function SuperAdminTenants() {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{t("page_super_tenants")}</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 4 }}>{t("sa_tenants_sub")}</div>
        </div>
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
    </div>
  );
}
