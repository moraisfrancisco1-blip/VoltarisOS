import { useEffect, useState } from "react";
import { C, glassCard } from "../ChartTheme";
import { API, ago, useApi, RealPage, LoadingCard, ErrorCard, EmptyCard, Chip } from "./realShared";

const statusColor = (s) => (s === "online" ? C.green : s === "offline" || s === "error" ? C.red : C.amber);

const fmt = (v, digits, unit) => (v == null ? null : `${Number(v).toFixed(digits)}${unit}`);

// The tenant's REAL devices of the given types (e.g. batteries, EV chargers) with their
// latest reading, from GET /api/devices and /api/devices/{id}/readings. Shown when
// Simulation mode is off; the demo page stays as is. Power is shown as the device
// reports it: the sign convention (charging vs discharging) depends on the brand.
export default function DeviceListReal({ title, subtitle, types, emptyTitle, emptyText, onNavigate }) {
  const { data, error } = useApi(["/api/devices", "/api/sites"]);
  const [latest, setLatest] = useState({});

  const devices = data ? (data[0] || []).filter(d => types.includes((d.device_type || "").toLowerCase())) : null;
  const ids = devices ? devices.map(d => d.id).join(",") : "";

  useEffect(() => {
    if (!ids) return undefined;
    const ctrl = new AbortController();
    Promise.all(ids.split(",").map(id =>
      fetch(`${API}/api/devices/${id}/readings?limit=1`, { signal: ctrl.signal })
        .then(r => (r.ok ? r.json() : []))
        .then(rows => [id, Array.isArray(rows) && rows.length ? rows[0] : null])
        .catch(() => [id, null])
    )).then(pairs => setLatest(Object.fromEntries(pairs)));
    return () => ctrl.abort();
  }, [ids]);

  if (error) return <RealPage title={title} subtitle={subtitle}><ErrorCard error={error} /></RealPage>;
  if (!data) return <RealPage title={title} subtitle={subtitle}><LoadingCard /></RealPage>;

  const sites = Object.fromEntries((data[1] || []).map(s => [s.id, s.name]));

  return (
    <RealPage title={title} subtitle={subtitle}>
      {devices.length === 0 ? (
        <EmptyCard title={emptyTitle} text={emptyText}
          actionLabel={onNavigate ? "Go to Integrations" : null}
          onAction={onNavigate ? () => onNavigate("integrations") : null} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {devices.map(d => {
            const r = latest[String(d.id)];
            const stats = r ? [
              ["State of charge", fmt(r.soc_pct, 0, " %")],
              ["Power", fmt(r.power_kw, 2, " kW")],
              ["Temperature", fmt(r.temp_c, 1, " °C")],
              ["Voltage", fmt(r.voltage_v, 1, " V")],
              ["Current", fmt(r.current_a, 1, " A")],
            ].filter(([, v]) => v != null) : [];
            return (
              <div key={d.id} style={glassCard(statusColor(d.status))}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 2 }}>
                      {d.site_id != null && sites[d.site_id] ? sites[d.site_id] : "No site"} · {d.protocol}
                    </div>
                  </div>
                  <Chip color={statusColor(d.status)}>{d.status || "unknown"}{d.enabled === false ? " (disabled)" : ""}</Chip>
                </div>
                {stats.length === 0 ? (
                  <div style={{ marginTop: 14, fontSize: 13, color: "var(--sub)" }}>
                    {r === undefined ? "Loading readings…" : "No readings yet."}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                    {stats.map(([label, value]) => (
                      <div key={label} style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--sub)" }}>Last seen {ago(d.last_seen)}</div>
              </div>
            );
          })}
        </div>
      )}
    </RealPage>
  );
}
