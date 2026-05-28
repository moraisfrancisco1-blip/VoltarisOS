import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend, Cell
} from "recharts";

const accent = "#6366f1";
const green = "#10b981";
const amber = "#f59e0b";
const red = "#ef4444";
const blue = "#60a5fa";
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 };

const Toggle = ({ value, onChange, label, desc, badge, revenue }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        {badge && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "#064e3b", color: "#10b981" }}>{badge}</span>}
      </div>
      {desc && <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 2 }}>{desc}</div>}
    </div>
    {revenue && <span style={{ fontSize: 12, color: green, marginRight: 12 }}>+€{revenue}/h</span>}
    <div onClick={() => onChange(!value)} style={{
      width: 40, height: 22, borderRadius: 11, background: value ? accent : "#374151",
      cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0
    }}>
      <div style={{ position: "absolute", top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--tooltip-bg,#1a1f2e)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: "var(--sub)", marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", gap: 12, justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const MARKET_TABS = ["FCR", "aFRR", "mFRR", "TERRE", "imFRR"];

export default function GridServices() {
  const [services, setServices] = useState({
    fcr: true, afrr: true, mfrr: false, peakShave: true,
    spinReserve: false, curtailment: true, voltageReg: false, blackStart: false,
    dr: true, synthetic_inertia: false
  });
  const [freqValue, setFreqValue] = useState(50.0);
  const [activeDR, setActiveDR] = useState(false);
  const [drCountdown, setDrCountdown] = useState(0);
  const [marketTab, setMarketTab] = useState("FCR");
  const [drActiveEvent, setDrActiveEvent] = useState(null);
  const [dispatchLog, setDispatchLog] = useState([]);

  // Live frequency
  useEffect(() => {
    const t = setInterval(() => {
      setFreqValue(v => Math.round(Math.max(49.5, Math.min(50.5, v + (Math.random() - 0.5) * 0.06)) * 1000) / 1000);
    }, 800);
    return () => clearInterval(t);
  }, []);

  // DR countdown
  useEffect(() => {
    if (!activeDR) return;
    const evt = { id: Date.now(), type: "Demand Response", target: 150, start: new Date().toLocaleTimeString() };
    setDrActiveEvent(evt);
    setDrCountdown(1800);
    const t = setInterval(() => setDrCountdown(v => {
      if (v <= 1) { setActiveDR(false); setDrActiveEvent(null); return 0; }
      return v - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [activeDR]);

  // Auto dispatch log
  useEffect(() => {
    const t = setInterval(() => {
      const events = [
        "FCR-N: Discharged 45 kW (freq dip)",
        "FCR-D: Charged 120 kW (freq surge)",
        "aFRR Up: +80 kW activated",
        "Peak Shaving: load capped at 420 kW",
        "Curtailment absorbed: 95 kW solar excess",
      ];
      setDispatchLog(prev => [{
        time: new Date().toLocaleTimeString(),
        msg: events[Math.floor(Math.random() * events.length)],
        revenue: (Math.random() * 15 + 2).toFixed(2),
      }, ...prev.slice(0, 9)]);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const freqDev = Math.abs(freqValue - 50.0);
  const freqColor = freqDev < 0.1 ? green : freqDev < 0.2 ? amber : red;
  const formatTime = s => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // Market data
  const freqHistory = Array.from({ length: 60 }, (_, i) => ({
    t: `${i}s`, freq: 50 + (Math.random() - 0.5) * 0.4,
    response: Math.abs(Math.random() - 0.5) * 200
  }));

  const revenueData = Array.from({ length: 24 }, (_, i) => ({
    h: `${i}:00`,
    fcr: +(Math.random() * 8 + 2).toFixed(1),
    afrr: +(Math.random() * 12 + 3).toFixed(1),
    dr: i >= 17 && i <= 20 ? +(Math.random() * 30 + 10).toFixed(1) : 0,
    peakshave: i >= 8 && i <= 10 ? +(Math.random() * 10 + 2).toFixed(1) : 0,
  }));

  const capacityAlloc = [
    { label: "FCR-N / FCR-D", pct: 25, kw: 187, color: accent, active: services.fcr },
    { label: "aFRR Up/Down", pct: 20, kw: 150, color: blue, active: services.afrr },
    { label: "Demand Response", pct: 20, kw: 150, color: green, active: services.dr },
    { label: "Peak Shaving", pct: 15, kw: 112, color: amber, active: services.peakShave },
    { label: "Energy Arbitrage", pct: 12, kw: 90, color: "#a78bfa", active: true },
    { label: "Curtailment Mgmt", pct: 8, kw: 61, color: "#34d399", active: services.curtailment },
  ];

  const marketPrices = {
    FCR: [{ product: "FCR-N Up", price: "42.50 €/MW/h", bid: "35 MW", status: "Won", color: green }, { product: "FCR-N Down", price: "38.20 €/MW/h", bid: "35 MW", status: "Won", color: green }, { product: "FCR-D Up", price: "88.10 €/MW/h", bid: "20 MW", status: "Pending", color: amber }, { product: "FCR-D Down", price: "71.40 €/MW/h", bid: "20 MW", status: "Pending", color: amber }],
    aFRR: [{ product: "aFRR Capacity Up", price: "52.00 €/MW/h", bid: "50 MW", status: "Won", color: green }, { product: "aFRR Capacity Down", price: "48.80 €/MW/h", bid: "50 MW", status: "Won", color: green }, { product: "aFRR Energy", price: "110.00 €/MWh", bid: "N/A", status: "Settled", color: blue }],
    mFRR: [{ product: "mFRR Up", price: "120.00 €/MW/h", bid: "0 MW", status: "Not offered", color: "var(--sub)" }, { product: "mFRR Down", price: "95.00 €/MW/h", bid: "0 MW", status: "Not offered", color: "var(--sub)" }],
    TERRE: [{ product: "TERRE Up", price: "135.00 €/MWh", bid: "15 MW", status: "Won", color: green }],
    imFRR: [{ product: "imFRR Fast Up", price: "160.00 €/MWh", bid: "0 MW", status: "No bid", color: "var(--sub)" }],
  };

  const events = [
    { time: "09:14", type: "FCR-N", action: "Discharged 85 kW — freq dip to 49.87 Hz", revenue: "€12.40", duration: "8 min", status: "Completed" },
    { time: "07:32", type: "Peak Shaving", action: "Capped load at 420 kW — max demand avoided", revenue: "€8.20", duration: "30 min", status: "Completed" },
    { time: "Yesterday 18:45", type: "Demand Response", action: "Reduced load 150 kW — grid stress event #DR221", revenue: "€31.50", duration: "30 min", status: "Completed" },
    { time: "Yesterday 14:10", type: "aFRR Up", action: "Injected +200 kW — TSO activation signal", revenue: "€22.80", duration: "15 min", status: "Completed" },
    { time: "Yesterday 11:05", type: "Curtailment", action: "Absorbed 95 kW solar excess — grid congestion", revenue: "€4.50", duration: "45 min", status: "Completed" },
  ];

  const todayRevenue = { fcr: 20.20, afrr: 22.80, dr: 31.50, peakshave: 8.20, curtailment: 4.50 };
  const totalRevenue = Object.values(todayRevenue).reduce((a, b) => a + b, 0).toFixed(2);

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--bg)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Grid Services & Ancillary Markets</h1>
          <p style={{ color: "var(--sub)", fontSize: 14 }}>FCR, aFRR, mFRR, Demand Response, Peak Shaving & Voltage Regulation</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
            <div style={{ fontSize: 10, color: "var(--sub)" }}>Today's Grid Revenue</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: green }}>€{totalRevenue}</div>
          </div>
          <button style={{ background: accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
            Submit Bids
          </button>
        </div>
      </div>

      {/* Top row */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 280px", gap: 16, marginBottom: 20 }}>

        {/* Frequency gauge */}
        <div style={card}>
          <div style={{ color: "var(--sub)", fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Live Grid Frequency</div>
          <div style={{ fontSize: 44, fontWeight: 900, color: freqColor, fontVariantNumeric: "tabular-nums", textShadow: `0 0 20px ${freqColor}60` }}>
            {freqValue.toFixed(3)} Hz
          </div>
          <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>
            Deviation: <span style={{ color: freqColor, fontWeight: 700 }}>{freqDev > 0 ? "+" : ""}{(freqValue - 50).toFixed(3)} Hz</span>
          </div>
          <div style={{ marginTop: 12, background: "var(--surface2)", borderRadius: 8, padding: 10, fontSize: 11 }}>
            {[
              { band: "FCR-N", range: "49.90 – 50.10 Hz", active: freqDev < 0.1 },
              { band: "FCR-D", range: "49.50 – 49.90 Hz", active: freqDev >= 0.1 && freqDev < 0.5 },
              { band: "Emergency", range: "< 49.50 Hz", active: freqValue < 49.5 },
            ].map(b => (
              <div key={b.band} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, padding: "4px 6px", borderRadius: 4, background: b.active ? "var(--surface)" : "transparent" }}>
                <span style={{ color: b.active ? freqColor : "var(--sub)", fontWeight: b.active ? 700 : 400 }}>{b.band}</span>
                <span style={{ color: "var(--sub)" }}>{b.range}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>FCR Response Readiness</div>
            <div style={{ background: "#1f2937", borderRadius: 4, height: 6 }}>
              <div style={{ width: "87%", height: "100%", background: green, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 10, color: green, marginTop: 2, textAlign: "right" }}>87% capacity ready</div>
          </div>
        </div>

        {/* Frequency chart */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Frequency & Dispatch Response (last 60s)</div>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={freqHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
              <XAxis dataKey="t" tick={{ fontSize: 9, fill: "var(--sub)" }} interval={9} />
              <YAxis yAxisId="freq" domain={[49.5, 50.5]} tick={{ fontSize: 9, fill: "var(--sub)" }} />
              <YAxis yAxisId="resp" orientation="right" tick={{ fontSize: 9, fill: "var(--sub)" }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine yAxisId="freq" y={50.0} stroke="#374151" strokeDasharray="3 3" />
              <ReferenceLine yAxisId="freq" y={49.9} stroke={amber} strokeDasharray="2 2" />
              <ReferenceLine yAxisId="freq" y={50.1} stroke={amber} strokeDasharray="2 2" />
              <Line yAxisId="freq" type="monotone" dataKey="freq" stroke={freqColor} strokeWidth={2} dot={false} name="Hz" />
              <Bar yAxisId="resp" dataKey="response" fill={`${accent}60`} name="Response kW" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* DR status */}
        <div style={card}>
          <div style={{ color: "var(--sub)", fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Demand Response</div>
          {activeDR ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: amber }}>ACTIVE EVENT</div>
              <div style={{ fontSize: 36, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: amber, marginTop: 4 }}>{formatTime(drCountdown)}</div>
              <div style={{ background: "#451a03", border: "1px solid #92400e", borderRadius: 8, padding: 10, marginTop: 10, fontSize: 12 }}>
                <div style={{ color: amber, fontWeight: 600 }}>Target: reduce 150 kW</div>
                <div style={{ color: "var(--sub)", fontSize: 11, marginTop: 2 }}>Estimated revenue: €{(drCountdown / 1800 * 35).toFixed(2)}</div>
              </div>
              <button onClick={() => setActiveDR(false)} style={{ marginTop: 10, background: red, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, width: "100%" }}>
                Emergency Stop
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: green }}>STANDBY</div>
              <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4, marginBottom: 12 }}>Ready for TSO activation</div>
              <div style={{ fontSize: 11, background: "var(--surface2)", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "var(--sub)" }}>Available capacity</span><span style={{ color: green }}>150 kW</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--sub)" }}>Response time</span><span>&lt; 30 min</span>
                </div>
              </div>
              <button onClick={() => setActiveDR(true)} style={{ background: "#451a03", color: amber, border: "1px solid #92400e", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, width: "100%" }}>
                Simulate DR Event
              </button>
            </>
          )}
        </div>
      </div>

      {/* Middle row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>

        {/* Service controls */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Service Controls</h2>
          <p style={{ color: "var(--sub)", fontSize: 11, marginBottom: 6 }}>Enable/disable ancillary market participation</p>
          <Toggle value={services.fcr} onChange={v => setServices(s => ({ ...s, fcr: v }))} label="FCR-N / FCR-D" desc="Frequency containment reserve ±0.2 Hz" badge="Live" revenue="14.20" />
          <Toggle value={services.afrr} onChange={v => setServices(s => ({ ...s, afrr: v }))} label="aFRR (Automatic FRR)" desc="Automatic restoration reserve — ENTSO-E" badge="Active" revenue="18.40" />
          <Toggle value={services.mfrr} onChange={v => setServices(s => ({ ...s, mfrr: v }))} label="mFRR (Manual FRR)" desc="Manual restoration reserve — 30min notice" />
          <Toggle value={services.dr} onChange={v => setServices(s => ({ ...s, dr: v }))} label="Demand Response" desc="TSO/DSO load reduction events" />
          <Toggle value={services.peakShave} onChange={v => setServices(s => ({ ...s, peakShave: v }))} label="Peak Shaving" desc="Prevent peak demand tariff charges" revenue="4.10" />
          <Toggle value={services.curtailment} onChange={v => setServices(s => ({ ...s, curtailment: v }))} label="Curtailment Management" desc="Absorb excess solar/wind gen" />
          <Toggle value={services.voltageReg} onChange={v => setServices(s => ({ ...s, voltageReg: v }))} label="Voltage Regulation" desc="Reactive power injection / absorption" />
          <Toggle value={services.synthetic_inertia} onChange={v => setServices(s => ({ ...s, synthetic_inertia: v }))} label="Synthetic Inertia" desc="Virtual inertia emulation — future market" badge="Beta" />
        </div>

        {/* Capacity allocation */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Capacity Allocation</h2>
          <p style={{ color: "var(--sub)", fontSize: 11, marginBottom: 12 }}>BESS capacity reserved per service (750 kW / 1500 kWh total)</p>
          {capacityAlloc.map(s => (
            <div key={s.label} style={{ marginBottom: 12, opacity: s.active ? 1 : 0.4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span>{s.label}</span>
                <span style={{ color: "var(--sub)" }}>{s.pct}% · {s.kw} kW</span>
              </div>
              <div style={{ background: "#1f2937", borderRadius: 4, height: 7 }}>
                <div style={{ width: `${s.pct}%`, height: "100%", background: s.color, borderRadius: 4, boxShadow: `0 0 6px ${s.color}60` }} />
              </div>
            </div>
          ))}
          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 10, fontSize: 12, marginTop: 8 }}>
            {[
              { l: "Total BESS", v: "750 kW / 1500 kWh" },
              { l: "Allocated", v: `${capacityAlloc.filter(s => s.active).reduce((a, b) => a + b.kw, 0)} kW (active services)` },
              { l: "Available reserve", v: "150 kW" },
            ].map(m => (
              <div key={m.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "var(--sub)" }}>{m.l}</span><span>{m.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue breakdown */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Today's Revenue by Service</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueData} stackOffset="none">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
              <XAxis dataKey="h" tick={{ fontSize: 9, fill: "var(--sub)" }} interval={5} />
              <YAxis tick={{ fontSize: 9, fill: "var(--sub)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="fcr" stackId="a" fill={accent} name="FCR" />
              <Bar dataKey="afrr" stackId="a" fill={blue} name="aFRR" />
              <Bar dataKey="dr" stackId="a" fill={green} name="DR" />
              <Bar dataKey="peakshave" stackId="a" fill={amber} name="Peak" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            {Object.entries(todayRevenue).map(([k, v]) => (
              <div key={k} style={{ background: "var(--surface2)", borderRadius: 6, padding: "6px 10px", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--sub)", textTransform: "uppercase", fontSize: 10 }}>{k}</span>
                <span style={{ color: green, fontWeight: 700 }}>€{v.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Market bids */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Ancillary Market Bids</h2>
          <div style={{ display: "flex", gap: 6 }}>
            {MARKET_TABS.map(t => (
              <button key={t} onClick={() => setMarketTab(t)} style={{
                background: marketTab === t ? accent : "var(--surface2)", color: marketTab === t ? "#fff" : "var(--sub)",
                border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer"
              }}>{t}</button>
            ))}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Product", "Price", "Bid Volume", "Status"].map(h => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--sub)", fontWeight: 500, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(marketPrices[marketTab] || []).map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.product}</td>
                <td style={{ padding: "10px 12px", color: blue }}>{r.price}</td>
                <td style={{ padding: "10px 12px" }}>{r.bid}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: r.color === green ? "#064e3b" : r.color === amber ? "#451a03" : "var(--surface2)", color: r.color }}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom: event log + live dispatch */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Dispatch Event Log</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Time", "Service", "Action", "Duration", "Revenue", "Status"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "var(--sub)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 10px", color: "var(--sub)" }}>{e.time}</td>
                  <td style={{ padding: "10px 10px", color: accent, fontWeight: 600 }}>{e.type}</td>
                  <td style={{ padding: "10px 10px" }}>{e.action}</td>
                  <td style={{ padding: "10px 10px", color: "var(--sub)" }}>{e.duration}</td>
                  <td style={{ padding: "10px 10px", color: green, fontWeight: 600 }}>{e.revenue}</td>
                  <td style={{ padding: "10px 10px" }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#064e3b", color: green }}>{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Live Dispatch Feed</h2>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#064e3b", color: green }}>● Live</span>
          </div>
          {dispatchLog.length === 0 ? (
            <div style={{ color: "var(--sub)", fontSize: 12, textAlign: "center", padding: 20 }}>Awaiting dispatch events...</div>
          ) : (
            dispatchLog.map((e, i) => (
              <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", display: "flex", gap: 10 }}>
                <div style={{ fontSize: 10, color: "var(--sub)", width: 56, flexShrink: 0 }}>{e.time}</div>
                <div style={{ flex: 1, fontSize: 12 }}>{e.msg}</div>
                <div style={{ color: green, fontWeight: 700, fontSize: 12 }}>+€{e.revenue}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
