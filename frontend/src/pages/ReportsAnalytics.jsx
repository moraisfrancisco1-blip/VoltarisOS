import { useState } from "react";

const accent = "#6366f1";
const card = { background: "rgba(15,18,32,0.92)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 24 };

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const mockData = {
  monthly: months.map((m, i) => ({
    month: m,
    solar: Math.round(300 + Math.sin(i / 2) * 120 + Math.random() * 30),
    revenue: Math.round(800 + Math.sin(i / 2) * 300 + Math.random() * 80),
    grid: Math.round(150 + Math.sin(i / 3) * 50 + Math.random() * 20),
    savings: Math.round(200 + Math.sin(i / 2.5) * 80 + Math.random() * 30),
  })),
  sites: [
    { name: "Rotterdam", solar: 3840, revenue: 10200, uptime: 99.2, co2: 1920, peakPower: 480 },
    { name: "Rebordelo", solar: 2610, revenue: 7400, uptime: 98.7, co2: 1305, peakPower: 310 },
  ],
};

const BarChart = ({ data, key1, key2, label1, label2, color1, color2, height = 120 }) => {
  const maxVal = Math.max(...data.map(d => Math.max(d[key1], d[key2] || 0)));
  return (
    <div>
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height, paddingBottom: 20, position: "relative" }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", gap: 1, alignItems: "flex-end" }}>
            <div title={`${label1}: ${d[key1]}`} style={{
              flex: 1, height: `${(d[key1] / maxVal) * 100}%`,
              background: color1, borderRadius: "3px 3px 0 0", minWidth: 4,
            }} />
            {key2 && (
              <div title={`${label2}: ${d[key2]}`} style={{
                flex: 1, height: `${(d[key2] / maxVal) * 100}%`,
                background: color2, borderRadius: "3px 3px 0 0", minWidth: 4,
              }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "rgba(148,163,184,0.6)" }}>{d.month}</div>
        ))}
      </div>
    </div>
  );
};

const downloadCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(","), ...data.map(row => keys.map(k => row[k]).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function ReportsAnalytics() {
  const [period, setPeriod] = useState("year");
  const [tab, setTab] = useState("overview");

  const totalSolar = mockData.sites.reduce((a, s) => a + s.solar, 0);
  const totalRevenue = mockData.sites.reduce((a, s) => a + s.revenue, 0);
  const totalCO2 = mockData.sites.reduce((a, s) => a + s.co2, 0);
  const avgUptime = (mockData.sites.reduce((a, s) => a + s.uptime, 0) / mockData.sites.length).toFixed(1);

  const reports = [
    { name: "Monthly Energy Report — May 2025", size: "142 KB", date: "Jun 1, 2025", type: "PDF" },
    { name: "Q1 2025 Financial Summary", size: "98 KB", date: "Apr 2, 2025", type: "XLSX" },
    { name: "Annual VPP Performance 2024", size: "3.2 MB", date: "Jan 15, 2025", type: "PDF" },
    { name: "Battery Degradation Analysis", size: "210 KB", date: "Mar 10, 2025", type: "PDF" },
    { name: "ENTSO-E Price Correlation Report", size: "88 KB", date: "May 20, 2025", type: "CSV" },
  ];

  return (
    <div style={{ padding: 32, color: "#f1f5f9", minHeight: "100vh", background: "rgba(10,12,24,0.98)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Reports & Analytics</h1>
          <p style={{ color: "rgba(148,163,184,0.6)" }}>Performance analysis, energy charts, and export</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => downloadCSV(mockData.monthly, "voltaris_monthly_energy.csv")} style={{
            background: "#064e3b", color: "#10b981", border: "none",
            borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13,
          }}>↓ Export CSV</button>
          <button onClick={() => downloadCSV(mockData.sites, "voltaris_site_summary.csv")} style={{
            background: accent, color: "#fff", border: "none",
            borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13,
          }}>↓ Site Summary</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Solar Gen.", value: `${(totalSolar / 1000).toFixed(1)} MWh`, sub: "this year", color: "#f59e0b" },
          { label: "Total Revenue", value: `€${totalRevenue.toLocaleString()}`, sub: "this year", color: "#10b981" },
          { label: "CO₂ Avoided", value: `${totalCO2.toLocaleString()} kg`, sub: "vs. grid baseline", color: "#60a5fa" },
          { label: "Fleet Uptime", value: `${avgUptime}%`, sub: "avg across sites", color: accent },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ color: "rgba(148,163,184,0.6)", fontSize: 12, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ color: "rgba(148,163,184,0.6)", fontSize: 12 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(15,18,32,0.92)", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid rgba(255,255,255,0.08)" }}>
        {["overview", "by-site", "reports"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? accent : "transparent",
            color: tab === t ? "#fff" : "#6b7280",
            border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 500,
          }}>{t.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Monthly Solar Generation (kWh)</h3>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#f59e0b" }}>■ Rotterdam</span>
              <span style={{ fontSize: 12, color: "#6366f1" }}>■ Rebordelo</span>
            </div>
            <BarChart data={mockData.monthly} key1="solar" key2="grid" label1="Solar" label2="Grid"
              color1="#f59e0b" color2="#6366f1" height={130} />
          </div>
          <div style={card}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Monthly Revenue (€)</h3>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#10b981" }}>■ Revenue</span>
              <span style={{ fontSize: 12, color: "#6366f1" }}>■ Savings</span>
            </div>
            <BarChart data={mockData.monthly} key1="revenue" key2="savings" label1="Revenue" label2="Savings"
              color1="#10b981" color2="#6366f1" height={130} />
          </div>

          {/* Monthly table */}
          <div style={{ ...card, gridColumn: "span 2" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Monthly Breakdown</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "rgba(148,163,184,0.6)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Month", "Solar (kWh)", "Grid Exchange (kWh)", "Revenue (€)", "Savings (€)"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockData.monthly.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #0d1117" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{row.month}</td>
                    <td style={{ padding: "8px 12px", color: "#f59e0b" }}>{row.solar.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px" }}>{row.grid.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px", color: "#10b981" }}>€{row.revenue.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px" }}>€{row.savings.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "by-site" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mockData.sites.map(site => (
            <div key={site.name} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{site.name}</h3>
                <button onClick={() => downloadCSV([site], `voltaris_${site.name.toLowerCase()}.csv`)}
                  style={{ background: "#1f2937", color: "rgba(148,163,184,0.6)", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>
                  Export
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
                {[
                  { label: "Solar Generated", val: `${site.solar.toLocaleString()} kWh` },
                  { label: "Revenue", val: `€${site.revenue.toLocaleString()}` },
                  { label: "Uptime", val: `${site.uptime}%` },
                  { label: "CO₂ Avoided", val: `${site.co2.toLocaleString()} kg` },
                  { label: "Peak Power", val: `${site.peakPower} kW` },
                ].map(m => (
                  <div key={m.label} style={{ background: "rgba(255,255,255,0.04)", padding: 14, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "rgba(148,163,184,0.6)" }}>{m.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "reports" && (
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Generated Reports</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "rgba(148,163,184,0.6)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {["Report Name", "Date", "Size", "Type", ""].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #0d1117" }}>
                  <td style={{ padding: "10px 12px" }}>{r.name}</td>
                  <td style={{ padding: "10px 12px", color: "rgba(148,163,184,0.6)" }}>{r.date}</td>
                  <td style={{ padding: "10px 12px", color: "rgba(148,163,184,0.6)" }}>{r.size}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#1f2937" }}>{r.type}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button style={{ background: accent, color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
