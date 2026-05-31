import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";
import { C, ChartDefs, PremiumTooltip, axisStyle, gridStyle, glassCard, KpiCard } from "../components/ChartTheme";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
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

const genPnL = () => {
  const raw = Array.from({ length: 30 }, (_, i) => ({ d: `Day ${i + 1}`, pnl: rand(-400, 800) }));
  let cum = 0;
  return raw.map(d => { cum += d.pnl; return { ...d, cumulative: Math.round(cum) }; });
};

const genPositions = () => MARKETS.map(m => ({
  market: m,
  long: rand(0, 10), short: rand(0, 8), net: rand(-5, 5),
  pnl: rand(-200, 600), exposure: rand(10, 100),
}));

const RECENT_TRADES = Array.from({ length: 8 }, (_, i) => ({
  id: `T${1000 + i}`,
  time: `${14 - i}:${String(Math.floor(rand(0, 59, 0))).padStart(2, "0")}`,
  market: MARKETS[i % MARKETS.length],
  side: i % 3 === 0 ? "SELL" : "BUY",
  qty: rand(1, 8), price: rand(55, 110), pnl: rand(-80, 200),
}));

export default function TradingDashboard() {
  const [priceCurve]      = useState(genPriceCurve);
  const [orderBook, setOrderBook] = useState(genOrderBook);
  const [pnl]             = useState(genPnL);
  const [positions, setPositions] = useState(genPositions);
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
        livePnl:       Math.round(m.livePnl  + rand(-50, 80)),
        dailyPnl:      Math.round(m.dailyPnl + rand(-20, 40)),
        openPositions: m.openPositions,
        exposure:      parseFloat((m.exposure + rand(-0.5, 0.5)).toFixed(1)),
        winRate:       m.winRate,
      }));
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const priceColor  = priceDir > 0 ? C.green : C.red;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: -0.8,
            textShadow: `0 0 30px ${C.accent}40` }}>Energy Trading</h1>
          <div style={{ color: "rgba(148,163,184,0.6)", fontSize: 13, marginTop: 3 }}>Multi-market · DAM · Intraday · Ancillary Services</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {MARKETS.map(m => (
            <button key={m} onClick={() => setSelectedMarket(m)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              background:   selectedMarket === m ? `${C.accent}30` : "rgba(255,255,255,0.04)",
              color:        selectedMarket === m ? C.accent : "rgba(148,163,184,0.7)",
              border:       `1px solid ${selectedMarket === m ? C.accent : "rgba(255,255,255,0.08)"}`,
              boxShadow:    selectedMarket === m ? `0 0 12px ${C.accent}30` : "none",
              fontWeight:   selectedMarket === m ? 700 : 500,
              transition: "all 0.2s",
            }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Live ticker KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <KpiCard lbl="Last Price"      value={`€${lastPrice}/MWh`}                   sub={priceDir > 0 ? "▲ rising" : "▼ falling"}   color={priceColor} icon="📊" />
        <KpiCard lbl="Live P&L"        value={`€${metrics.livePnl.toLocaleString()}`} sub="Real-time"                                 color={metrics.livePnl >= 0 ? C.green : C.red} icon="💹" />
        <KpiCard lbl="Daily P&L"       value={`€${metrics.dailyPnl.toLocaleString()}`} sub="Today 00:00–now"                           color={metrics.dailyPnl >= 0 ? C.green : C.red} icon="📅" />
        <KpiCard lbl="Open Positions"  value={metrics.openPositions}                  sub="Across markets"                            color={C.amber} icon="⚡" />
        <KpiCard lbl="Win Rate (30d)"  value={`${metrics.winRate}%`}                 sub="Profitable trades"                         color={C.blue} icon="🎯" />
      </div>

      {/* Price curve + Order book */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>

        {/* Price curve */}
        <div style={glassCard(C.blue)}>
          <div style={{ position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.blue}08, transparent 70%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase",
            letterSpacing: 1, marginBottom: 14, fontWeight: 700, position: "relative" }}>
            Day-Ahead vs Intraday · {selectedMarket}
          </div>
          <ResponsiveContainer width="100%" height={230} style={{ position: "relative" }}>
            <ComposedChart data={priceCurve} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="trd_da" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.blue}   stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.blue}   stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="trd_fc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.purple} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={C.purple} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="h" tick={axisStyle} />
              <YAxis tick={axisStyle} unit=" €" />
              <Tooltip content={<PremiumTooltip unit=" €" />} />
              <Area type="monotone" dataKey="forecast" stroke={C.purple} fill="url(#trd_fc)"
                strokeDasharray="5 3" strokeWidth={1.5} name="Forecast" />
              <Area type="monotone" dataKey="da" stroke={C.blue} fill="url(#trd_da)"
                strokeWidth={2.5} name="Day-Ahead"
                style={{ filter: `drop-shadow(0 0 6px ${C.blue}60)` }} />
              <Line type="monotone" dataKey="id" stroke={C.amber} strokeWidth={2} dot={false} name="Intraday"
                style={{ filter: `drop-shadow(0 0 4px ${C.amber}60)` }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Order Book */}
        <div style={glassCard(C.accent)}>
          <div style={{ position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.accent}08, transparent 70%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase",
            letterSpacing: 1, marginBottom: 12, fontWeight: 700, position: "relative" }}>Order Book Depth</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, position: "relative" }}>
            {/* Asks */}
            {orderBook.asks.slice(0, 5).reverse().map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ flex: 1, height: 20, background: "rgba(239,68,68,0.08)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", right: 0, height: "100%",
                    width: `${(a.qty / 10) * 100}%`,
                    background: `linear-gradient(90deg, transparent, ${C.red}40)`,
                    borderRadius: 4,
                  }} />
                </div>
                <span style={{ width: 44, fontSize: 11, color: C.red, textAlign: "right",
                  fontWeight: 700, textShadow: `0 0 6px ${C.red}60` }}>€{a.price.toFixed(1)}</span>
                <span style={{ width: 32, fontSize: 10, color: "rgba(148,163,184,0.5)" }}>{a.qty.toFixed(1)}</span>
              </div>
            ))}
            {/* Mid price */}
            <div style={{ textAlign: "center", padding: "8px 0", margin: "4px 0",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#fff",
                textShadow: `0 0 12px ${priceColor}60` }}>€{lastPrice}/MWh</span>
              <span style={{ fontSize: 10, color: "rgba(148,163,184,0.5)", marginLeft: 8 }}>
                Spread €{(orderBook.asks[0]?.price - orderBook.bids[0]?.price).toFixed(1)}
              </span>
            </div>
            {/* Bids */}
            {orderBook.bids.slice(0, 5).map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ flex: 1, height: 20, background: "rgba(16,185,129,0.08)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", right: 0, height: "100%",
                    width: `${(b.qty / 10) * 100}%`,
                    background: `linear-gradient(90deg, transparent, ${C.green}35)`,
                    borderRadius: 4,
                  }} />
                </div>
                <span style={{ width: 44, fontSize: 11, color: C.green, textAlign: "right",
                  fontWeight: 700, textShadow: `0 0 6px ${C.green}60` }}>€{b.price.toFixed(1)}</span>
                <span style={{ width: 32, fontSize: 10, color: "rgba(148,163,184,0.5)" }}>{b.qty.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* P&L + Positions */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>

        {/* P&L 30d */}
        <div style={glassCard(C.green)}>
          <div style={{ position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.green}08, transparent 70%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase",
            letterSpacing: 1, marginBottom: 14, fontWeight: 700, position: "relative" }}>30-Day P&L (Daily + Cumulative)</div>
          <ResponsiveContainer width="100%" height={190} style={{ position: "relative" }}>
            <ComposedChart data={pnl} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="cum_grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.accent} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="d" tick={axisStyle} tickFormatter={v => v.split(" ")[1]} />
              <YAxis tick={axisStyle} unit="€" />
              <Tooltip content={<PremiumTooltip unit="€" />} />
              <Bar dataKey="pnl" name="Daily P&L" radius={[4, 4, 0, 0]} maxBarSize={18}>
                {pnl.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? C.green : C.red}
                    style={{ filter: `drop-shadow(0 2px 6px ${d.pnl >= 0 ? C.green : C.red}50)` }} />
                ))}
              </Bar>
              <Area type="monotone" dataKey="cumulative" stroke={C.accent} fill="url(#cum_grad)"
                strokeWidth={2.5} dot={false} name="Cumulative"
                style={{ filter: `drop-shadow(0 0 8px ${C.accent}60)` }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Open Positions */}
        <div style={glassCard(C.amber)}>
          <div style={{ position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.amber}06, transparent 70%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase",
            letterSpacing: 1, marginBottom: 12, fontWeight: 700, position: "relative" }}>Open Positions by Market</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
            {positions.map(p => (
              <div key={p.market} style={{
                padding: "8px 10px", borderRadius: 10,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
                borderBottom: "1px solid rgba(255,255,255,0.04)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{p.market}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: p.pnl >= 0 ? C.green : C.red,
                    textShadow: `0 0 8px ${p.pnl >= 0 ? C.green : C.red}60` }}>
                    {p.pnl >= 0 ? "+" : ""}€{p.pnl.toFixed(0)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    { label: `Long ${p.long.toFixed(1)} MW`, color: C.green },
                    { label: `Short ${p.short.toFixed(1)} MW`, color: C.red },
                    { label: `Net ${p.net.toFixed(1)} MW`, color: "rgba(148,163,184,0.6)" },
                    { label: `${p.exposure.toFixed(0)} MWh`, color: C.amber },
                  ].map(tag => (
                    <span key={tag.label} style={{ fontSize: 10, color: tag.color, fontWeight: 600,
                      background: `${tag.color}12`, padding: "2px 6px", borderRadius: 6 }}>{tag.label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent trades */}
      <div style={glassCard(C.accent)}>
        <div style={{ position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${C.accent}06, transparent 70%)`,
          pointerEvents: "none" }} />
        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase",
          letterSpacing: 1, marginBottom: 14, fontWeight: 700, position: "relative" }}>Recent Trades</div>
        <table style={{ width: "100%", borderCollapse: "collapse", position: "relative" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["ID", "Time", "Market", "Side", "Qty (MW)", "Price (€/MWh)", "P&L"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "5px 10px", fontSize: 10,
                  color: "rgba(148,163,184,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RECENT_TRADES.map((t, i) => (
              <tr key={t.id} style={{
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
              }}>
                <td style={{ padding: "8px 10px", fontSize: 11, color: C.accent, fontWeight: 700 }}>{t.id}</td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "rgba(148,163,184,0.6)" }}>{t.time}</td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "#e2e8f0" }}>{t.market}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: t.side === "BUY" ? C.green : C.red,
                    background: `${t.side === "BUY" ? C.green : C.red}15`,
                    padding: "2px 8px", borderRadius: 6,
                    boxShadow: `0 0 6px ${t.side === "BUY" ? C.green : C.red}30` }}>{t.side}</span>
                </td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "#e2e8f0" }}>{t.qty.toFixed(1)}</td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "#e2e8f0" }}>€{t.price.toFixed(1)}</td>
                <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 900,
                  color: t.pnl >= 0 ? C.green : C.red,
                  textShadow: `0 0 8px ${t.pnl >= 0 ? C.green : C.red}50` }}>
                  {t.pnl >= 0 ? "+" : ""}€{t.pnl.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick order */}
      <div style={glassCard(C.green)}>
        <div style={{ position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${C.green}06, transparent 70%)`,
          pointerEvents: "none" }} />
        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase",
          letterSpacing: 1, marginBottom: 14, fontWeight: 700, position: "relative" }}>Quick Order</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", position: "relative" }}>
          {[
            { label: "Market", type: "select", options: MARKETS },
            { label: "Delivery Period", type: "text", placeholder: "e.g. H14-H16" },
            { label: "Volume (MW)", type: "number", placeholder: "0.0" },
            { label: "Limit Price (€/MWh)", type: "number", placeholder: "0.0" },
          ].map(f => (
            <div key={f.label} style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", marginBottom: 5, fontWeight: 600 }}>{f.label}</div>
              {f.type === "select" ? (
                <select style={{ width: "100%", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                  padding: "9px 12px", color: "#e2e8f0", fontSize: 13 }}>
                  {f.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type} placeholder={f.placeholder} style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                  padding: "9px 12px", color: "#e2e8f0", fontSize: 13, boxSizing: "border-box"
                }} />
              )}
            </div>
          ))}
          <button style={{ padding: "10px 26px", background: `linear-gradient(135deg, ${C.green}, #059669)`,
            border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 900, cursor: "pointer",
            boxShadow: `0 4px 16px ${C.green}40` }}>BUY</button>
          <button style={{ padding: "10px 26px", background: `linear-gradient(135deg, ${C.red}, #b91c1c)`,
            border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 900, cursor: "pointer",
            boxShadow: `0 4px 16px ${C.red}40` }}>SELL</button>
        </div>
      </div>
    </div>
  );
}
