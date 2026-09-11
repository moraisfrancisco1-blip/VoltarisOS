import { useEffect, useState } from "react";
import { C, glassCard } from "../components/ChartTheme";
import { useTranslation } from "../i18n/useTranslation";

const API = import.meta.env.VITE_API_URL || "";

const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

// SUPER_ADMIN only — basic platform health check.
// Backend: GET /api/admin/system-health (require_super_admin_or_service).
export default function SuperAdminSystemHealth() {
  const { t } = useTranslation();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/admin/system-health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealth(await res.json());
    } catch (e) {
      setError(t("sa_health_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statusKey =
    health?.status === "healthy" ? "sa_health_ok"
      : health?.status === "degraded" ? "sa_health_degraded"
        : "sa_health_unknown";
  const statusColor =
    health?.status === "healthy" ? C.green
      : health?.status === "degraded" ? C.amber
        : "var(--sub)";

  const kpis = [
    { labelKey: "sa_health_status", value: health ? t(statusKey) : "—", color: statusColor },
    { labelKey: "sa_health_version", value: health?.version ?? "—", color: C.indigo },
    {
      labelKey: "sa_health_timestamp",
      value: health?.timestamp ? new Date(health.timestamp).toLocaleString() : "—",
      color: C.blue,
    },
  ];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{t("page_system_health")}</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 4 }}>{t("sa_health_sub")}</div>
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

      {loading ? (
        <div style={glassCard(C.indigo)}>{t("sa_health_loading")}</div>
      ) : error ? (
        <div style={{ ...glassCard(C.red), color: C.red, fontSize: 13, textAlign: "center" }}>{error}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {kpis.map(k => (
            <div key={k.labelKey} style={glassCard(k.color)}>
              <div style={label}>{t(k.labelKey)}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
