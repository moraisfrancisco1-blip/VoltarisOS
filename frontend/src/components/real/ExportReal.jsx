import { C, glassCard } from "../ChartTheme";
import { ago, useApi, RealPage, LoadingCard, ErrorCard, Chip } from "./realShared";

const statusColor = (s) => (s === "done" ? C.green : s === "error" ? C.red : C.amber);

// The real export flow (generate a PDF report, download it) lives on the Reports page, so this
// page points there and lists the tenant's latest report jobs (GET /api/reports).
// Shown when Simulation mode is off; the demo page stays as is.
export default function ExportReal({ onNavigate }) {
  const { data, error } = useApi(["/api/reports"]);
  const title = "Export Center";
  const subtitle = "Reports and downloads";

  if (error) return <RealPage title={title} subtitle={subtitle}><ErrorCard error={error} /></RealPage>;
  if (!data) return <RealPage title={title} subtitle={subtitle}><LoadingCard /></RealPage>;

  const jobs = data[0];

  return (
    <RealPage title={title} subtitle={subtitle}>
      <div style={{ ...glassCard(C.blue), display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Generate and download reports</div>
        <div style={{ color: "var(--sub)", fontSize: 13, lineHeight: 1.6 }}>
          PDF reports about your sites, devices and earnings are created and downloaded on the Reports page.
        </div>
        {onNavigate && (
          <div>
            <button onClick={() => onNavigate("reports")} style={{
              marginTop: 6, background: C.accent, color: "#0b1020", border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>Open Reports</button>
          </div>
        )}
      </div>

      <div style={glassCard(C.green)}>
        <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>
          Latest reports
        </div>
        {jobs.length === 0 ? (
          <div style={{ color: "var(--sub)", fontSize: 13 }}>No reports generated yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {jobs.slice(0, 10).map(j => (
              <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <Chip color={statusColor(j.status)}>{j.status}</Chip>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{j.report_type}</span>
                <span style={{ color: "var(--sub)" }}>{j.period || ""}</span>
                <span style={{ color: "var(--sub)", marginLeft: "auto" }}>{ago(j.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </RealPage>
  );
}
