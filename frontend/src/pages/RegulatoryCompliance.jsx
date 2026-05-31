import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 };
const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

const CustomTooltip = ({ active, payload, label: lb }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{lb}</div>
      {payload.map((p, i) => <div key={i} style={{ fontSize: 12, color: p.color }}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  );
};

function daysLeft(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

const DEADLINES = [
  { id: 1, title: "ERSE Annual Grid Code Report", body: "Entidade Reguladora dos Serviços Energéticos", due: "2025-03-31", status: "done", risk: "low", category: "Regulatory" },
  { id: 2, title: "DGEG BESS Safety Certification", body: "Direção-Geral de Energia e Geologia", due: "2025-06-15", status: "inprogress", risk: "high", category: "Safety" },
  { id: 3, title: "REN Grid Connection Review", body: "Redes Energéticas Nacionais", due: "2025-04-30", status: "done", risk: "medium", category: "Grid" },
  { id: 4, title: "EU Taxonomy Green Reporting", body: "European Commission", due: "2025-12-31", status: "pending", risk: "medium", category: "ESG" },
  { id: 5, title: "Fire Safety Inspection — Évora Site", body: "ANPC (National Fire Authority)", due: "2025-05-20", status: "inprogress", risk: "high", category: "Safety" },
  { id: 6, title: "Environmental Impact Assessment", body: "APA — Agência Portuguesa do Ambiente", due: "2025-09-01", status: "pending", risk: "low", category: "Environmental" },
  { id: 7, title: "FCR Qualification Renewal", body: "ENTSO-E / REN", due: "2025-07-01", status: "inprogress", risk: "medium", category: "Market" },
  { id: 8, title: "ISO 50001 Energy Audit", body: "Bureau Veritas", due: "2025-08-15", status: "pending", risk: "low", category: "ISO" },
  { id: 9, title: "IEC 62933 BESS Standard Compliance", body: "IEC Technical Committee", due: "2025-11-30", status: "pending", risk: "high", category: "Safety" },
  { id: 10, title: "Carbon Disclosure (CDP)", body: "CDP — Carbon Disclosure Project", due: "2025-07-31", status: "done", risk: "low", category: "ESG" },
];

const RADAR_DATA = [
  { category: "Safety", score: 82 },
  { category: "Regulatory", score: 94 },
  { category: "Grid", score: 88 },
  { category: "ESG", score: 76 },
  { category: "Market", score: 71 },
  { category: "Environmental", score: 85 },
  { category: "ISO", score: 68 },
];

export default function RegulatoryCompliance() {
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);

  const filtered = DEADLINES.filter(d => filter === "all" || d.status === filter || d.category === filter);
  const done = DEADLINES.filter(d => d.status === "done").length;
  const inprog = DEADLINES.filter(d => d.status === "inprogress").length;
  const pending = DEADLINES.filter(d => d.status === "pending").length;
  const urgent = DEADLINES.filter(d => daysLeft(d.due) <= 60 && d.status !== "done").length;
  const highRisk = DEADLINES.filter(d => d.risk === "high" && d.status !== "done").length;
  const score = Math.round((done / DEADLINES.length) * 100);

  const statusColor = (s) => s === "done" ? green : s === "inprogress" ? amber : "var(--sub)";
  const statusBg = (s) => s === "done" ? "#10b98120" : s === "inprogress" ? "#f59e0b20" : "var(--surface2)";
  const riskColor = (r) => r === "high" ? red : r === "medium" ? amber : green;

  const barData = [
    { name: "Done", value: done, fill: green },
    { name: "In Progress", value: inprog, fill: amber },
    { name: "Pending", value: pending, fill: "var(--sub)" },
    { name: "Urgent", value: urgent, fill: red },
  ];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Regulatory Compliance</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}>Deadlines · Risk tracking · Certifications · ESG reporting</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ padding: "8px 16px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--sub)", fontSize: 12, cursor: "pointer" }}>
            Export Report
          </button>
          <button onClick={() => setShowModal(true)}
            style={{ padding: "8px 16px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Add Deadline
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {[
          { label: "Compliance Score", value: `${score}%`, color: score > 80 ? green : score > 60 ? amber : red,
            sub: `${done}/${DEADLINES.length} complete` },
          { label: "Urgent (≤60d)", value: urgent, color: urgent > 0 ? red : green, sub: "need action" },
          { label: "High Risk", value: highRisk, color: highRisk > 0 ? red : green, sub: "open items" },
          { label: "In Progress", value: inprog, color: amber, sub: "active items" },
          { label: "Pending", value: pending, color: "var(--sub)", sub: "not started" },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Progress + Radar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Bar summary */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Overall Status Breakdown</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--sub)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {barData.map((b, i) => <Cell key={i} fill={b.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Progress bar */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: "var(--sub)" }}>Overall Progress</span>
              <span style={{ fontWeight: 700, color: green }}>{score}%</span>
            </div>
            <div style={{ height: 8, background: "var(--border)", borderRadius: 4 }}>
              <div style={{ width: `${score}%`, height: "100%", background: score > 80 ? green : amber, borderRadius: 4 }} />
            </div>
          </div>
        </div>

        {/* Radar by category */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 8 }}>Compliance by Category</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={RADAR_DATA} cx="50%" cy="50%" outerRadius={75}>
              <PolarGrid stroke="var(--grid-line)" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "var(--sub)" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} />
              <Radar name="Score" dataKey="score" stroke={accent} fill={accent} fillOpacity={0.25} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["all", "done", "inprogress", "pending", "Safety", "Regulatory", "ESG", "Grid", "Market"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
            background: filter === f ? accent : "var(--surface2)",
            color: filter === f ? "#fff" : "var(--sub)",
            border: `1px solid ${filter === f ? accent : "var(--border)"}`,
          }}>{f === "inprogress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {/* Deadlines table */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Compliance Deadlines ({filtered.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(d => {
            const dl = daysLeft(d.due);
            const isUrgent = dl <= 60 && d.status !== "done";
            return (
              <div key={d.id} style={{
                display: "grid", gridTemplateColumns: "1fr 140px 100px 80px 80px 100px",
                gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 10,
                background: isUrgent ? "#ef444408" : "var(--surface2)",
                border: `1px solid ${isUrgent ? "#ef444430" : "var(--border)"}`,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{d.title}</div>
                  <div style={{ fontSize: 11, color: "var(--sub)" }}>{d.body}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isUrgent ? red : "var(--text)" }}>{d.due}</div>
                  <div style={{ fontSize: 10, color: isUrgent ? red : "var(--sub)" }}>
                    {d.status === "done" ? "Completed" : `${dl}d left`}
                  </div>
                </div>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--sub)" }}>
                  {d.category}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: riskColor(d.risk) }}>
                  {d.risk.charAt(0).toUpperCase() + d.risk.slice(1)} risk
                </span>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12,
                  background: statusBg(d.status), color: statusColor(d.status) }}>
                  {d.status === "inprogress" ? "In Progress" : d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {d.status !== "done" && (
                    <button style={{ padding: "4px 10px", background: "#10b98120", border: "1px solid #10b981", borderRadius: 6, color: green, fontSize: 10, cursor: "pointer" }}>
                      Mark Done
                    </button>
                  )}
                  <button style={{ padding: "4px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--sub)", fontSize: 10, cursor: "pointer" }}>
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add deadline modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 480 }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Add Compliance Deadline</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { l: "Title", type: "text" },
                { l: "Regulatory Body", type: "text" },
                { l: "Due Date", type: "date" },
              ].map(f => (
                <div key={f.l}>
                  <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{f.l}</div>
                  <input type={f.type} style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[{ l: "Category", opts: ["Safety","Regulatory","ESG","Grid","Market","Environmental","ISO"] },
                  { l: "Risk", opts: ["low","medium","high"] }].map(f => (
                  <div key={f.l}>
                    <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{f.l}</div>
                    <select style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13 }}>
                      {f.opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "8px 18px", background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--sub)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => setShowModal(false)} style={{ padding: "8px 18px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
