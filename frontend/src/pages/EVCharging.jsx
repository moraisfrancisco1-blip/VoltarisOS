import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie
} from "recharts";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const card = { background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 20 };
const label = { fontSize: 11, color: "rgba(148,163,184,0.85)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };
const val = { fontSize: 26, fontWeight: 700, color: "#f1f5f9" };

const CustomTooltip = ({ active, payload, label: lb }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginBottom: 4 }}>{lb}</div>
      {payload.map((p, i) => <div key={i} style={{ fontSize: 12, color: p.color }}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  );
};

const CHARGERS = [
  { id: "EV-01", location: "Hub A", power: 50, mode: "smart", v2g: true, soc: 72, status: "charging", vehicle: "Tesla M3" },
  { id: "EV-02", location: "Hub A", power: 22, mode: "solar_only", v2g: false, soc: 55, status: "charging", vehicle: "Renault Zoe" },
  { id: "EV-03", location: "Hub B", power: 150, mode: "v2g", v2g: true, soc: 88, status: "discharging", vehicle: "BYD Atto 3" },
  { id: "EV-04", location: "Hub B", power: 11, mode: "idle", v2g: false, soc: 0, status: "idle", vehicle: "—" },
  { id: "EV-05", location: "Hub C", power: 50, mode: "smart", v2g: true, soc: 31, status: "charging", vehicle: "VW ID.4" },
];

const genSolar = () => Array.from({ length: 24 }, (_, i) => ({
  h: `${i}h`,
  solar: i >= 7 && i <= 19 ? rand(1, 8) : 0,
  ev_demand: rand(0.5, 6),
  bess_buffer: rand(0.5, 3),
  grid: rand(0, 2),
}));

const genSchedule = () => Array.from({ length: 12 }, (_, i) => ({
  slot: `${i * 2}:00`,
  charge: rand(0, 80, 0),
  v2g: rand(0, 40, 0),
  solar_direct: rand(0, 60, 0),
}));

export default function EVCharging() {
  const [chargers, setChargers] = useState(CHARGERS.map(c => ({ ...c })));
  const [solar] = useState(genSolar());
  const [schedule] = useState(genSchedule());
  const [v2gEnabled, setV2gEnabled] = useState(true);
  const [smartMode, setSmartMode] = useState(true);
  const [metrics, setMetrics] = useState({ totalPower: 273, v2gExport: 18.4, solarSelf: 67, sessions: 12, revenue: 480 });
  const [flow, setFlow] = useState({ solar: 8.2, bess: 3.1, grid: 1.4, evTotal: 12.7 });

  useEffect(() => {
    const t = setInterval(() => {
      setMetrics(m => ({
        totalPower: Math.round(m.totalPower + rand(-5, 10)),
        v2gExport: parseFloat((m.v2gExport + rand(-0.5, 0.5)).toFixed(1)),
        solarSelf: Math.min(100, Math.max(20, Math.round(m.solarSelf + rand(-2, 2)))),
        sessions: m.sessions,
        revenue: Math.round(m.revenue + rand(-5, 15)),
      }));
      setFlow(f => ({
        solar: parseFloat((f.solar + rand(-0.3, 0.3)).toFixed(1)),
        bess: parseFloat((f.bess + rand(-0.2, 0.2)).toFixed(1)),
        grid: parseFloat((f.grid + rand(-0.1, 0.1)).toFixed(1)),
        evTotal: parseFloat((f.evTotal + rand(-0.3, 0.4)).toFixed(1)),
      }));
      setChargers(cs => cs.map(c => ({
        ...c,
        soc: c.status === "charging" ? Math.min(100, c.soc + rand(0, 2, 0))
          : c.status === "discharging" ? Math.max(20, c.soc - rand(0, 1, 0))
          : c.soc,
      })));
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const sourceData = [
    { name: "Solar Direct", value: Math.round(metrics.solarSelf * 0.6), fill: amber },
    { name: "BESS Buffer", value: Math.round(metrics.solarSelf * 0.25), fill: purple },
    { name: "Grid Import", value: Math.round(100 - metrics.solarSelf), fill: blue },
  ];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f1f5f9" }}>EV Charging</h1>
          <div style={{ color: "rgba(148,163,184,0.85)", fontSize: 13, marginTop: 2 }}>Solar + BESS + V2G Integration</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {[
            { label: "V2G Mode", val: v2gEnabled, set: setV2gEnabled, color: green },
            { label: "Smart Charging", val: smartMode, set: setSmartMode, color: accent },
          ].map(sw => (
            <div key={sw.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(148,163,184,0.85)" }}>{sw.label}</span>
              <div onClick={() => sw.set(!sw.val)} style={{
                width: 40, height: 22, borderRadius: 11, cursor: "pointer",
                background: sw.val ? sw.color : "rgba(255,255,255,0.08)", position: "relative", transition: "background 0.2s"
              }}>
                <div style={{
                  position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  top: 3, left: sw.val ? 21 : 3, transition: "left 0.2s"
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {[
          { label: "Active Power", value: `${metrics.totalPower} kW`, color: accent },
          { label: "V2G Export", value: `${metrics.v2gExport} kW`, color: purple },
          { label: "Solar Self-Cons.", value: `${metrics.solarSelf}%`, color: amber },
          { label: "Sessions Today", value: metrics.sessions, color: blue },
          { label: "Revenue Today", value: `€${metrics.revenue}`, color: green },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ ...val, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Energy Flow + Source Mix */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Flow */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Energy Flow to EVs</div>
          <svg viewBox="0 0 400 200" style={{ width: "100%", height: 180 }}>
            {/* Sources */}
            {[
              { label: "Solar", val: `${flow.solar} MW`, color: amber, y: 40 },
              { label: "BESS", val: `${flow.bess} MW`, color: purple, y: 100 },
              { label: "Grid", val: `${flow.grid} MW`, color: blue, y: 160 },
            ].map(n => (
              <g key={n.label}>
                <rect x={20} y={n.y - 18} width={90} height={36} rx={8}
                  fill="rgba(255,255,255,0.08)" stroke={n.color} strokeWidth={1.5} />
                <text x={65} y={n.y - 3} textAnchor="middle" fill={n.color} fontSize={11} fontWeight={700}>{n.label}</text>
                <text x={65} y={n.y + 11} textAnchor="middle" fill="#f1f5f9" fontSize={10}>{n.val}</text>
                <line x1={110} y1={n.y} x2={200} y2={100} stroke={n.color} strokeWidth={2} strokeDasharray="4 2" opacity={0.7} />
              </g>
            ))}
            {/* Hub */}
            <rect x={195} y={70} width={80} height={60} rx={10} fill="rgba(255,255,255,0.08)" stroke={green} strokeWidth={2} />
            <text x={235} y={97} textAnchor="middle" fill={green} fontSize={11} fontWeight={700}>EV Hub</text>
            <text x={235} y={113} textAnchor="middle" fill="#f1f5f9" fontSize={10}>{flow.evTotal} MW</text>
            <line x1={275} y1={100} x2={340} y2={100} stroke={green} strokeWidth={2} />
            {/* EV */}
            <rect x={340} y={78} width={50} height={44} rx={8} fill="rgba(255,255,255,0.08)" stroke={green} strokeWidth={1.5} />
            <text x={365} y={98} textAnchor="middle" fill={green} fontSize={11} fontWeight={700}>EVs</text>
            <text x={365} y={114} textAnchor="middle" fill="rgba(148,163,184,0.85)" fontSize={10}>{chargers.filter(c=>c.status==="charging").length} active</text>
          </svg>
        </div>

        {/* Source mix */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Charging Energy Source Mix</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <PieChart width={140} height={140}>
              <Pie data={sourceData} cx={65} cy={65} innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                {sourceData.map((s, i) => <Cell key={i} fill={s.fill} />)}
              </Pie>
            </PieChart>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {sourceData.map(s => (
                <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.fill }} />
                    <span style={{ fontSize: 12, color: "rgba(148,163,184,0.85)" }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{s.value}%</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: green }}>Solar self-consumption: {metrics.solarSelf}%</div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)" }}>Target: &gt;70%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 24h solar vs EV demand */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>24h Solar vs EV Demand vs BESS Buffer</div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={solar} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="h" tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} />
            <YAxis tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} unit=" MW" />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="solar" stackId="1" stroke={amber} fill={amber} fillOpacity={0.3} name="Solar" />
            <Area type="monotone" dataKey="bess_buffer" stackId="1" stroke={purple} fill={purple} fillOpacity={0.3} name="BESS Buffer" />
            <Area type="monotone" dataKey="grid" stackId="1" stroke={blue} fill={blue} fillOpacity={0.2} name="Grid" />
            <Line type="monotone" dataKey="ev_demand" stroke={green} strokeWidth={2.5} dot={false} name="EV Demand" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Smart charging schedule + charger list */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Smart Charging Schedule (24h)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={schedule} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="slot" tick={{ fontSize: 9, fill: "rgba(148,163,184,0.85)" }} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} unit=" kW" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="solar_direct" stackId="a" fill={amber} name="Solar Direct" radius={[0,0,0,0]} />
              <Bar dataKey="bess_buffer" stackId="a" fill={purple} name="BESS Buffer" radius={[0,0,0,0]} />
              <Bar dataKey="charge" stackId="a" fill={blue} name="Grid Charge" radius={[4,4,0,0]} />
              <Bar dataKey="v2g" fill={red} fillOpacity={0.7} name="V2G Export" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {[{c: amber, n:"Solar"},{c: purple, n:"BESS"},{c: blue, n:"Grid"},{c: red, n:"V2G"}].map(l => (
              <div key={l.n} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(148,163,184,0.85)" }}>
                <div style={{ width: 8, height: 8, background: l.c, borderRadius: 2 }} />{l.n}
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ ...label, marginBottom: 10 }}>Charger Status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {chargers.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: c.status === "charging" ? green : c.status === "discharging" ? purple : "rgba(255,255,255,0.08)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9" }}>{c.id} · {c.vehicle}</div>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,0.85)" }}>{c.location} · {c.power} kW · {c.mode}</div>
                </div>
                {c.soc > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 60, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                      <div style={{ width: `${c.soc}%`, height: "100%", background: c.soc > 70 ? green : c.soc > 40 ? amber : red, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 10, color: "rgba(148,163,184,0.85)", width: 32 }}>{c.soc}%</span>
                  </div>
                )}
                {c.v2g && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 8, background: "#a78bfa20", color: purple }}>V2G</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* V2G Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "V2G Capable EVs", value: `${chargers.filter(c=>c.v2g).length} / ${chargers.length}`, color: purple },
          { label: "V2G Export Now", value: `${metrics.v2gExport} kW`, color: red },
          { label: "Grid Revenue (V2G)", value: `€${Math.round(metrics.v2gExport * 0.12 * 24)}`, color: green },
          { label: "BESS Buffer Available", value: `${flow.bess.toFixed(1)} MW`, color: amber },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ ...val, fontSize: 22, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
