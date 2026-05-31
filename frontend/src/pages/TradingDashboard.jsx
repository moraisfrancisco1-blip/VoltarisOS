import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 };
const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };
const val = { fontSize: 26, fontWeight: 700, color: "var(--text)" };

const CustomTooltip = ({ active, payload, label: lb }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{lb}</div>
      {payload.map((p, i) => <div key={i} style={{ fontSize: 12, color: p.color }}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  );
};

const MARKETS = ["DAM Portugal", "DAM Spain", "FCR Pan-EU", "aFRR PT", "Intraday EU"];

const genPriceCurve = () => Array.from({ length: 24 }, (_, i) => ({
  h: `${i}h`,
  da: rand(40, 120),
  id: rand(35, 130),
  forecast: rand(38, 115),
}));

const genOrderBook = () => ({
  bids: Array.from({ length: 8 }, (_, i) => ({ price: rand(60, 80 - i * 2), qty: rand(1, 10) })).sort((a, b) => b.price - a.price),
  asks: Array.from({ length: 8 }, (_, i) => ({ price: rand(80 + i * 2, 100), qty: rand(1, 10) })).sort((a, b) => a.price - b.price),
});

const genPnL = () => Array.from({ length: 30 }, (_, i) => ({
  d: `Day ${i + 1}`,
  pnl: rand(-400, 800),
  cumulative: 0,
})).map((d, i, arr) => ({ ...d, cumulative: arr.slice(0, i + 1).reduce((a, b) => a + b.pnl, 0) }));

const genPositions = () => MARKETS.map(m => ({
  market: m,
  long: rand(0, 10),
  short: rand(0, 8),
  net: rand(-5, 5),
  pnl: rand(-200, 600),
  exposure: rand(10, 100),
}));

const RECENT_TRADES = Array.from({ length: 8 }, (_, i) => ({
  id: `T${1000 + i}`,
  time: `${14 - i}:${String(Math.floor(rand(0, 59, 0))).padStart(2, "0")}`,
  market: MARKETS[i % MARKETS.length],
  side: i % 3 === 0 ? "SELL" : "BUY",
  qty: rand(1, 8),
  price: rand(55, 110),
  pnl: rand(-80, 200),
}));

export default function TradingDashboard() {
  const [priceCurve] = useState(genPriceCurve());
  const [orderBook, setOrderBook] = useState(genOrderBook());
  const [pnl] = useState(genPnL());
  const [positions, setPositions] = useState(genPositions());
  const [selectedMarket, setSelectedMarket] = useState("DAM Portugal");
  const [metrics, setMetrics] = useState({ livePnl: 2840, dailyPnl: 1420, openPositions: 7, exposure: 48.2, winRate: 72 });
  const [lastPrice, setLastPrice] = useState(82.4);
  const [priceDir, setPriceDir] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setOrderBook(genOrderBook());
      setPositions(genPositions());
      setLastPrice(p => {
        const next = parseFloat((p + rand(-1.5, 1.5)).toFixed(1));
        setPriceDir(next >= p ? 1 : -1);
        return next;
      });
      setMetrics(m => ({
        livePnl: Math.round(m.livePnl + rand(-50, 80)),
        dailyPnl: Math.round(m.dailyPnl + rand(-20, 40)),
        openPositions: m.openPositions,
        exposure: parseFloat((m.exposure + rand(-0.5, 0.5)).toFixed(1)),
        winRate: m.winRate,
      }));
    }, 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Energy Trading</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}>Multi-market · DAM · Intraday · Ancillary Services</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {MARKETS.map(m => (
            <button key={m} onClick={() => setSelectedMarket(m)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              background: selectedMarket === m ? accent : "var(--surface2)",
              color: selectedMarket === m ? "#fff" : "var(--sub)",
              border: `1px solid ${selectedMarket === m ? accent : "var(--border)"}`,
            }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Live ticker */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {[
          { label: "Last Price", value: `€${lastPrice}/MWh`, color: priceDir > 0 ? green : red, arrow: priceDir > 0 ? "▲" : "▼" },
          { label: "Live P&L", value: `€${metrics.livePnl.toLocaleString()}`, color: metrics.livePnl >= 0 ? green : red },
          { label: "Daily P&L", value: `€${metrics.dailyPnl.toLocaleString()}`, color: metrics.dailyPnl >= 0 ? green : red },
          { label: "Open Positions", value: metrics.openPositions, color: amber },
          { label: "Win Rate (30d)", value: `${metrics.winRate}%`, color: blue },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ ...val, color: k.color, display: "flex", alignItems: "center", gap: 6 }}>
              {k.value}
              {k.arrow && <span style={{ fontSize: 16 }}>{k.arrow}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Price curve + Order book */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        {/* Price curve */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Day-Ahead vs Intraday Price · {selectedMarket}</div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={priceCurve} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="h" tick={{ fontSize: 10, fill: "var(--sub)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} unit=" €" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="forecast" stroke={purple} fill={purple} fillOpacity={0.1} strokeDasharray="4 2" name="Forecast" />
              <Line type="monotone" dataKey="da" stroke={blue} strokeWidth={2.5} dot={false} name="Day-Ahead" />
              <Line type="monotone" dataKey="id" stroke={amber} strokeWidth={2} dot={false} name="Intraday" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Order Book depth */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 10 }}>Order Book Depth</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* Asks */}
            <div style={{ marginBottom: 4 }}>
              {orderBook.asks.slice(0, 5).reverse().map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <div style={{ flex: 1, height: 18, background: "#ef444415", borderRadius: 3, position: "relative" }}>
                    <div style={{ position: "absolute", right: 0, height: "100%", width: `${(a.qty / 10) * 100}%`, background: "#ef444430", borderRadius: 3 }} />
                  </div>
                  <span style={{ width: 40, fontSize: 11, color: red, textAlign: "right" }}>€{a.price.toFixed(1)}</span>
                  <span style={{ width: 30, fontSize: 10, color: "var(--sub)" }}>{a.qty.toFixed(1)}</span>
                </div>
              ))}
            </div>
            {/* Spread */}
            <div style={{ textAlign: "center", padding: "6px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>€{lastPrice}/MWh</span>
              <span style={{ fontSize: 10, color: "var(--sub)", marginLeft: 8 }}>
                Spread €{(orderBook.asks[0]?.price - orderBook.bids[0]?.price).toFixed(1)}
              </span>
            </div>
            {/* Bids */}
            {orderBook.bids.slice(0, 5).map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <div style={{ flex: 1, height: 18, background: "#10b98115", borderRadius: 3, position: "relative" }}>
                  <div style={{ position: "absolute", right: 0, height: "100%", width: `${(b.qty / 10) * 100}%`, background: "#10b98130", borderRadius: 3 }} />
                </div>
                <span style={{ width: 40, fontSize: 11, color: green, textAlign: "right" }}>€{b.price.toFixed(1)}</span>
                <span style={{ width: 30, fontSize: 10, color: "var(--sub)" }}>{b.qty.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* P&L Chart + Open Positions */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
        {/* P&L 30d */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>30-Day P&L (Daily + Cumulative)</div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={pnl} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="d" tick={{ fontSize: 9, fill: "var(--sub)" }} tickFormatter={v => v.split(" ")[1]} />
              <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} unit="€" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pnl" name="Daily P&L" radius={[3,3,0,0]}>
                {pnl.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? green : red} />)}
              </Bar>
              <Line type="monotone" dataKey="cumulative" stroke={accent} strokeWidth={2.5} dot={false} name="Cumulative" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Open positions */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 10 }}>Open Positions by Market</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {positions.map(p => (
              <div key={p.market} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{p.market}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.pnl >= 0 ? green : red }}>
                    {p.pnl >= 0 ? "+" : ""}€{p.pnl.toFixed(0)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 10, color: green }}>Long {p.long.toFixed(1)} MW</span>
                  <span style={{ fontSize: 10, color: red }}>Short {p.short.toFixed(1)} MW</span>
                  <span style={{ fontSize: 10, color: "var(--sub)" }}>Net {p.net.toFixed(1)} MW</span>
                  <span style={{ fontSize: 10, color: amber }}>Exp {p.exposure.toFixed(0)} MWh</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent trades */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 10 }}>Recent Trades</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["ID", "Time", "Market", "Side", "Qty (MW)", "Price (€/MWh)", "P&L"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "4px 10px", fontSize: 10, color: "var(--sub)", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RECENT_TRADES.map(t => (
              <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "7px 10px", fontSize: 11, color: accent }}>{t.id}</td>
                <td style={{ padding: "7px 10px", fontSize: 11, color: "var(--sub)" }}>{t.time}</td>
                <td style={{ padding: "7px 10px", fontSize: 11, color: "var(--text)" }}>{t.market}</td>
                <td style={{ padding: "7px 10px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.side === "BUY" ? green : red }}>{t.side}</span>
                </td>
                <td style={{ padding: "7px 10px", fontSize: 11, color: "var(--text)" }}>{t.qty.toFixed(1)}</td>
                <td style={{ padding: "7px 10px", fontSize: 11, color: "var(--text)" }}>€{t.price.toFixed(1)}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 700, color: t.pnl >= 0 ? green : red }}>
                  {t.pnl >= 0 ? "+" : ""}€{t.pnl.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick order form */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Quick Order</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          {[
            { label: "Market", type: "select", options: MARKETS },
            { label: "Delivery Period", type: "text", placeholder: "e.g. H14-H16" },
            { label: "Volume (MW)", type: "number", placeholder: "0.0" },
            { label: "Limit Price (€/MWh)", type: "number", placeholder: "0.0" },
          ].map(f => (
            <div key={f.label} style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{f.label}</div>
              {f.type === "select" ? (
                <select style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13 }}>
                  {f.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type} placeholder={f.placeholder} style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }} />
              )}
            </div>
          ))}
          <button style={{ padding: "9px 24px", background: green, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>BUY</button>
          <button style={{ padding: "9px 24px", background: red, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>SELL</button>
        </div>
      </div>
    </div>
  );
}
