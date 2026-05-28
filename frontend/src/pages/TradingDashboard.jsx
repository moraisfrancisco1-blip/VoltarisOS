import { useState, useMemo, useEffect, useRef } from "react"
import {
  AreaChart, Area, ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend
} from "recharts"
import { useAppStore } from "../store/appStore"

// ─── Mock Data ─────────────────────────────────────────────────────────────────
function generatePrices() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    price: +(45 + Math.sin(i / 3) * 28 + Math.random() * 12).toFixed(2),
    bid: +(43 + Math.sin(i / 3) * 26 + Math.random() * 8).toFixed(2),
    ask: +(47 + Math.sin(i / 3) * 30 + Math.random() * 10).toFixed(2),
    volume: +(80 + Math.random() * 240).toFixed(0),
    imbalance: +(Math.random() * 40 - 20).toFixed(1),
  }))
}

const SELL_THRESHOLD = 80
const BUY_THRESHOLD = 50

const INITIAL_ORDERS = [
  { id: 1, type: "BUY",  volume: 50,  price: 48.2,  pnl: +12.4, status: "executed", time: "08:00", session: "DA" },
  { id: 2, type: "SELL", volume: 30,  price: 92.5,  pnl: +38.7, status: "executed", time: "14:00", session: "DA" },
  { id: 3, type: "SELL", volume: 20,  price: 85.0,  pnl: +22.1, status: "executed", time: "16:30", session: "ID" },
  { id: 4, type: "BUY",  volume: 100, price: 44.8,  pnl: +5.2,  status: "pending",  time: "18:00", session: "DA" },
  { id: 5, type: "SELL", volume: 45,  price: 78.3,  pnl: null,  status: "cancelled",time: "19:00", session: "ID" },
]

// ─── Orderbook mock ────────────────────────────────────────────────────────────
function generateOrderbook() {
  const mid = 72.4
  const bids = Array.from({ length: 8 }, (_, i) => ({
    price: +(mid - i * 0.6 - Math.random() * 0.3).toFixed(2),
    volume: +(40 + Math.random() * 180).toFixed(0),
    total: 0,
  }))
  const asks = Array.from({ length: 8 }, (_, i) => ({
    price: +(mid + 0.4 + i * 0.6 + Math.random() * 0.3).toFixed(2),
    volume: +(40 + Math.random() * 180).toFixed(0),
    total: 0,
  }))
  let cumBid = 0, cumAsk = 0
  bids.forEach(b => { cumBid += b.volume; b.total = cumBid })
  asks.forEach(a => { cumAsk += a.volume; a.total = cumAsk })
  return { bids, asks, mid }
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "var(--tooltip-bg)", border: "1px solid var(--border-strong)",
      borderRadius: 12, padding: "12px 16px", fontSize: 12,
      backdropFilter: "blur(20px)", boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
    }}>
      <div style={{ color: "var(--sub)", marginBottom: 8, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 4, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
            <span style={{ color: "var(--sub)", fontSize: 11 }}>{p.name}</span>
          </div>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Sparkline for orderbook ───────────────────────────────────────────────────
function DepthBar({ pct, color }) {
  return (
    <div style={{ width: "100%", height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
    </div>
  )
}

// ─── Live Price Ticker ─────────────────────────────────────────────────────────
function LiveTicker({ price, change }) {
  const up = change >= 0
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        {price.toFixed(2)}
      </span>
      <span style={{ fontSize: 13, color: "var(--sub)" }}>€/MWh</span>
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: up ? "#10b981" : "#f87171",
        background: up ? "#10b98120" : "#f8717120",
        padding: "2px 8px", borderRadius: 20,
      }}>{up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%</span>
    </div>
  )
}

export default function TradingDashboard() {
  const { t, lang } = useAppStore()
  const [prices] = useState(generatePrices)
  const [orderbook, setOrderbook] = useState(generateOrderbook)
  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const [form, setForm] = useState({ type: "BUY", volume: "", price: "", session: "DA" })
  const [tab, setTab] = useState("chart") // chart | depth | history
  const [filter, setFilter] = useState("all")
  const now_h = new Date().getHours()

  // Simulate live price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setOrderbook(generateOrderbook())
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const currentPrice = prices[now_h]?.price || 72.4
  const prevPrice = prices[Math.max(0, now_h - 1)]?.price || 70.0
  const priceChange = +((currentPrice - prevPrice) / prevPrice * 100).toFixed(2)
  const avgPrice = +(prices.reduce((s, p) => s + p.price, 0) / prices.length).toFixed(2)
  const maxPrice = +Math.max(...prices.map(p => p.price)).toFixed(2)
  const minPrice = +Math.min(...prices.map(p => p.price)).toFixed(2)
  const totalPnL = orders.filter(o => o.pnl).reduce((s, o) => s + o.pnl, 0)
  const spread = +(orderbook.asks[0]?.price - orderbook.bids[0]?.price).toFixed(2)

  const maxBidVol = Math.max(...orderbook.bids.map(b => b.volume))
  const maxAskVol = Math.max(...orderbook.asks.map(a => a.volume))

  const placeOrder = () => {
    if (!form.volume || !form.price) return
    const newOrder = {
      id: Date.now(), type: form.type,
      volume: parseFloat(form.volume), price: parseFloat(form.price),
      pnl: null, status: "pending",
      time: new Date().toTimeString().slice(0, 5),
      session: form.session,
    }
    setOrders(prev => [newOrder, ...prev])
    setForm(f => ({ ...f, volume: "", price: "" }))
  }

  const filteredOrders = filter === "all" ? orders : orders.filter(o => o.status === filter)

  const statusColor = { executed: "#10b981", pending: "#f59e0b", cancelled: "#6b7280" }
  const statusBg = { executed: "#10b98118", pending: "#f59e0b18", cancelled: "#6b728018" }

  const cardStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "20px 24px",
  }

  const inputStyle = {
    width: "100%", padding: "10px 14px",
    background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: 10, color: "var(--text)", fontSize: 14,
    marginBottom: 10, boxSizing: "border-box",
    outline: "none",
  }

  return (
    <div style={{ padding: "28px 32px", color: "var(--text)", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{t("page_trading")}</h1>
          <p style={{ color: "var(--sub)", fontSize: 14 }}>{t("trading_sub")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: "#10b98120", color: "#10b981", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse 2s infinite" }} />
            LIVE
          </div>
          <div style={{ color: "var(--sub)", fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", padding: "6px 14px", borderRadius: 20 }}>
            EPEX SPOT · NL
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ ...cardStyle, background: "linear-gradient(135deg, var(--surface) 0%, var(--surface) 100%)" }}>
          <div style={{ color: "var(--sub)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{t("trading_current_price")}</div>
          <LiveTicker price={currentPrice} change={priceChange} />
          <div style={{ marginTop: 8, color: "var(--sub)", fontSize: 12 }}>
            {t("trading_spread")}: <span style={{ color: "#f59e0b", fontWeight: 700 }}>{spread} €</span>
          </div>
        </div>
        {[
          { label: t("trading_avg_24h"), value: `${avgPrice} €`, color: "#f59e0b", icon: "≈" },
          { label: t("trading_max"),     value: `${maxPrice} €`, color: "#f87171", icon: "↑" },
          { label: t("trading_min"),     value: `${minPrice} €`, color: "#60a5fa", icon: "↓" },
          { label: t("trading_total_pnl"), value: `+${totalPnL.toFixed(1)} €`, color: "#10b981", icon: "€" },
        ].map(k => (
          <div key={k.label} style={cardStyle}>
            <div style={{ color: "var(--sub)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ color: k.color, fontSize: 18, marginTop: 4, opacity: 0.6 }}>{k.icon}</div>
          </div>
        ))}
      </div>

      {/* Main 3-col grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px 280px", gap: 20, marginBottom: 20 }}>

        {/* Chart + tabs */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>{t("trading_price_chart")}</h3>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { id: "chart", label: t("trading_tab_chart") },
                { id: "depth", label: t("trading_tab_depth") },
              ].map(tb => (
                <button key={tb.id} onClick={() => setTab(tb.id)} style={{
                  padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: tab === tb.id ? "var(--accent)" : "var(--bg)",
                  color: tab === tb.id ? "#fff" : "var(--sub)",
                }}>{tb.label}</button>
              ))}
            </div>
          </div>

          {tab === "chart" ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={prices} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line, rgba(128,128,128,0.1))" />
                <XAxis dataKey="hour" tick={{ fill: "var(--sub)", fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fill: "var(--sub)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={SELL_THRESHOLD} stroke="#f87171" strokeDasharray="4 4" label={{ value: t("trading_sell_thresh"), fill: "#f87171", fontSize: 10 }} />
                <ReferenceLine y={BUY_THRESHOLD} stroke="#10b981" strokeDasharray="4 4" label={{ value: t("trading_buy_thresh"), fill: "#10b981", fontSize: 10 }} />
                <Bar dataKey="volume" name={t("trading_volume")} fill="var(--accent)" fillOpacity={0.12} barSize={6} yAxisId={0} />
                <Area type="monotone" dataKey="price" name={t("trading_price")} stroke="var(--accent)" strokeWidth={2.2} fill="url(#priceGrad)" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            /* Depth chart */
            <div style={{ height: 240, display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 12 }}>
                <div style={{ color: "#10b981", fontSize: 12, fontWeight: 700 }}>{t("trading_bids")}</div>
                <div style={{ color: "var(--sub)", fontSize: 13, fontWeight: 800 }}>MID {orderbook.mid.toFixed(2)} €</div>
                <div style={{ color: "#f87171", fontSize: 12, fontWeight: 700 }}>{t("trading_asks")}</div>
              </div>
              {orderbook.bids.slice(0, 6).map((bid, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 60, textAlign: "right", color: "#10b981", fontSize: 12, fontWeight: 600 }}>{bid.price}</span>
                  <div style={{ flex: 1 }}>
                    <DepthBar pct={(bid.volume / maxBidVol) * 100} color="#10b98140" />
                  </div>
                  <span style={{ width: 50, color: "var(--sub)", fontSize: 11 }}>{bid.volume} MW</span>
                  <span style={{ width: 50, color: "var(--sub)", fontSize: 11 }}>{orderbook.asks[i]?.volume} MW</span>
                  <div style={{ flex: 1 }}>
                    <DepthBar pct={(orderbook.asks[i]?.volume / maxAskVol) * 100} color="#f8717140" />
                  </div>
                  <span style={{ width: 60, color: "#f87171", fontSize: 12, fontWeight: 600 }}>{orderbook.asks[i]?.price}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orderbook */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>{t("trading_orderbook")}</h3>
            <span style={{ fontSize: 11, color: "var(--sub)", background: "var(--bg)", padding: "3px 10px", borderRadius: 12 }}>
              {t("trading_spread")}: <b style={{ color: "#f59e0b" }}>{spread} €</b>
            </span>
          </div>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
            {[t("trading_price"), t("trading_volume"), t("trading_total")].map(h => (
              <div key={h} style={{ fontSize: 10, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>{h}</div>
            ))}
          </div>
          {/* Asks (top) */}
          {orderbook.asks.slice().reverse().map((ask, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 3, position: "relative" }}>
              <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${(ask.volume / maxAskVol) * 100}%`, background: "#f8717112", borderRadius: 4 }} />
              <span style={{ color: "#f87171", fontSize: 12, fontWeight: 600, textAlign: "center", position: "relative" }}>{ask.price}</span>
              <span style={{ color: "var(--text)", fontSize: 12, textAlign: "center", position: "relative" }}>{ask.volume}</span>
              <span style={{ color: "var(--sub)", fontSize: 11, textAlign: "center", position: "relative" }}>{ask.total}</span>
            </div>
          ))}
          {/* Mid price */}
          <div style={{ textAlign: "center", padding: "8px 0", fontSize: 14, fontWeight: 800, color: "var(--text)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", margin: "6px 0" }}>
            {orderbook.mid.toFixed(2)} <span style={{ fontSize: 11, color: "var(--sub)" }}>€/MWh</span>
          </div>
          {/* Bids */}
          {orderbook.bids.map((bid, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 3, position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(bid.volume / maxBidVol) * 100}%`, background: "#10b98112", borderRadius: 4 }} />
              <span style={{ color: "#10b981", fontSize: 12, fontWeight: 600, textAlign: "center", position: "relative" }}>{bid.price}</span>
              <span style={{ color: "var(--text)", fontSize: 12, textAlign: "center", position: "relative" }}>{bid.volume}</span>
              <span style={{ color: "var(--sub)", fontSize: 11, textAlign: "center", position: "relative" }}>{bid.total}</span>
            </div>
          ))}
        </div>

        {/* Order Form */}
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("trading_new_order")}</h3>

          {/* Session */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{t("trading_session")}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["DA", "ID", "FCR"].map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, session: s }))} style={{
                  flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: form.session === s ? "var(--accent)" : "var(--bg)",
                  color: form.session === s ? "#fff" : "var(--sub)",
                }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Buy / Sell */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {["BUY", "SELL"].map(tp => (
              <button key={tp} onClick={() => setForm(f => ({ ...f, type: tp }))} style={{
                flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                background: form.type === tp ? (tp === "BUY" ? "#10b98122" : "#f8717122") : "var(--bg)",
                color: form.type === tp ? (tp === "BUY" ? "#10b981" : "#f87171") : "var(--sub)",
                border: form.type === tp ? `1px solid ${tp === "BUY" ? "#10b981" : "#f87171"}` : "1px solid var(--border)",
              }}>{tp === "BUY" ? t("trading_buy") : t("trading_sell")}</button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("trading_volume")} (MWh)</div>
          <input
            placeholder="0.00"
            value={form.volume}
            onChange={e => setForm(f => ({ ...f, volume: e.target.value }))}
            type="number" style={inputStyle}
          />
          <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("trading_limit_price")} (€/MWh)</div>
          <input
            placeholder={currentPrice.toFixed(2)}
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            type="number" style={inputStyle}
          />

          {form.volume && form.price && (
            <div style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "var(--sub)" }}>{t("trading_notional")}</span>
                <span style={{ fontWeight: 700 }}>{(form.volume * form.price).toFixed(2)} €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--sub)" }}>{t("trading_market_impact")}</span>
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>{form.volume > 100 ? t("trading_high") : t("trading_low")}</span>
              </div>
            </div>
          )}

          <button onClick={placeOrder} style={{
            width: "100%", padding: "13px", borderRadius: 12, border: "none",
            background: form.type === "BUY"
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "linear-gradient(135deg, #f87171, #dc2626)",
            color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer",
            boxShadow: form.type === "BUY" ? "0 4px 20px #10b98140" : "0 4px 20px #f8717140",
          }}>
            {form.type === "BUY" ? `▲ ${t("trading_buy")}` : `▼ ${t("trading_sell")}`} {form.session}
          </button>

          {/* Quick fill buttons */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {[25, 50, 100, 200].map(v => (
              <button key={v} onClick={() => setForm(f => ({ ...f, volume: v.toString() }))} style={{
                flex: 1, padding: "5px 0", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg)", color: "var(--sub)", fontSize: 11, cursor: "pointer",
              }}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders History */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>{t("trading_order_history")}</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "executed", "pending", "cancelled"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: filter === f ? "var(--accent)" : "var(--bg)",
                color: filter === f ? "#fff" : "var(--sub)",
              }}>
                {f === "all" ? t("trading_all") : f === "executed" ? t("trading_executed") : f === "pending" ? t("trading_pending") : t("trading_cancelled")}
              </button>
            ))}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[t("trading_type"), t("trading_session"), t("trading_volume"), t("trading_limit_price"), "P&L", t("trading_status"), t("trading_time")].map(h => (
                <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "var(--sub)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => (
              <tr key={o.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{
                    color: o.type === "BUY" ? "#10b981" : "#f87171",
                    background: o.type === "BUY" ? "#10b98118" : "#f8717118",
                    padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  }}>{o.type === "BUY" ? t("trading_buy") : t("trading_sell")}</span>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--sub)", fontSize: 12 }}>{o.session}</td>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{o.volume} MWh</td>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{o.price} €/MWh</td>
                <td style={{ padding: "12px 14px", color: o.pnl ? "#10b981" : "var(--sub)", fontWeight: 700 }}>
                  {o.pnl ? `+${o.pnl.toFixed(1)} €` : "—"}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{
                    background: statusBg[o.status], color: statusColor[o.status],
                    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  }}>
                    {o.status === "executed" ? t("trading_executed") : o.status === "pending" ? t("trading_pending") : t("trading_cancelled")}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--sub)", fontSize: 13 }}>{o.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
