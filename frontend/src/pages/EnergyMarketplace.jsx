import { useState, useEffect } from "react"
import { useAppStore } from "../store/appStore"

const API = import.meta.env.VITE_API_URL || ""

const TENANTS = [
  { id: 1, name: "Voltaris Lisboa", type: "BESS", mw: 12, surplus: 4.2, price: 78, location: "Lisbon, PT", rating: 4.8, trades: 142 },
  { id: 2, name: "GreenGrid Porto", type: "Solar+BESS", mw: 8, surplus: 2.1, price: 72, location: "Porto, PT", rating: 4.6, trades: 89 },
  { id: 3, name: "IberiaPower Madrid", type: "Wind+BESS", mw: 20, surplus: 7.5, price: 81, location: "Madrid, ES", rating: 4.9, trades: 211 },
  { id: 4, name: "NordEnergie Amsterdam", type: "BESS", mw: 15, surplus: 6.0, price: 69, location: "Amsterdam, NL", rating: 4.7, trades: 178 },
  { id: 5, name: "BerlinKraft GmbH", type: "Hydro+BESS", mw: 10, surplus: 3.3, price: 84, location: "Berlin, DE", rating: 4.5, trades: 67 },
  { id: 6, name: "LyonRenew SAS", type: "Solar+BESS", mw: 6, surplus: 1.8, price: 65, location: "Lyon, FR", rating: 4.3, trades: 44 },
]

const ORDER_BOOK_BIDS = [
  { price: 82, volume: 2.0, tenant: "BerlinKraft", time: "14:02:11" },
  { price: 80, volume: 3.5, tenant: "LyonRenew", time: "14:01:48" },
  { price: 79, volume: 1.0, tenant: "GreenGrid", time: "14:01:33" },
  { price: 77, volume: 5.0, tenant: "NordEnergie", time: "14:00:55" },
  { price: 75, volume: 2.5, tenant: "IberiaPower", time: "14:00:22" },
]

const ORDER_BOOK_ASKS = [
  { price: 83, volume: 1.5, tenant: "Voltaris", time: "14:02:05" },
  { price: 85, volume: 4.0, tenant: "IberiaPower", time: "14:01:50" },
  { price: 86, volume: 2.0, tenant: "GreenGrid", time: "14:01:22" },
  { price: 88, volume: 3.0, tenant: "NordEnergie", time: "14:00:44" },
  { price: 90, volume: 5.5, tenant: "BerlinKraft", time: "14:00:10" },
]

const RECENT_TRADES = [
  { buyer: "BerlinKraft", seller: "IberiaPower", mwh: 2.0, price: 82, time: "14:01:55", status: "settled" },
  { buyer: "LyonRenew", seller: "NordEnergie", mwh: 1.5, price: 79, time: "14:00:30", status: "settled" },
  { buyer: "GreenGrid", seller: "Voltaris", mwh: 3.0, price: 78, time: "13:58:12", status: "settled" },
  { buyer: "NordEnergie", seller: "BerlinKraft", mwh: 0.8, price: 84, time: "13:55:40", status: "settled" },
  { buyer: "IberiaPower", seller: "LyonRenew", mwh: 2.5, price: 75, time: "13:53:22", status: "settled" },
]

function StatCard({ label, value, unit, sub, color: c }) {
  const { color } = useAppStore()
  return (
    <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
      <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: "700", color: c || "var(--text)" }}>
        {value}<span style={{ fontSize: "13px", fontWeight: "400", color: "var(--sub)", marginLeft: "2px" }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: "11px", color: "var(--sub)", marginTop: "2px" }}>{sub}</div>}
    </div>
  )
}

export default function EnergyMarketplace() {
  const { color } = useAppStore()
  const [tab, setTab] = useState("market")
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [tradeForm, setTradeForm] = useState({ volume: "", price: "", side: "buy" })
  const [trades, setTrades] = useState(RECENT_TRADES)
  const [orderBids, setOrderBids] = useState(ORDER_BOOK_BIDS)
  const [toast, setToast] = useState(null)

  // Live price flicker
  const [livePrices, setLivePrices] = useState(() => TENANTS.map(t => ({ id: t.id, price: t.price })))
  useEffect(() => {
    const id = setInterval(() => {
      setLivePrices(prev => prev.map(p => ({
        ...p, price: +(p.price + (Math.random() - 0.5) * 2).toFixed(2)
      })))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  function getLivePrice(id) {
    return livePrices.find(p => p.id === id)?.price ?? 0
  }

  function submitOrder() {
    if (!tradeForm.volume || !tradeForm.price) return
    const newTrade = {
      buyer: tradeForm.side === "buy" ? "Voltaris Lisboa" : selectedTenant?.name || "GreenGrid",
      seller: tradeForm.side === "sell" ? "Voltaris Lisboa" : selectedTenant?.name || "GreenGrid",
      mwh: parseFloat(tradeForm.volume),
      price: parseFloat(tradeForm.price),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      status: "pending",
    }
    setTrades(prev => [newTrade, ...prev.slice(0, 9)])
    setTradeForm({ volume: "", price: "", side: "buy" })
    setToast(`Order placed: ${tradeForm.side === "buy" ? "BUY" : "SELL"} ${tradeForm.volume} MWh @ €${tradeForm.price}`)
    setTimeout(() => setToast(null), 3000)
  }

  const spreadPrice = orderBids[0].price
  const totalLiquidity = TENANTS.reduce((a, t) => a + t.surplus, 0).toFixed(1)
  const avgPrice = (TENANTS.reduce((a, t) => a + getLivePrice(t.id), 0) / TENANTS.length).toFixed(2)

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 999,
          padding: "12px 20px", borderRadius: "10px",
          background: "#10b981", color: "#fff", fontSize: "13px", fontWeight: "600",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text)", margin: 0 }}>Energy Marketplace</h1>
          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "12px", background: "#10b98118", color: "#10b981", fontWeight: "700", letterSpacing: "1px" }}>P2P TRADING</span>
          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "12px", background: `${color}18`, color, fontWeight: "700", letterSpacing: "1px" }}>LIVE</span>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--sub)" }}>
          Peer-to-peer energy trading between operator tenants. Buy and sell surplus MWh directly — no utility intermediary.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <StatCard label="Live Spot Price" value={`€${avgPrice}`} unit="/MWh" sub="Fleet avg" color={color} />
        <StatCard label="Total Liquidity" value={totalLiquidity} unit=" MWh" sub="Available now" />
        <StatCard label="Active Participants" value={TENANTS.length} unit=" operators" />
        <StatCard label="24h Volume" value="142" unit=" MWh" sub="€11,240 settled" color="#10b981" />
        <StatCard label="Best Bid" value={`€${orderBids[0].price}`} unit="/MWh" sub={`${orderBids[0].volume} MWh`} color="#10b981" />
        <StatCard label="Best Ask" value={`€${ORDER_BOOK_ASKS[0].price}`} unit="/MWh" sub={`${ORDER_BOOK_ASKS[0].volume} MWh`} color="#ef4444" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", background: "var(--surface2)", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
        {["market", "orderbook", "trades"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 18px", borderRadius: "7px", border: "none",
            background: tab === t ? color : "transparent",
            color: tab === t ? "#fff" : "var(--sub)",
            cursor: "pointer", fontSize: "12px", fontWeight: tab === t ? "600" : "400",
            textTransform: "capitalize",
          }}>
            {t === "orderbook" ? "Order Book" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "market" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px" }}>
          {/* Operator listing */}
          <div>
            <div style={{ fontSize: "11px", color: "var(--sub)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Available Operators</div>
            {TENANTS.map(tenant => {
              const liveP = getLivePrice(tenant.id)
              return (
                <div key={tenant.id} onClick={() => setSelectedTenant(selectedTenant?.id === tenant.id ? null : tenant)}
                  style={{
                    padding: "16px", borderRadius: "10px", marginBottom: "8px",
                    border: selectedTenant?.id === tenant.id ? `1.5px solid ${color}` : "1px solid var(--border)",
                    background: selectedTenant?.id === tenant.id ? `${color}08` : "var(--surface2)",
                    cursor: "pointer", transition: "all 0.15s"
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)", marginBottom: "2px" }}>{tenant.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--sub)" }}>
                        {tenant.type} · {tenant.location} · {tenant.trades} trades · ★ {tenant.rating}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "18px", fontWeight: "700", color, lineHeight: 1 }}>€{liveP.toFixed(2)}</div>
                      <div style={{ fontSize: "11px", color: "var(--sub)" }}>/MWh</div>
                    </div>
                  </div>
                  <div style={{ marginTop: "10px", display: "flex", gap: "16px" }}>
                    <div>
                      <div style={{ fontSize: "10px", color: "var(--sub)" }}>Surplus Available</div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#10b981" }}>{tenant.surplus} MWh</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", color: "var(--sub)" }}>Capacity</div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)" }}>{tenant.mw} MW</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "10px", color: "var(--sub)", marginBottom: "4px" }}>Surplus ratio</div>
                      <div style={{ height: "4px", borderRadius: "2px", background: "var(--border)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(tenant.surplus / tenant.mw / 4) * 100}%`, background: "#10b981", borderRadius: "2px" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Trade panel */}
          <div>
            <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "16px" }}>
                {selectedTenant ? `Trade with ${selectedTenant.name}` : "Place an Order"}
              </div>

              <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
                {["buy", "sell"].map(side => (
                  <button key={side} onClick={() => setTradeForm(f => ({ ...f, side }))} style={{
                    flex: 1, padding: "8px", borderRadius: "7px", border: "none",
                    background: tradeForm.side === side ? (side === "buy" ? "#10b981" : "#ef4444") : "var(--surface)",
                    color: tradeForm.side === side ? "#fff" : "var(--sub)",
                    cursor: "pointer", fontSize: "12px", fontWeight: "600", textTransform: "uppercase"
                  }}>
                    {side}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "5px" }}>Volume (MWh)</div>
                <input value={tradeForm.volume} onChange={e => setTradeForm(f => ({ ...f, volume: e.target.value }))}
                  placeholder="e.g. 2.5" type="number" step="0.1"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "13px", boxSizing: "border-box", outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "5px" }}>Limit Price (€/MWh)</div>
                <input value={tradeForm.price} onChange={e => setTradeForm(f => ({ ...f, price: e.target.value }))}
                  placeholder={selectedTenant ? `≈ €${getLivePrice(selectedTenant.id).toFixed(2)}` : "e.g. 80"}
                  type="number" step="0.5"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "13px", boxSizing: "border-box", outline: "none" }}
                />
              </div>

              {tradeForm.volume && tradeForm.price && (
                <div style={{ padding: "10px 12px", borderRadius: "7px", background: "var(--surface)", marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "4px" }}>Order Summary</div>
                  <div style={{ fontSize: "13px", color: "var(--text)" }}>
                    {tradeForm.side === "buy" ? "Buy" : "Sell"} {tradeForm.volume} MWh
                  </div>
                  <div style={{ fontSize: "13px", color: color, fontWeight: "600" }}>
                    = €{(parseFloat(tradeForm.volume) * parseFloat(tradeForm.price)).toFixed(2)} total
                  </div>
                </div>
              )}

              <button onClick={submitOrder} disabled={!tradeForm.volume || !tradeForm.price} style={{
                width: "100%", padding: "10px", borderRadius: "8px", border: "none",
                background: !tradeForm.volume || !tradeForm.price ? "var(--border)" : tradeForm.side === "buy" ? "#10b981" : "#ef4444",
                color: !tradeForm.volume || !tradeForm.price ? "var(--sub)" : "#fff",
                cursor: !tradeForm.volume || !tradeForm.price ? "default" : "pointer",
                fontSize: "13px", fontWeight: "600"
              }}>
                Submit {tradeForm.side === "buy" ? "Buy" : "Sell"} Order
              </button>

              <div style={{ marginTop: "16px", padding: "10px 12px", borderRadius: "7px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "10px", color: "var(--sub)", marginBottom: "4px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>Settlement</div>
                <div style={{ fontSize: "11px", color: "var(--sub)", lineHeight: 1.6 }}>
                  Instant settlement via smart contract · Delivery T+15min · Carbon certificate auto-generated
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "orderbook" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {[
            { title: "Bids (Buy Orders)", data: orderBids, color: "#10b981" },
            { title: "Asks (Sell Orders)", data: ORDER_BOOK_ASKS, color: "#ef4444" },
          ].map(({ title, data, color: c }) => (
            <div key={title} style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: c, marginBottom: "14px" }}>{title}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "8px", marginBottom: "8px" }}>
                {["Price", "Volume", "Operator", "Time"].map(h => (
                  <div key={h} style={{ fontSize: "10px", color: "var(--sub)", fontWeight: "600", textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>
              {data.map((row, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "8px", padding: "7px 0",
                  borderBottom: "1px solid var(--border)", alignItems: "center"
                }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: c }}>€{row.price}</div>
                  <div style={{ fontSize: "13px", color: "var(--text)" }}>{row.volume} MWh</div>
                  <div style={{ fontSize: "12px", color: "var(--sub)" }}>{row.tenant}</div>
                  <div style={{ fontSize: "11px", color: "var(--sub)" }}>{row.time}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "trades" && (
        <div style={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>
            Recent Settled Trades
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto", padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
            {["Buyer", "Seller", "Volume", "Price", "Time", "Status"].map(h => (
              <div key={h} style={{ fontSize: "10px", color: "var(--sub)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
            ))}
          </div>
          {trades.map((trade, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto",
              padding: "12px 20px", borderBottom: "1px solid var(--border)", alignItems: "center"
            }}>
              <div style={{ fontSize: "13px", color: "var(--text)", fontWeight: "500" }}>{trade.buyer}</div>
              <div style={{ fontSize: "13px", color: "var(--sub)" }}>{trade.seller}</div>
              <div style={{ fontSize: "13px", color: "var(--text)" }}>{trade.mwh} MWh</div>
              <div style={{ fontSize: "13px", fontWeight: "600", color }}>{typeof trade.price === "number" ? `€${trade.price}` : trade.price}</div>
              <div style={{ fontSize: "11px", color: "var(--sub)" }}>{trade.time}</div>
              <span style={{
                fontSize: "10px", padding: "2px 8px", borderRadius: "10px",
                background: trade.status === "settled" ? "#10b98118" : "#f59e0b18",
                color: trade.status === "settled" ? "#10b981" : "#f59e0b",
                fontWeight: "600"
              }}>
                {trade.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
