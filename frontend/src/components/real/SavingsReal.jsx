import { useEffect, useState } from "react";
import { C, glassCard, KpiCard } from "../ChartTheme";

const API = import.meta.env.VITE_API_URL || "";

const eur = (v) => (v == null ? "—" : `€${Number(v).toFixed(2)}`);

// Today's earnings with the tenant's REAL numbers (GET /api/savings/today): solar energy
// recorded today x today's average day-ahead price (an estimate, not avoided grid cost,
// because there is no consumption meter) plus the P&L of today's accepted VPP bids.
// Shared by the Revenue, Scorecard and Investor pages when Simulation mode is off.
export default function SavingsReal({ title, subtitle }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API}/api/savings/today`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch(e => { if (e.name !== "AbortError") setError(e.message || "Failed to load"); });
    return () => ctrl.abort();
  }, []);

  const wrap = { padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 };
  const header = (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "var(--text)", letterSpacing: -0.8 }}>{title}</h1>
      <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 3 }}>{subtitle}</div>
    </div>
  );

  if (error) {
    return (
      <div style={wrap}>
        {header}
        <div style={{ ...glassCard(C.red), color: "var(--sub)", fontSize: 13 }}>
          Could not load earnings data ({error}). Try again in a moment.
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={wrap}>
        {header}
        <div style={{ ...glassCard(C.indigo), color: "var(--sub)", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  const simulatedPrices = data.price_source === "simulated";
  const noPrice = data.avg_price_eur_kwh == null;

  return (
    <div style={wrap}>
      {header}

      {(simulatedPrices || noPrice) && (
        <div style={{ ...glassCard(C.amber), color: "var(--sub)", fontSize: 13 }}>
          {noPrice
            ? "Day-ahead prices are not available right now, so the solar value cannot be estimated."
            : "Day-ahead prices are simulated on this instance (no market data feed configured), so the solar value below is only indicative."}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <KpiCard label="Total today" value={eur(data.total_eur)} color={C.green} icon="💶" sub={data.date} />
        <KpiCard label="Solar value (est.)" value={eur(data.solar_value_eur)} color={C.amber} icon="☀️"
          sub={`${Number(data.solar_kwh_today || 0).toFixed(1)} kWh produced`} />
        <KpiCard label="Trading P&L" value={eur(data.trading_pnl_eur)} color={Number(data.trading_pnl_eur) < 0 ? C.red : C.blue} icon="📈"
          sub="Accepted VPP bids today" />
        <KpiCard label="Avg day-ahead price" value={noPrice ? "—" : `€${Number(data.avg_price_eur_kwh).toFixed(3)}/kWh`} color={C.purple} icon="⚡"
          sub={simulatedPrices ? "Simulated" : data.price_source || "Market"} />
      </div>

      <div style={{ color: "var(--sub)", fontSize: 11, lineHeight: 1.6 }}>
        Solar value = today's recorded solar energy × today's average day-ahead price. It is an estimate, not avoided
        grid cost: without a consumption meter we cannot tell how much of the solar was used on site versus exported.
        Trading P&L is the exact sum of today's accepted VPP bids. Cost, revenue-stack and forecast breakdowns
        will appear here once those data sources are connected.
      </div>
    </div>
  );
}
