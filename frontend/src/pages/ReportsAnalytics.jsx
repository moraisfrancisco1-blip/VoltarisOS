import { useState, useEffect } from "react";
import { C, glassCard } from "../components/ChartTheme";

const API = import.meta.env.VITE_API_URL || "";

const REPORT_TYPES = ["monthly", "investor", "due_diligence", "regulatory", "carbon"];
const TYPE_LABEL = {
  monthly: "Monthly Performance",
  investor: "Investor",
  due_diligence: "Due Diligence",
  regulatory: "Regulatory Compliance",
  carbon: "Carbon & ESG",
};

const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };
const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const statusColor = (s) =>
  s === "done" ? C.green : s === "error" ? C.red : s === "running" ? C.amber : "rgba(148,163,184,0.85)";

export default function ReportsAnalytics() {
  const [jobs, setJobs] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    report_type: "monthly",
    period: "",
    site_ids: [],
    include_forecast: false,
    include_carbon: false,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/reports`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Não foi possível carregar os relatórios.");
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      const res = await fetch(`${API}/api/sites`);
      if (!res.ok) return;
      const data = await res.json();
      setSites(Array.isArray(data) ? data : []);
    } catch (e) { /* sites selector is optional */ }
  };

  useEffect(() => {
    loadJobs();
    loadSites();
  }, []);

  const generate = async () => {
    if (!form.report_type) { setFormError("Tipo de relatório obrigatório."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        report_type: form.report_type,
        ...(form.period ? { period: form.period } : {}),
        ...(form.site_ids && form.site_ids.length ? { site_ids: form.site_ids } : {}),
        include_forecast: form.include_forecast,
        include_carbon: form.include_carbon,
        currency: "EUR",
        language: "en",
      };
      const res = await fetch(`${API}/api/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).detail || ""; } catch (e) { /* ignore */ }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      setForm({ ...form, period: "" });
      await loadJobs();
    } catch (e) {
      setFormError(e.message || "Erro ao gerar o relatório.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSite = (id) => {
    setForm(f => ({
      ...f,
      site_ids: f.site_ids.includes(id) ? f.site_ids.filter(x => x !== id) : [...f.site_ids, id],
    }));
  };

  const download = (id) => { window.open(`${API}/api/reports/${id}/download`, "_blank"); };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Reports & Analytics</h1>
        <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}>Generate and download reports from real data</div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "#ef444418", border: "1px solid #ef4444", color: C.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        {/* Generate form */}
        <div style={glassCard(C.indigo)}>
          <div style={{ ...label, marginBottom: 12 }}>Generate Report</div>

          <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>Report Type</div>
          <select value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}
            style={{ width: "100%", background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13, marginBottom: 14 }}>
            {REPORT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>

          <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>Period (YYYY-MM, optional)</div>
          <input value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} placeholder="2025-05"
            style={{ width: "100%", background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13, boxSizing: "border-box", marginBottom: 14 }} />

          <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>Sites (optional)</div>
          {sites.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--sub)", marginBottom: 14 }}>Sem sites disponíveis.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
              {sites.map(s => (
                <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.site_ids.includes(s.id)} onChange={() => toggleSite(s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", marginBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={form.include_carbon} onChange={e => setForm(f => ({ ...f, include_carbon: e.target.checked }))} />
            Include carbon section
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", marginBottom: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={form.include_forecast} onChange={e => setForm(f => ({ ...f, include_forecast: e.target.checked }))} />
            Include forecast section
          </label>

          {formError && (
            <div style={{ padding: 10, borderRadius: 8, background: "#ef444418", border: "1px solid #ef4444", color: C.red, fontSize: 12, marginBottom: 12 }}>
              {formError}
            </div>
          )}

          <button onClick={generate} disabled={saving}
            style={{ background: C.indigo, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            {saving ? "A gerar…" : "Generate Report"}
          </button>
        </div>


        {/* Jobs list */}
        <div style={glassCard(C.blue)}>
          <div style={{ ...label, marginBottom: 12 }}>Reports ({jobs.length})</div>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Carregando relatórios…</div>
          ) : error && jobs.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Não foi possível carregar os relatórios.</div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Sem relatórios. Gera o primeiro acima.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  {["Type", "Period", "Status", "Requested By", "Created", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "5px 10px", fontSize: 10, color: "var(--sub)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{TYPE_LABEL[job.report_type] || job.report_type}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--sub)" }}>{job.period || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${statusColor(job.status)}18`, color: statusColor(job.status), border: `1px solid ${statusColor(job.status)}44` }}>{job.status}</span>
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--sub)" }}>{job.requested_by || "—"}</td>
                    <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--sub)" }}>{fmt(job.created_at)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {job.status === "done" ? (
                        <button onClick={() => download(job.id)}
                          style={{ padding: "4px 10px", background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}44`, borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Download</button>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--sub)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

