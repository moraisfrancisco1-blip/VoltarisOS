import { useState, useEffect } from "react";

const accent = "#6366f1";
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 };

const mockBatteries = [
  { id: 1, site: "Rotterdam", capacity: 500, soc: 72, voltage: 48.2, current: 120, temp: 28, cycles: 312, health: 96, status: "Charging", chemistry: "LFP" },
  { id: 2, site: "Rebordelo", capacity: 250, soc: 45, voltage: 47.8, current: -80, temp: 31, cycles: 501, health: 89, status: "Discharging", chemistry: "NMC" },
  { id: 3, site: "Rotterdam", capacity: 500, soc: 88, voltage: 49.1, current: 0, temp: 25, cycles: 198, health: 98, status: "Idle", chemistry: "LFP" },
];

const SoCBar = ({ value }) => (
  <div style={{ background: "#1f2937", borderRadius: 6, height: 10, width: "100%", overflow: "hidden" }}>
    <div style={{
      width: `${value}%`,
      height: "100%",
      background: value > 70 ? "#10b981" : value > 30 ? "#f59e0b" : "#ef4444",
      borderRadius: 6,
      transition: "width 0.5s"
    }} />
  </div>
);

const HealthRing = ({ value }) => {
  const r = 28, circ = 2 * Math.PI * r;
  const color = value > 90 ? "#10b981" : value > 75 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={70} height={70}>
      <circle cx={35} cy={35} r={r} fill="none" stroke="var(--grid-line)" strokeWidth={6} />
      <circle cx={35} cy={35} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${(value / 100) * circ} ${circ}`}
        strokeLinecap="round" transform="rotate(-90 35 35)" />
      <text x={35} y={40} textAnchor="middle" fill="#fff" fontSize={13} fontWeight="bold">{value}%</text>
    </svg>
  );
};

export default function BatteryManagement() {
  const [selected, setSelected] = useState(null);
  const [history] = useState(() =>
    Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      soc: Math.max(20, Math.min(95, 60 + Math.sin(i / 3) * 25)),
    }))
  );

  const totalCapacity = mockBatteries.reduce((a, b) => a + b.capacity, 0);
  const avgSoC = Math.round(mockBatteries.reduce((a, b) => a + b.soc, 0) / mockBatteries.length);
  const avgHealth = Math.round(mockBatteries.reduce((a, b) => a + b.health, 0) / mockBatteries.length);
  const charging = mockBatteries.filter(b => b.status === "Charging").length;

  const bat = selected !== null ? mockBatteries[selected] : null;

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--bg)" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Battery Management</h1>
      <p style={{ color: "var(--sub)", marginBottom: 28 }}>State of charge, health, and lifecycle tracking across all BESS assets</p>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Capacity", value: `${totalCapacity} kWh`, sub: "installed" },
          { label: "Fleet Avg SoC", value: `${avgSoC}%`, sub: "state of charge" },
          { label: "Fleet Avg Health", value: `${avgHealth}%`, sub: "battery health" },
          { label: "Charging Now", value: `${charging}/${mockBatteries.length}`, sub: "units active" },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ color: "var(--sub)", fontSize: 12, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: accent }}>{k.value}</div>
            <div style={{ color: "var(--sub)", fontSize: 12 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Battery list */}
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Battery Units</h2>
          {mockBatteries.map((b, i) => (
            <div key={b.id}
              onClick={() => setSelected(i === selected ? null : i)}
              style={{
                background: selected === i ? "var(--surface)" : "var(--surface2)",
                border: `1px solid ${selected === i ? accent : "#1f2937"}`,
                borderRadius: 8, padding: 16, marginBottom: 10, cursor: "pointer",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>Unit #{b.id}</span>
                  <span style={{ color: "var(--sub)", fontSize: 12, marginLeft: 8 }}>{b.site} · {b.chemistry} · {b.capacity} kWh</span>
                </div>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 99,
                  background: b.status === "Charging" ? "#064e3b" : b.status === "Discharging" ? "#7f1d1d" : "#1f2937",
                  color: b.status === "Charging" ? "#10b981" : b.status === "Discharging" ? "#ef4444" : "#6b7280",
                }}>{b.status}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--sub)", width: 60 }}>SoC {b.soc}%</span>
                <div style={{ flex: 1 }}><SoCBar value={b.soc} /></div>
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                {[
                  { label: "Cycles", val: b.cycles },
                  { label: "Temp", val: `${b.temp}°C` },
                  { label: "Current", val: `${b.current > 0 ? "+" : ""}${b.current}A` },
                  { label: "Voltage", val: `${b.voltage}V` },
                ].map(m => (
                  <div key={m.label}>
                    <div style={{ fontSize: 10, color: "var(--sub)" }}>{m.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div style={card}>
          {bat ? (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Unit #{bat.id} — Detail</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 24 }}>
                <HealthRing value={bat.health} />
                <div>
                  <div style={{ color: "var(--sub)", fontSize: 12 }}>Battery Health (SoH)</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{bat.health}%</div>
                  <div style={{ color: "var(--sub)", fontSize: 12, marginTop: 4 }}>
                    Est. remaining life: {Math.round((bat.health - 70) / 2)} years
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Chemistry", val: bat.chemistry },
                  { label: "Capacity", val: `${bat.capacity} kWh` },
                  { label: "Cycle Count", val: bat.cycles },
                  { label: "Voltage", val: `${bat.voltage} V` },
                  { label: "Current", val: `${bat.current} A` },
                  { label: "Temperature", val: `${bat.temp} °C` },
                ].map(m => (
                  <div key={m.label} style={{ background: "var(--surface2)", padding: "10px 14px", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--sub)" }}>{m.label}</div>
                    <div style={{ fontWeight: 600 }}>{m.val}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 13, color: "var(--sub)", marginBottom: 8 }}>24h SoC History</div>
                <svg width="100%" height={100} viewBox="0 0 480 100" preserveAspectRatio="none">
                  <polyline
                    fill="none" stroke={accent} strokeWidth={2}
                    points={history.map((d, i) => `${(i / 23) * 480},${100 - d.soc}`).join(" ")}
                  />
                  <polygon
                    fill={`${accent}22`}
                    points={[
                      "0,100",
                      ...history.map((d, i) => `${(i / 23) * 480},${100 - d.soc}`),
                      "480,100"
                    ].join(" ")}
                  />
                </svg>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, color: "var(--sub)", marginBottom: 8 }}>Degradation Forecast</div>
                <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 12 }}>
                  {[
                    { year: "Year 1", health: bat.health },
                    { year: "Year 2", health: Math.max(70, bat.health - 3) },
                    { year: "Year 3", health: Math.max(70, bat.health - 6) },
                    { year: "Year 5", health: Math.max(70, bat.health - 12) },
                  ].map(r => (
                    <div key={r.year} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                      <span style={{ width: 50, fontSize: 12, color: "var(--sub)" }}>{r.year}</span>
                      <div style={{ flex: 1, background: "#1f2937", borderRadius: 4, height: 6 }}>
                        <div style={{ width: `${r.health}%`, height: "100%", background: r.health > 85 ? "#10b981" : "#f59e0b", borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, width: 36 }}>{r.health}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--sub)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔋</div>
              <div>Click a battery unit to view details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
