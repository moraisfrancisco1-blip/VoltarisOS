import { useState, useEffect } from "react";
import { C, glassCard } from "../components/ChartTheme";

const API = import.meta.env.VITE_API_URL || "";

const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

// Latest-reading power values are numeric or null (no telemetry). Solar/BESS
// are derived from device_type; Grid/Load are not derivable from the backend.
function PowerFlowDiagram({ solar, bess, grid, load, hub }) {
  const nodes = [
    { id: "solar", label: "Solar", value: solar, color: C.amber, x: 90, y: 70 },
    { id: "bess",  label: "BESS",  value: bess,  color: C.purple, x: 90, y: 200 },
    { id: "grid",  label: "Grid",  value: grid,  color: C.blue,   x: 90, y: 330 },
    { id: "load",  label: "Load",  value: load,  color: C.green,  x: 490, y: 200 },
  ];
  const HUB = { x: 290, y: 200 };
  const flows = [
    { x1: 140, y1: 70,  x2: HUB.x - 44, y2: 185, color: C.amber,  width: 3 },
    { x1: 140, y1: 200, x2: HUB.x - 44, y2: 200, color: C.purple, width: 3 },
    { x1: 140, y1: 330, x2: HUB.x - 44, y2: 215, color: C.blue,   width: 3 },
    { x1: HUB.x + 44, y1: 200, x2: 440, y2: 200, color: C.green,  width: 3.5 },
  ];

  return (
    <svg viewBox="0 0 580 400" style={{ width: "100%", height: 360 }}>
      <defs>
        <radialGradient id="loadGlow2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.green} stopOpacity={0.25} />
          <stop offset="100%" stopColor={C.green} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.accent} stopOpacity={0.2} />
          <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
        </radialGradient>
        <filter id="nodeGlow2">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <circle cx={HUB.x} cy={HUB.y} r={55} fill="url(#hubGlow)" />
      <circle cx={490} cy={200} r={55} fill="url(#loadGlow2)" />

      {flows.map((f, i) => (
        <g key={i}>
          <line x1={f.x1} y1={f.y1 + 3} x2={f.x2} y2={f.y2 + 3}
            stroke="#000" strokeWidth={f.width + 5} opacity={0.18} strokeLinecap="round" />
          <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2}
            stroke={f.color} strokeWidth={f.width + 7} opacity={0.07} strokeLinecap="round" />
          <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2}
            stroke={f.color} strokeWidth={f.width} strokeDasharray="12 8"
            opacity={0.9} strokeLinecap="round" />
        </g>
      ))}

      <rect x={HUB.x - 48} y={HUB.y - 27} width={96} height={54} rx={14} fill="#000" opacity={0.25} />
      <rect x={HUB.x - 52} y={HUB.y - 31} width={104} height={62} rx={16} fill={C.accent} opacity={0.08} />
      <rect x={HUB.x - 50} y={HUB.y - 29} width={100} height={58} rx={14}
        fill="var(--surface)" stroke={C.accent} strokeWidth={2} />
      <rect x={HUB.x - 48} y={HUB.y - 27} width={96} height={4} rx={4} fill="var(--surface2)" />
      <text x={HUB.x} y={HUB.y - 7} textAnchor="middle" fill={C.accent} fontSize={9.5} fontWeight={800}
        letterSpacing={1}>VPP HUB</text>
      <text x={HUB.x} y={HUB.y + 13} textAnchor="middle" fill="var(--text)" fontSize={12} fontWeight={900}
        style={{ filter: `drop-shadow(0 0 6px ${C.accent}80)` }}>{hub != null ? `${hub.toFixed(1)} kW` : "Sem dados"}</text>

      {nodes.map(n => (
        <g key={n.id}>
          <rect x={n.x - 56} y={n.y - 24} width={112} height={48} rx={12} fill="#000" opacity={0.25} />
          <rect x={n.x - 54} y={n.y - 22} width={108} height={44} rx={10}
            fill="var(--surface)" stroke={n.color} strokeWidth={1.5} />
          <text x={n.x} y={n.y - 2} textAnchor="middle" fill={n.color} fontSize={9} fontWeight={800}
            letterSpacing={1}>{n.label.toUpperCase()}</text>
          <text x={n.x} y={n.y + 14} textAnchor="middle" fill="var(--text)" fontSize={11} fontWeight={800}>
            {n.value != null ? `${n.value.toFixed(1)} kW` : "—"}
          </text>
        </g>
      ))}
    </svg>
  );
}
export default function Dashboard({ setPage }) {
  const [sites, setSites] = useState([]);
  const [devices, setDevices] = useState([]);
  const [readings, setReadings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const sitesRes = await fetch(`${API}/api/sites`);
      if (!sitesRes.ok) throw new Error(`sites HTTP ${sitesRes.status}`);
      const sitesData = await sitesRes.json();

      const devRes = await fetch(`${API}/api/devices`);
      if (!devRes.ok) throw new Error(`devices HTTP ${devRes.status}`);
      const devicesData = await devRes.json();
      const devList = Array.isArray(devicesData) ? devicesData : [];

      // One latest reading per device.
      const entries = await Promise.all(devList.map(async (d) => {
        try {
          const r = await fetch(`${API}/api/devices/${d.id}/readings?limit=1`);
          if (!r.ok) return [d.id, null];
          const rows = await r.json();
          return [d.id, Array.isArray(rows) && rows.length ? rows[0] : null];
        } catch (e) { return [d.id, null]; }
      }));

      setSites(Array.isArray(sitesData) ? sitesData : []);
      setDevices(devList);
      setReadings(Object.fromEntries(entries));
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (e) {
      setError("Não foi possível carregar o dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  // ── KPIs (real) ───────────────────────────────────────────────────────────
  const totalSites = sites.length;
  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.status === "online").length;
  const totalSolarKw = sites.reduce((a, s) => a + (Number(s.solar_kw) || 0), 0);
  const totalBessKwh = sites.reduce((a, s) => a + (Number(s.battery_kwh) || 0), 0);

  const lastPower = (d) => { const r = readings[d.id]; return r && r.power_kw != null ? r.power_kw : null; };
  const currentPowerKw = devices.reduce((a, d) => { const p = lastPower(d); return a + (p != null ? p : 0); }, 0);

  // Power flow (only what the schema supports; Grid/Load not derivable).
  const solarPower = devices
    .filter(d => d.device_type === "solar" || d.device_type === "inverter")
    .reduce((a, d) => { const p = lastPower(d); return a + (p != null ? p : 0); }, 0);
  const bessPower = devices
    .filter(d => d.device_type === "battery")
    .reduce((a, d) => { const p = lastPower(d); return a + (p != null ? p : 0); }, 0);
  const hasTelemetry = devices.some(d => lastPower(d) != null);

  // Per-site summary for the health table.
  const siteRows = sites.map(s => {
    const devs = devices.filter(d => d.site_id === s.id);
    const power = devs.reduce((a, d) => { const p = lastPower(d); return a + (p != null ? p : 0); }, 0);
    const online = devs.filter(d => d.status === "online").length;
    return { site: s, devCount: devs.length, online, power };
  });

  const kpis = [
    { label: "Total Sites", value: totalSites, color: "var(--text)" },
    { label: "Total Devices", value: totalDevices, color: C.blue },
    { label: "Online Devices", value: onlineDevices, color: C.green },
    { label: "Solar Capacity", value: `${totalSolarKw.toFixed(1)} kW`, color: C.amber },
    { label: "Battery Capacity", value: `${totalBessKwh.toFixed(1)} kWh`, color: C.purple },
    { label: "Current Power", value: `${currentPowerKw.toFixed(1)} kW`, color: C.green },
  ];


  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "var(--text)", letterSpacing: -0.8,
            textShadow: `0 0 30px ${C.accent}40` }}>Operations Center</h1>
          <div style={{ color: "var(--sub)", fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 7 }}>
            {lastUpdated ? `Atualizado: ${lastUpdated}` : "A carregar…"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={loadDashboard} disabled={refreshing || loading} style={{
            padding: "8px 16px", background: C.accent, border: "none", borderRadius: 8,
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: refreshing || loading ? 0.6 : 1,
          }}>{refreshing ? "A atualizar…" : "Refresh"}</button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "#ef444418", border: "1px solid #ef4444", color: C.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}>
        {kpis.map(k => (
          <div key={k.label} style={glassCard(k.color)}>
            <div style={label}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Carregando dashboard…</div>
      ) : error && sites.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Não foi possível carregar os dados.</div>
      ) : sites.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>
          Sem sites disponíveis. Cria um site para começar.
        </div>
      ) : (
        <>


          {/* Power flow */}
          <div style={glassCard(C.accent)}>
            <div style={{ ...label, marginBottom: 8 }}>Power Flow (current telemetry)</div>
            {hasTelemetry ? (
              <PowerFlowDiagram
                solar={solarPower > 0 ? solarPower : (solarPower === 0 && devices.some(d => (d.device_type === "solar" || d.device_type === "inverter") && lastPower(d) != null) ? solarPower : null)}
                bess={bessPower > 0 || devices.some(d => d.device_type === "battery" && lastPower(d) != null) ? bessPower : null}
                grid={null}
                load={null}
                hub={currentPowerKw}
              />
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>
                Sem dados de telemetria (sem readings recentes). Adiciona dispositivos com ingestão de leituras.
              </div>
            )}
          </div>

          {/* Site health */}
          <div style={glassCard(C.blue)}>
            <div style={{ ...label, marginBottom: 12 }}>Site Health Summary</div>
            {siteRows.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Sem sites.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                    {["Site", "Location", "Status", "Solar kW", "BESS kWh", "Devices", "Online", "Power kW"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: "var(--sub)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {siteRows.map(({ site, devCount, online, power }) => (
                    <tr key={site.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{site.name}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--sub)" }}>{site.location || "—"}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}44` }}>{site.status || "—"}</span>
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.amber }}>{Number(site.solar_kw || 0).toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.purple }}>{Number(site.battery_kwh || 0).toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--text)" }}>{devCount}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.green }}>{online} / {devCount}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.green }}>{power.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

