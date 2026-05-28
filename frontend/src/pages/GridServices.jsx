import { useState, useEffect } from "react";

const accent = "#6366f1";
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 };

const Toggle = ({ value, onChange, label, desc, badge }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
        {badge && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "#064e3b", color: "#10b981" }}>{badge}</span>}
      </div>
      {desc && <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 2 }}>{desc}</div>}
    </div>
    <div onClick={() => onChange(!value)} style={{
      width: 44, height: 24, borderRadius: 12, background: value ? accent : "#374151",
      cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0
    }}>
      <div style={{
        position: "absolute", top: 3, left: value ? 23 : 3, width: 18, height: 18,
        borderRadius: "50%", background: "#fff", transition: "left 0.2s"
      }} />
    </div>
  </div>
);

export default function GridServices() {
  const [freq, setFreq] = useState(true);
  const [dr, setDr] = useState(true);
  const [voltageReg, setVoltageReg] = useState(false);
  const [peakShave, setPeakShave] = useState(true);
  const [spinReserve, setSpinReserve] = useState(false);
  const [curtailment, setCurtailment] = useState(false);
  const [freqValue, setFreqValue] = useState(50.0);
  const [activeDR, setActiveDR] = useState(false);
  const [drCountdown, setDrCountdown] = useState(0);

  // Simulate live frequency drift
  useEffect(() => {
    const t = setInterval(() => {
      setFreqValue(v => {
        const noise = (Math.random() - 0.5) * 0.04;
        return Math.round(Math.max(49.7, Math.min(50.3, v + noise)) * 1000) / 1000;
      });
    }, 1200);
    return () => clearInterval(t);
  }, []);

  // DR countdown
  useEffect(() => {
    if (!activeDR) return;
    setDrCountdown(1800);
    const t = setInterval(() => setDrCountdown(v => {
      if (v <= 1) { setActiveDR(false); return 0; }
      return v - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [activeDR]);

  const freqDev = Math.abs(freqValue - 50.0);
  const freqColor = freqDev < 0.1 ? "#10b981" : freqDev < 0.2 ? "#f59e0b" : "#ef4444";

  const formatTime = s => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const events = [
    { time: "09:14", type: "Frequency Response", action: "Discharged 85 kW for 8 min", revenue: "€12.40", status: "Completed" },
    { time: "07:32", type: "Peak Shaving", action: "Capped load at 420 kW for 30 min", revenue: "€8.20", status: "Completed" },
    { time: "Yesterday 18:45", type: "Demand Response", action: "Reduced load 150 kW for 30 min", revenue: "€31.50", status: "Completed" },
    { time: "Yesterday 14:10", type: "Frequency Response", action: "Charged 60 kW for 5 min", revenue: "€7.80", status: "Completed" },
  ];

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--bg)" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Grid Services</h1>
      <p style={{ color: "var(--sub)", marginBottom: 28 }}>Ancillary services, demand response, and grid stability participation</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 }}>
        {/* Live frequency */}
        <div style={{ ...card, gridColumn: "span 1" }}>
          <div style={{ color: "var(--sub)", fontSize: 12, marginBottom: 8 }}>Live Grid Frequency</div>
          <div style={{ fontSize: 42, fontWeight: 700, color: freqColor, fontVariantNumeric: "tabular-nums" }}>
            {freqValue.toFixed(3)} Hz
          </div>
          <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>
            Deviation: {freqDev > 0 ? "+" : ""}{(freqValue - 50).toFixed(3)} Hz
          </div>
          <div style={{ marginTop: 12, background: "var(--surface2)", borderRadius: 8, padding: 10, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--sub)" }}>FCR-N band</span>
              <span>49.9 – 50.1 Hz</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ color: "var(--sub)" }}>FCR-D band</span>
              <span>49.5 – 49.9 Hz</span>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ color: "var(--sub)", fontSize: 12, marginBottom: 8 }}>Today's Grid Revenue</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#10b981" }}>€59.90</div>
          <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>from ancillary services</div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "var(--sub)" }}>Frequency Response</span><span>€20.20</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "var(--sub)" }}>Peak Shaving</span><span>€8.20</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "var(--sub)" }}>Demand Response</span><span>€31.50</span>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ color: "var(--sub)", fontSize: 12, marginBottom: 8 }}>Demand Response Status</div>
          {activeDR ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>ACTIVE</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{formatTime(drCountdown)}</div>
              <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>remaining in event</div>
              <div style={{ marginTop: 8, background: "#451a03", borderRadius: 8, padding: 10, fontSize: 12, color: "#f59e0b" }}>
                Load reduction target: 150 kW
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>STANDBY</div>
              <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>No active DR event</div>
              <button onClick={() => setActiveDR(true)} style={{
                marginTop: 16, background: "#451a03", color: "#f59e0b", border: "1px solid #92400e",
                padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, width: "100%"
              }}>Simulate DR Event</button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Service toggles */}
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Grid Service Controls</h2>
          <p style={{ color: "var(--sub)", fontSize: 12, marginBottom: 8 }}>Enable or disable ancillary service participation</p>
          <Toggle value={freq} onChange={setFreq} label="Frequency Containment Reserve (FCR)" desc="Auto respond to frequency deviations ±0.2 Hz" badge="Live" />
          <Toggle value={dr} onChange={setDr} label="Demand Response" desc="Reduce load during grid stress events" />
          <Toggle value={peakShave} onChange={setPeakShave} label="Peak Shaving" desc="Prevent peak demand charges via BESS" />
          <Toggle value={voltageReg} onChange={setVoltageReg} label="Voltage Regulation" desc="Reactive power injection for voltage support" />
          <Toggle value={spinReserve} onChange={setSpinReserve} label="Spinning Reserve" desc="Maintain standby capacity for rapid dispatch" />
          <Toggle value={curtailment} onChange={setCurtailment} label="Renewable Curtailment Management" desc="Absorb excess solar/wind generation" />
        </div>

        {/* Capacity allocation */}
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Capacity Allocation</h2>
          <p style={{ color: "var(--sub)", fontSize: 12, marginBottom: 16 }}>BESS capacity reserved per service</p>
          {[
            { label: "Frequency Response", pct: 30, kw: 225, color: "#6366f1" },
            { label: "Demand Response", pct: 25, kw: 187, color: "#10b981" },
            { label: "Peak Shaving", pct: 20, kw: 150, color: "#f59e0b" },
            { label: "Trading / Arbitrage", pct: 25, kw: 188, color: "#60a5fa" },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>{s.label}</span>
                <span style={{ color: "var(--sub)" }}>{s.pct}% · {s.kw} kW</span>
              </div>
              <div style={{ background: "#1f2937", borderRadius: 4, height: 8 }}>
                <div style={{ width: `${s.pct}%`, height: "100%", background: s.color, borderRadius: 4 }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8, background: "var(--surface2)", borderRadius: 8, padding: 12, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--sub)" }}>Total BESS capacity</span>
              <span>750 kW / 1500 kWh</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ color: "var(--sub)" }}>Reserved for services</span>
              <span style={{ color: "#10b981" }}>562 kW (75%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Event log */}
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Grid Service Event Log</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--sub)", borderBottom: "1px solid var(--border)" }}>
              {["Time", "Service Type", "Action Taken", "Revenue", "Status"].map(h => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #0d1117" }}>
                <td style={{ padding: "10px 12px", color: "var(--sub)" }}>{e.time}</td>
                <td style={{ padding: "10px 12px", color: accent, fontWeight: 500 }}>{e.type}</td>
                <td style={{ padding: "10px 12px" }}>{e.action}</td>
                <td style={{ padding: "10px 12px", color: "#10b981", fontWeight: 600 }}>{e.revenue}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#064e3b", color: "#10b981" }}>
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
