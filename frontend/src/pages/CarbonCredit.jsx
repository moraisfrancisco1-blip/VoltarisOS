import { useState, useEffect } from "react"
import { useAppStore } from "../store/appStore"

const LEDGER_ENTRIES = [
  { id: "CC-2024-001842", site: "Lisboa Norte BESS", kwh: 4200, credits: 1.26, date: "2024-06-04", status: "minted", txHash: "0xa3f2...9e1b" },
  { id: "CC-2024-001841", site: "Madrid Sur Grid", kwh: 8750, credits: 2.63, date: "2024-06-04", status: "minted", txHash: "0xb71c...4d2a" },
  { id: "CC-2024-001840", site: "Amsterdam AMS-1", kwh: 6300, credits: 1.89, date: "2024-06-03", status: "minted", txHash: "0xc49e...7f3c" },
  { id: "CC-2024-001839", site: "Porto Industrial", kwh: 3100, credits: 0.93, date: "2024-06-03", status: "retired", txHash: "0xd82a...1e5f" },
  { id: "CC-2024-001838", site: "Berlin Mitte", kwh: 2800, credits: 0.84, date: "2024-06-02", status: "sold", txHash: "0xe15b...8a2d" },
  { id: "CC-2024-001837", site: "Lyon Renewables", kwh: 1950, credits: 0.59, date: "2024-06-02", status: "minted", txHash: "0xf26c...3b9e" },
  { id: "CC-2024-001836", site: "Lisboa Norte BESS", kwh: 5100, credits: 1.53, date: "2024-06-01", status: "sold", txHash: "0xa87d...6c4f" },
  { id: "CC-2024-001835", site: "Madrid Sur Grid", kwh: 9200, credits: 2.76, date: "2024-06-01", status: "retired", txHash: "0xb94e...2d7a" },
]

const SITE_TOTALS = [
  { site: "Lisboa Norte BESS", totalCredits: 24.6, totalKWh: 82000, ytdRevenue: 2214, trend: +8.4 },
  { site: "Madrid Sur Grid", kwh: 134000, totalCredits: 40.2, totalKWh: 134000, ytdRevenue: 3618, trend: +12.1 },
  { site: "Amsterdam AMS-1", totalCredits: 31.5, totalKWh: 105000, ytdRevenue: 2835, trend: +6.7 },
  { site: "Porto Industrial", totalCredits: 16.8, totalKWh: 56000, ytdRevenue: 1512, trend: +3.2 },
  { site: "Berlin Mitte", totalCredits: 12.3, totalKWh: 41000, ytdRevenue: 1107, trend: -1.4 },
  { site: "Lyon Renewables", totalCredits: 8.1, totalKWh: 27000, ytdRevenue: 729, trend: +5.8 },
]

const MONTHLY_DATA = [
  { month: "Jan", minted: 18.2, sold: 12.1, retired: 3.4 },
  { month: "Feb", minted: 21.5, sold: 15.3, retired: 4.2 },
  { month: "Mar", minted: 24.8, sold: 18.7, retired: 5.1 },
  { month: "Apr", minted: 22.1, sold: 16.2, retired: 4.8 },
  { month: "May", minted: 28.4, sold: 21.5, retired: 6.2 },
  { month: "Jun", minted: 11.4, sold: 8.1, retired: 2.3 },
]

const ETS_PRICE = 61.40 // EUR/tCO2

function ChartBar({ data, maxVal, color }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "80px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
          <div style={{
            width: "100%", borderRadius: "3px 3px 0 0",
            height: `${(d.val / maxVal) * 70}px`,
            background: d.color || color, opacity: 0.85, transition: "height 0.5s ease"
          }} />
          <div style={{ fontSize: "9px", color: "var(--sub)", whiteSpace: "nowrap" }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function CarbonCredit() {
  const { color } = useAppStore()
  const [tab, setTab] = useState("overview")
  const [mintingLive, setMintingLive] = useState(false)
  const [liveCredits, setLiveCredits] = useState(133.5)
  const [liveKwh, setLiveKwh] = useState(445000)
  const [etsPrice, setEtsPrice] = useState(ETS_PRICE)
  const [selectedStatus, setSelectedStatus] = useState("all")

  useEffect(() => {
    const id = setInterval(() => {
      setLiveCredits(prev => +(prev + Math.random() * 0.003).toFixed(3))
      setLiveKwh(prev => prev + Math.floor(Math.random() * 12))
      setEtsPrice(prev => +(prev + (Math.random() - 0.5) * 0.15).toFixed(2))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  function handleMint() {
    setMintingLive(true)
    setTimeout(() => {
      setMintingLive(false)
      setLiveCredits(prev => +(prev + 0.42).toFixed(3))
    }, 2500)
  }

  const totalRevenue = SITE_TOTALS.reduce((a, s) => a + s.ytdRevenue, 0)
  const filteredLedger = selectedStatus === "all" ? LEDGER_ENTRIES : LEDGER_ENTRIES.filter(e => e.status === selectedStatus)

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text)", margin: 0 }}>Carbon Credit Ledger</h1>
            <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "12px", background: "#10b98118", color: "#10b981", fontWeight: "700", letterSpacing: "1px" }}>EU ETS COMPLIANT</span>
            <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "12px", background: `${color}18`, color, fontWeight: "700", letterSpacing: "1px" }}>LIVE MINTING</span>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--sub)" }}>
            Real-time carbon credit minting per kWh discharged. Tokenized ERC-20 ledger, exportable for EU ETS compliance.
          </p>
        </div>
        <button onClick={handleMint} disabled={mintingLive} style={{
          padding: "9px 20px", borderRadius: "8px", border: "none",
          background: mintingLive ? "var(--border)" : "#10b981",
          color: mintingLive ? "var(--sub)" : "#fff",
          cursor: mintingLive ? "default" : "pointer", fontSize: "13px", fontWeight: "600",
          display: "flex", alignItems: "center", gap: "8px"
        }}>
          {mintingLive ? (
            <><span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: "14px" }}>⟳</span> Minting...</>
          ) : (
            <>⬡ Mint Credits</>
          )}
        </button>
      </div>

      {/* Live stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Total Credits Minted", value: liveCredits.toFixed(2), unit: " tCO₂", color: "#10b981" },
          { label: "Total kWh Discharged", value: (liveKwh / 1000).toFixed(1), unit: " MWh", color },
          { label: "EU ETS Price", value: `€${etsPrice.toFixed(2)}`, unit: "/tCO₂", color: "#f59e0b" },
          { label: "Portfolio Value", value: `€${(liveCredits * etsPrice).toFixed(0)}`, unit: "", color: "#10b981" },
          { label: "YTD Revenue", value: `€${totalRevenue.toLocaleString()}`, unit: "", color },
          { label: "Credits Retired", value: "18.4", unit: " tCO₂", color: "var(--sub)" },
        ].map(stat => (
          <div key={stat.label} style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
            <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "6px" }}>{stat.label}</div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: stat.color }}>
              {stat.value}<span style={{ fontSize: "12px", fontWeight: "400", color: "var(--sub)" }}>{stat.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", background: "var(--surface2)", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
        {["overview", "ledger", "compliance"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 18px", borderRadius: "7px", border: "none",
            background: tab === t ? color : "transparent",
            color: tab === t ? "#fff" : "var(--sub)",
            cursor: "pointer", fontSize: "12px", fontWeight: tab === t ? "600" : "400",
            textTransform: "capitalize"
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Monthly chart */}
          <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "14px" }}>Monthly Minting Activity (tCO₂)</div>
            <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "90px", marginBottom: "4px" }}>
              {MONTHLY_DATA.map((m, i) => {
                const maxV = 30
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1px", alignItems: "center" }}>
                      <div title={`Minted: ${m.minted}`} style={{ width: "60%", height: `${(m.minted / maxV) * 75}px`, background: "#10b981", borderRadius: "2px 2px 0 0", opacity: 0.9 }} />
                    </div>
                    <div style={{ fontSize: "9px", color: "var(--sub)" }}>{m.month}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              {[["#10b981", "Minted"], ["#f59e0b", "Sold"], ["#64748b", "Retired"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: c }} />
                  <span style={{ fontSize: "11px", color: "var(--sub)" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-site breakdown */}
          <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "14px" }}>Per-Site Credits</div>
            {SITE_TOTALS.map(site => (
              <div key={site.site} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "12px", color: "var(--sub)" }}>{site.site}</span>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: site.trend > 0 ? "#10b981" : "#ef4444" }}>
                      {site.trend > 0 ? "+" : ""}{site.trend}%
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)" }}>{site.totalCredits} tCO₂</span>
                  </div>
                </div>
                <div style={{ height: "5px", borderRadius: "3px", background: "var(--border)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: "3px",
                    width: `${(site.totalCredits / 45) * 100}%`,
                    background: "#10b981", transition: "width 0.8s ease"
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Emission factor explainer */}
          <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "12px" }}>Minting Formula</div>
            <div style={{ fontFamily: "monospace", fontSize: "12px", padding: "12px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)", lineHeight: 1.8 }}>
              <span style={{ color: "#10b981" }}>credits</span> = kWh_discharged × grid_emission_factor ÷ 1000<br />
              <span style={{ color: "var(--sub)" }}>// grid_emission_factor = 0.3 kgCO₂/kWh (EU avg)</span><br />
              <span style={{ color: "var(--sub)" }}>// 1 credit = 1 tCO₂ = 3,333 kWh avoided<br /></span>
              <span style={{ color: color }}>current_rate</span>: {(liveKwh * 0.3 / 1000000).toFixed(4)} tCO₂/s<br />
            </div>
          </div>

          {/* ETS compliance status */}
          <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "12px" }}>EU ETS Compliance</div>
            {[
              { label: "Verification standard", value: "GS4GG / Verra VCS", ok: true },
              { label: "Reporting period", value: "Jan – Dec 2024", ok: true },
              { label: "Auditor", value: "Bureau Veritas", ok: true },
              { label: "Registry", value: "EU ETS / Gold Standard", ok: true },
              { label: "Next submission", value: "31 Aug 2024", ok: false },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "12px", color: "var(--sub)" }}>{item.label}</span>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--text)" }}>{item.value}</span>
                  <span style={{ fontSize: "12px" }}>{item.ok ? "✓" : "⏳"}</span>
                </div>
              </div>
            ))}
            <button style={{
              marginTop: "12px", width: "100%", padding: "8px", borderRadius: "7px",
              border: `1px solid ${color}40`, background: `${color}10`, color, cursor: "pointer", fontSize: "12px", fontWeight: "600"
            }}>
              Export Compliance Report (PDF)
            </button>
          </div>
        </div>
      )}

      {tab === "ledger" && (
        <div style={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", flex: 1 }}>Credit Ledger (Blockchain)</div>
            {["all", "minted", "sold", "retired"].map(s => (
              <button key={s} onClick={() => setSelectedStatus(s)} style={{
                padding: "4px 12px", borderRadius: "20px", border: "none",
                background: selectedStatus === s ? color : "var(--surface)",
                color: selectedStatus === s ? "#fff" : "var(--sub)",
                cursor: "pointer", fontSize: "11px", fontWeight: selectedStatus === s ? "600" : "400",
                textTransform: "capitalize"
              }}>{s}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr 0.8fr 0.8fr auto", padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
            {["Credit ID", "Site", "kWh", "tCO₂", "Date", "Status"].map(h => (
              <div key={h} style={{ fontSize: "10px", color: "var(--sub)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
            ))}
          </div>
          {filteredLedger.map((entry, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr 0.8fr 0.8fr auto",
              padding: "11px 20px", borderBottom: "1px solid var(--border)", alignItems: "center"
            }}>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color }}>
                <a href={`https://etherscan.io/tx/${entry.txHash}`} target="_blank" rel="noreferrer"
                  style={{ color, textDecoration: "none" }} title={`TX: ${entry.txHash}`}>
                  {entry.id}
                </a>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text)" }}>{entry.site}</div>
              <div style={{ fontSize: "12px", color: "var(--sub)" }}>{entry.kwh.toLocaleString()}</div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#10b981" }}>{entry.credits}</div>
              <div style={{ fontSize: "11px", color: "var(--sub)" }}>{entry.date}</div>
              <span style={{
                fontSize: "10px", padding: "2px 8px", borderRadius: "10px",
                background: entry.status === "minted" ? `${color}18` : entry.status === "sold" ? "#f59e0b18" : "#64748b18",
                color: entry.status === "minted" ? color : entry.status === "sold" ? "#f59e0b" : "var(--sub)",
                fontWeight: "600", textTransform: "uppercase"
              }}>
                {entry.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "compliance" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "16px" }}>Export for EU ETS</div>
            {[
              { format: "PDF Certificate Bundle", desc: "One cert per minted credit, Bureau Veritas template", icon: "📄" },
              { format: "CSV Ledger Export", desc: "Full transaction history, Verra-compatible format", icon: "📊" },
              { format: "XML Registry Upload", desc: "Direct upload to EU Registry portal", icon: "📡" },
              { format: "JSON API Feed", desc: "Real-time feed for third-party MRV systems", icon: "⚙️" },
            ].map(item => (
              <div key={item.format} style={{
                display: "flex", gap: "12px", alignItems: "center",
                padding: "12px", borderRadius: "8px", background: "var(--surface)",
                border: "1px solid var(--border)", marginBottom: "8px", cursor: "pointer"
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = color}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>{item.format}</div>
                  <div style={{ fontSize: "11px", color: "var(--sub)" }}>{item.desc}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sub)" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
            ))}
          </div>

          <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "16px" }}>Certification Timeline</div>
            {[
              { date: "2024-01-15", event: "Project Registration (Gold Standard)", done: true },
              { date: "2024-02-01", event: "First MRV period opens", done: true },
              { date: "2024-03-10", event: "Bureau Veritas site audit", done: true },
              { date: "2024-05-20", event: "Q1 credits issued (18.2 tCO₂)", done: true },
              { date: "2024-08-31", event: "Mid-year compliance report due", done: false },
              { date: "2024-12-31", event: "Annual registry submission", done: false },
            ].map((ev, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "flex-start" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: ev.done ? "#10b981" : "var(--border)", flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <div style={{ fontSize: "12px", color: ev.done ? "var(--text)" : "var(--sub)", fontWeight: ev.done ? "500" : "400" }}>{ev.event}</div>
                  <div style={{ fontSize: "11px", color: "var(--sub)" }}>{ev.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
