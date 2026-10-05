import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { C, glassCard, KpiCard, PremiumTooltip, axisStyle, gridStyle } from "../ChartTheme";
import { API, ago, useApi, RealPage, LoadingCard, ErrorCard, EmptyCard, Chip } from "./realShared";

const th = { padding: "8px 12px", borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--sub)",
  fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 };
const td = { padding: "10px 12px", color: "var(--text)" };

const bidColor = (s) => (s === "accepted" ? C.green : s === "rejected" || s === "cancelled" ? C.red : C.amber);
const eur = (v) => (v == null ? "—" : `€${Number(v).toFixed(2)}`);

// Trading with REAL data: the day-ahead market prices (GET /api/prices/day-ahead, ENTSO-E) and
// the tenant's own bids across its VPP groups (GET /api/vpp and /api/vpp/{id}/bids). There is no
// order book, intraday market or order entry behind this: those need an exchange connection.
// Shown when Simulation mode is off; the demo page stays as is.
export default function TradingReal({ onNavigate }) {
  const { data, error } = useApi(["/api/prices/day-ahead?zone=NL"]);
  // Groups and bids load on their own and tolerate failure (e.g. a plan without VPP): the market
  // prices above stay valid either way, and a failure just shows as "no group yet".
  const [vpp, setVpp] = useState(null); // null while loading, then { groups, bids }

  useEffect(() => {
    const ctrl = new AbortController();
    const getJson = (path) => fetch(`${API}${path}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : []))
      .then(j => (Array.isArray(j) ? j : []))
      .catch(() => []);
    getJson("/api/vpp")
      .then(groups => Promise.all(groups.map(g => getJson(`/api/vpp/${g.id}/bids?limit=50`)))
        .then(lists => ({ groups, bids: lists.flat().sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1)) })))
      .then(setVpp)
      .catch(() => setVpp({ groups: [], bids: [] }));
    return () => ctrl.abort();
  }, []);

  const groups = vpp ? vpp.groups : null;
  const bids = vpp ? vpp.bids : null;

  const title = "Energy Trading";
  const subtitle = "Day-ahead market prices and your bids";

  if (error) return <RealPage title={title} subtitle={subtitle}><ErrorCard error={error} /></RealPage>;
  if (!data) return <RealPage title={title} subtitle={subtitle}><LoadingCard /></RealPage>;

  const priceDoc = data[0] || {};
  const simulated = priceDoc.source === "simulated";
  // Market data is in EUR/MWh; the simulated fallback is in EUR/kWh, so scale it to the same unit.
  const scale = simulated ? 1000 : 1;
  const series = Array.isArray(priceDoc.prices)
    ? priceDoc.prices.map(p => ({ hour: p.hour, price: Number(p.price) * scale })).filter(p => Number.isFinite(p.price))
    : [];

  let stats = null;
  if (series.length) {
    const avg = series.reduce((a, p) => a + p.price, 0) / series.length;
    const min = series.reduce((a, p) => (p.price < a.price ? p : a));
    const max = series.reduce((a, p) => (p.price > a.price ? p : a));
    stats = { avg, min, max };
  }

  const accepted = (bids || []).filter(b => b.status === "accepted");
  const pnl = accepted.reduce((a, b) => a + (Number(b.pnl_eur) || 0), 0);

  return (
    <RealPage title={title} subtitle={subtitle}>
      {simulated && (
        <div style={{ ...glassCard(C.amber), color: "var(--sub)", fontSize: 13 }}>
          Market prices are simulated on this instance (no market data feed configured), so the figures below are only indicative.
        </div>
      )}
      {priceDoc.error && (
        <div style={{ ...glassCard(C.red), color: "var(--sub)", fontSize: 13 }}>
          Market prices are not available right now.
        </div>
      )}

      {stats && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
            <KpiCard label="Average price" value={`€${stats.avg.toFixed(1)}`} color={C.purple} icon="⚡" sub="€/MWh, day-ahead" />
            <KpiCard label="Cheapest" value={`€${stats.min.price.toFixed(1)}`} color={C.green} icon="⬇️" sub={`${stats.min.hour} UTC`} />
            <KpiCard label="Most expensive" value={`€${stats.max.price.toFixed(1)}`} color={C.red} icon="⬆️" sub={`${stats.max.hour} UTC`} />
            <KpiCard label="Spread" value={`€${(stats.max.price - stats.min.price).toFixed(1)}`} color={C.amber} icon="↕️" sub="Max − min, €/MWh" />
          </div>

          <div style={glassCard(C.purple)}>
            <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
              Day-ahead price, NL (€/MWh, times in UTC)
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={series} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="trade_price" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.purple} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={C.purple} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="hour" tick={axisStyle} interval={Math.max(Math.ceil(series.length / 12) - 1, 0)} />
                <YAxis tick={axisStyle} unit=" €" />
                <Tooltip content={<PremiumTooltip unit=" €/MWh" />} />
                <Area type="monotone" dataKey="price" name="Price" stroke={C.purple} fill="url(#trade_price)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div style={glassCard(C.blue)}>
        <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
          Your bids
        </div>
        {bids === null ? (
          <div style={{ color: "var(--sub)", fontSize: 13 }}>Loading…</div>
        ) : groups.length === 0 ? (
          <EmptyCard title="No VPP group yet"
            text="Bids are placed through a virtual power plant group. Create one under Virtual Power Plant and its bids and results appear here."
            actionLabel={onNavigate ? "Go to Virtual Power Plant" : null} onAction={onNavigate ? () => onNavigate("vpp") : null} />
        ) : bids.length === 0 ? (
          <div style={{ color: "var(--sub)", fontSize: 13 }}>No bids submitted yet.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14, fontSize: 13, color: "var(--sub)" }}>
              <span>Bids: <b style={{ color: "var(--text)" }}>{bids.length}</b></span>
              <span>Accepted: <b style={{ color: C.green }}>{accepted.length}</b></span>
              <span>P&L (accepted): <b style={{ color: pnl < 0 ? C.red : C.green }}>{eur(pnl)}</b></span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>{["Market", "Direction", "Quantity", "Price", "Status", "P&L", "Submitted"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {bids.slice(0, 30).map(b => (
                    <tr key={`${b.vpp_id}-${b.id}`}>
                      <td style={td}>{b.market}</td>
                      <td style={{ ...td, color: "var(--sub)" }}>{b.direction}</td>
                      <td style={td}>{Number(b.quantity_kw).toFixed(1)} kW</td>
                      <td style={td}>{b.price_eur_mwh == null ? "market" : `€${Number(b.price_eur_mwh).toFixed(1)}/MWh`}</td>
                      <td style={td}><Chip color={bidColor(b.status)}>{b.status}</Chip></td>
                      <td style={td}>{eur(b.pnl_eur)}</td>
                      <td style={{ ...td, color: "var(--sub)" }}>{ago(b.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ color: "var(--sub)", fontSize: 11, lineHeight: 1.6 }}>
        Prices are the day-ahead market for the Netherlands (ENTSO-E). Bids come from your virtual power plant groups
        (last 50 per group). Order book depth, intraday trading and order entry are not shown because they need a
        direct exchange connection.
      </div>
    </RealPage>
  );
}
