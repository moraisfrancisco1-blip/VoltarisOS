import { useState } from "react";

const accent = "#6366f1";
const card = { background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 24 };

const mockChargers = [
  { id: "CH-01", site: "Rotterdam", type: "DC Fast", power: 150, status: "Occupied", vehicle: "Tesla Model 3", soc: 68, eta: "22 min", connector: "CCS2" },
  { id: "CH-02", site: "Rotterdam", type: "DC Fast", power: 150, status: "Available", vehicle: null, soc: null, eta: null, connector: "CCS2" },
  { id: "CH-03", site: "Rotterdam", type: "AC Level 2", power: 22, status: "Occupied", vehicle: "BMW i4", soc: 34, eta: "1h 12min", connector: "Type 2" },
  { id: "CH-04", site: "Rebordelo", type: "DC Fast", power: 50, status: "Faulted", vehicle: null, soc: null, eta: null, connector: "CHAdeMO" },
  { id: "CH-05", site: "Rebordelo", type: "AC Level 2", power: 11, status: "Available", vehicle: null, soc: null, eta: null, connector: "Type 2" },
  { id: "CH-06", site: "Rebordelo", type: "AC Level 2", power: 11, status: "Scheduled", vehicle: "Nissan Leaf", soc: 12, eta: "2h 45min", connector: "Type 2" },
];

const statusColor = {
  Available: { bg: "#064e3b", text: "#10b981" },
  Occupied: { bg: "#1e3a5f", text: "#60a5fa" },
  Faulted: { bg: "#7f1d1d", text: "#ef4444" },
  Scheduled: { bg: "#451a03", text: "#f59e0b" },
};

const scheduleSlots = [
  { time: "08:00", charger: "CH-03", vehicle: "BMW i4", duration: 2 },
  { time: "10:00", charger: "CH-06", vehicle: "Nissan Leaf", duration: 3 },
  { time: "14:00", charger: "CH-01", vehicle: "Tesla Model 3", duration: 1.5 },
  { time: "17:00", charger: "CH-02", vehicle: "Audi e-tron", duration: 2 },
  { time: "19:00", charger: "CH-05", vehicle: "VW ID.4", duration: 2.5 },
];

export default function EVCharging() {
  const [smartCharging, setSmartCharging] = useState(true);
  const [v2g, setV2g] = useState(false);
  const [loadBalance, setLoadBalance] = useState(true);
  const [selectedCharger, setSelectedCharger] = useState(null);

  const available = mockChargers.filter(c => c.status === "Available").length;
  const occupied = mockChargers.filter(c => c.status === "Occupied").length;
  const faulted = mockChargers.filter(c => c.status === "Faulted").length;
  const totalPower = mockChargers.filter(c => c.status === "Occupied").reduce((a, b) => a + b.power, 0);

  const Toggle = ({ value, onChange, label }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #1f2937" }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{
        width: 44, height: 24, borderRadius: 12, background: value ? accent : "#374151",
        cursor: "pointer", position: "relative", transition: "background 0.2s"
      }}>
        <div style={{
          position: "absolute", top: 3, left: value ? 23 : 3, width: 18, height: 18,
          borderRadius: "50%", background: "#fff", transition: "left 0.2s"
        }} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: 32, color: "#e5e7eb", minHeight: "100vh", background: "#0a0f1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>EV Charging</h1>
      <p style={{ color: "#6b7280", marginBottom: 28 }}>Charger status, scheduling, and smart charging controls</p>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Available", value: available, color: "#10b981" },
          { label: "Occupied", value: occupied, color: "#60a5fa" },
          { label: "Faulted", value: faulted, color: "#ef4444" },
          { label: "Active Power", value: `${totalPower} kW`, color: accent },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Charger grid */}
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Charger Status</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {mockChargers.map(c => {
              const sc = statusColor[c.status];
              const sel = selectedCharger?.id === c.id;
              return (
                <div key={c.id}
                  onClick={() => setSelectedCharger(sel ? null : c)}
                  style={{
                    background: sel ? "#1e3a5f" : "#0d1117",
                    border: `1px solid ${sel ? accent : "#1f2937"}`,
                    borderRadius: 10, padding: 16, cursor: "pointer"
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{c.id}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{c.site} · {c.connector}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: sc.bg, color: sc.text }}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
                    {c.type} · {c.power} kW
                  </div>
                  {c.vehicle && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{c.vehicle}</div>
                      <div style={{ background: "#1f2937", borderRadius: 4, height: 6, marginBottom: 4 }}>
                        <div style={{ width: `${c.soc}%`, height: "100%", background: accent, borderRadius: 4 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280" }}>
                        <span>SoC {c.soc}%</span>
                        <span>ETA {c.eta}</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Smart controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Smart Charging</h2>
            <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>Optimize based on grid price and capacity</p>
            <Toggle value={smartCharging} onChange={setSmartCharging} label="Price-based optimization" />
            <Toggle value={loadBalance} onChange={setLoadBalance} label="Dynamic load balancing" />
            <Toggle value={v2g} onChange={setV2g} label="V2G — Vehicle to Grid" />
            {v2g && (
              <div style={{ marginTop: 12, background: "#1e3a5f", borderRadius: 8, padding: 12, fontSize: 12 }}>
                <div style={{ color: "#60a5fa", fontWeight: 600, marginBottom: 4 }}>V2G Active</div>
                Vehicles can discharge back to grid during peak demand events.
                Max export: 30 kW per vehicle.
              </div>
            )}
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Power Budget</h2>
            {[
              { label: "Grid limit", val: 500, used: totalPower, unit: "kW" },
              { label: "Active sessions", val: mockChargers.length, used: occupied, unit: "" },
            ].map(b => (
              <div key={b.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>
                  <span>{b.label}</span>
                  <span>{b.used}{b.unit} / {b.val}{b.unit}</span>
                </div>
                <div style={{ background: "#1f2937", borderRadius: 4, height: 8 }}>
                  <div style={{ width: `${(b.used / b.val) * 100}%`, height: "100%", background: accent, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Today's Charging Schedule</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#6b7280", borderBottom: "1px solid #1f2937" }}>
                {["Time", "Charger", "Vehicle", "Duration", "Est. Energy", "Status"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduleSlots.map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #0d1117" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{s.time}</td>
                  <td style={{ padding: "10px 12px", color: accent }}>{s.charger}</td>
                  <td style={{ padding: "10px 12px" }}>{s.vehicle}</td>
                  <td style={{ padding: "10px 12px", color: "#9ca3af" }}>{s.duration}h</td>
                  <td style={{ padding: "10px 12px" }}>{Math.round(s.duration * 22)} kWh</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#064e3b", color: "#10b981" }}>Confirmed</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
