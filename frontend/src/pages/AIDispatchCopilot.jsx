import { useState, useRef, useEffect } from "react"
import { useAppStore } from "../store/appStore"

const API = import.meta.env.VITE_API_URL || ""

const SUGGESTIONS = [
  "Dispatch 2 MW from Lisboa Norte for 3 hours at max €85/MWh",
  "Charge all sites to 80% SOC before 18:00 tonight",
  "Activate FCR reserve on Madrid Sur, 1.5 MW for 1 hour",
  "What is the current SOC of Amsterdam AMS-1?",
  "Optimize revenue across all sites for tomorrow 14:00–20:00",
  "Schedule maintenance window for Porto Industrial this Sunday",
]

const MOCK_SITES = [
  { id: 1, name: "Lisboa Norte BESS", soc: 67, mw: 12, status: "idle" },
  { id: 2, name: "Porto Industrial", soc: 82, mw: 8, status: "charging" },
  { id: 3, name: "Madrid Sur Grid", soc: 45, mw: 20, status: "discharging" },
  { id: 4, name: "Amsterdam AMS-1", soc: 91, mw: 15, status: "idle" },
  { id: 5, name: "Berlin Mitte", soc: 38, mw: 10, status: "idle" },
]

function parseCommand(text) {
  const t = text.toLowerCase()
  if (t.includes("dispatch") || t.includes("discharge")) {
    const mwMatch = text.match(/(\d+(?:\.\d+)?)\s*mw/i)
    const hourMatch = text.match(/(\d+)\s*hour/i)
    const priceMatch = text.match(/€?(\d+(?:\.\d+)?)\s*\/\s*mwh/i)
    const siteMatch = MOCK_SITES.find(s => t.includes(s.name.toLowerCase().split(" ")[0]) || t.includes(s.name.toLowerCase().split(" ")[1]))
    return {
      type: "dispatch",
      site: siteMatch?.name || "Lisboa Norte BESS",
      mw: mwMatch ? parseFloat(mwMatch[1]) : 2,
      hours: hourMatch ? parseInt(hourMatch[1]) : 1,
      maxPrice: priceMatch ? parseFloat(priceMatch[1]) : 90,
    }
  }
  if (t.includes("charge") && t.includes("soc")) {
    const socMatch = text.match(/(\d+)%/)
    const timeMatch = text.match(/(\d{1,2}:\d{2})/)
    return { type: "charge", targetSOC: socMatch ? parseInt(socMatch[1]) : 80, before: timeMatch?.[0] || "18:00" }
  }
  if (t.includes("fcr") || t.includes("reserve")) {
    const mwMatch = text.match(/(\d+(?:\.\d+)?)\s*mw/i)
    const siteMatch = MOCK_SITES.find(s => t.includes(s.name.toLowerCase().split(" ")[0]))
    return { type: "fcr", site: siteMatch?.name || "Madrid Sur Grid", mw: mwMatch ? parseFloat(mwMatch[1]) : 1 }
  }
  if (t.includes("soc") || t.includes("status")) {
    const siteMatch = MOCK_SITES.find(s => t.includes(s.name.toLowerCase().split(" ")[0]) || t.includes(s.name.toLowerCase().split(" ")[1]))
    return { type: "query", site: siteMatch }
  }
  if (t.includes("optimiz") || t.includes("revenue")) {
    return { type: "optimize" }
  }
  if (t.includes("maintenance")) {
    return { type: "maintenance" }
  }
  return { type: "unknown" }
}

function buildResponse(parsed, text) {
  switch (parsed.type) {
    case "dispatch":
      return {
        summary: `Dispatch ${parsed.mw} MW from **${parsed.site}** for ${parsed.hours}h at max **€${parsed.maxPrice}/MWh**`,
        details: [
          `Site: ${parsed.site}`,
          `Power: ${parsed.mw} MW discharge`,
          `Duration: ${parsed.hours} hour(s)`,
          `Price cap: €${parsed.maxPrice}/MWh`,
          `Estimated revenue: €${(parsed.mw * parsed.hours * parsed.maxPrice * 0.82).toFixed(0)}`,
          `SOC impact: -${Math.round(parsed.mw * parsed.hours / 0.48 * 100) / 100}%`,
        ],
        confirmation: true,
        type: "dispatch",
        risk: parsed.mw > 10 ? "high" : parsed.mw > 5 ? "medium" : "low",
      }
    case "charge":
      return {
        summary: `Charge all ${MOCK_SITES.length} sites to **${parsed.targetSOC}% SOC** before **${parsed.before}**`,
        details: [
          `Target: ${parsed.targetSOC}% SOC across all sites`,
          `Deadline: ${parsed.before} today`,
          `Sites below target: ${MOCK_SITES.filter(s => s.soc < parsed.targetSOC).length}`,
          `Estimated cost at €62/MWh average: €${Math.round(MOCK_SITES.filter(s => s.soc < parsed.targetSOC).reduce((a, s) => a + (parsed.targetSOC - s.soc) * s.mw * 4 / 100, 0) * 62).toLocaleString()}`,
        ],
        confirmation: true,
        type: "charge",
        risk: "low",
      }
    case "fcr":
      return {
        summary: `Activate **FCR reserve** on ${parsed.site}: ${parsed.mw} MW`,
        details: [
          `Site: ${parsed.site}`,
          `Reserve: ${parsed.mw} MW`,
          `Mode: Frequency Containment Reserve (FCR)`,
          `Activation trigger: ±0.2 Hz grid deviation`,
          `Est. FCR revenue: €${(parsed.mw * 18.5).toFixed(0)}/h`,
        ],
        confirmation: true,
        type: "fcr",
        risk: "low",
      }
    case "query":
      if (parsed.site) {
        return {
          summary: `Status for **${parsed.site.name}**`,
          details: [
            `SOC: ${parsed.site.soc}%`,
            `Capacity: ${parsed.site.mw} MW`,
            `Status: ${parsed.site.status}`,
            `Temperature: 28.4°C`,
            `Last sync: 14 seconds ago`,
          ],
          confirmation: false,
          type: "info",
        }
      }
      return {
        summary: "Fleet status overview",
        details: MOCK_SITES.map(s => `${s.name}: ${s.soc}% SOC · ${s.status}`),
        confirmation: false,
        type: "info",
      }
    case "optimize":
      return {
        summary: "Revenue optimization plan generated for tomorrow 14:00–20:00",
        details: [
          "Peak window: 16:00–19:00 (price forecast €95–112/MWh)",
          "Recommended: Charge all sites 07:00–13:00 at ~€55/MWh",
          "Dispatch Lisboa Norte 12 MW + Madrid Sur 20 MW at peak",
          "Hold Porto Industrial as FCR reserve",
          "Est. gross revenue: €18,440",
          "Est. net margin: €11,200 (61%)",
        ],
        confirmation: true,
        type: "optimize",
        risk: "medium",
      }
    case "maintenance":
      return {
        summary: "Maintenance window scheduled for **Porto Industrial** — Sunday 02:00–06:00",
        details: [
          "Site: Porto Industrial",
          "Window: Sunday 02:00–06:00 CEST",
          "Tasks: BMS calibration, inverter firmware v3.4.1",
          "Impact: 8 MWh capacity offline",
          "Notification: sent to site manager + NOC",
        ],
        confirmation: true,
        type: "maintenance",
        risk: "low",
      }
    default:
      return {
        summary: "I can help with dispatch, charging schedules, FCR activation, site status queries, and revenue optimization.",
        details: [
          "Try: 'Dispatch 2 MW from Lisboa Norte for 3h at €85/MWh'",
          "Try: 'Charge all sites to 80% before 18:00'",
          "Try: 'What is the SOC of Amsterdam AMS-1?'",
        ],
        confirmation: false,
        type: "help",
      }
  }
}

function riskBadge(risk) {
  const map = { low: ["#10b981", "LOW RISK"], medium: ["#f59e0b", "MEDIUM RISK"], high: ["#ef4444", "HIGH RISK"] }
  if (!risk || !map[risk]) return null
  const [c, label] = map[risk]
  return <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "10px", background: `${c}18`, color: c, fontWeight: "700", letterSpacing: "1px" }}>{label}</span>
}

export default function AIDispatchCopilot() {
  const { color } = useAppStore()
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "I'm your Dispatch Copilot. Tell me what to do in plain language — dispatch, charge, activate reserves, or query site status. I'll confirm before executing anything.",
      type: "intro",
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [executedCount, setExecutedCount] = useState(0)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function send(text) {
    if (!text.trim()) return
    setInput("")
    setLoading(true)
    setMessages(prev => [...prev, { role: "user", text }])

    setTimeout(() => {
      const parsed = parseCommand(text)
      const response = buildResponse(parsed, text)
      setMessages(prev => [...prev, { role: "assistant", ...response }])
      if (response.confirmation) setPendingAction(response)
      setLoading(false)
    }, 800)
  }

  function confirm() {
    if (!pendingAction) return
    setMessages(prev => [...prev, {
      role: "system",
      text: `✓ Command executed — ${new Date().toLocaleTimeString()}`,
      type: "success",
    }])
    setExecutedCount(c => c + 1)
    setPendingAction(null)
  }

  function cancel() {
    setMessages(prev => [...prev, { role: "system", text: "Command cancelled.", type: "cancelled" }])
    setPendingAction(null)
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ marginBottom: "16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text)", margin: 0 }}>AI Dispatch Copilot</h1>
          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "12px", background: `${color}18`, color, fontWeight: "700", letterSpacing: "1px" }}>
            NATURAL LANGUAGE → EXECUTION
          </span>
          {executedCount > 0 && (
            <span style={{ fontSize: "11px", color: "#10b981" }}>✓ {executedCount} commands executed</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--sub)" }}>
          Conversational dispatch interface. Speak naturally — the copilot parses intent, builds an execution plan, and waits for your confirmation.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: "16px", flex: 1, minHeight: 0 }}>
        {/* Chat */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 2px", marginBottom: "12px" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ marginBottom: "12px" }}>
                {msg.role === "user" && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{
                      maxWidth: "75%", padding: "10px 16px", borderRadius: "14px 14px 3px 14px",
                      background: color, color: "#fff", fontSize: "13px", lineHeight: 1.5
                    }}>
                      {msg.text}
                    </div>
                  </div>
                )}
                {msg.role === "assistant" && (
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
                      background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                      </svg>
                    </div>
                    <div style={{ maxWidth: "85%", flex: 1 }}>
                      <div style={{
                        padding: "12px 16px", borderRadius: "3px 14px 14px 14px",
                        background: "var(--surface2)", border: "1px solid var(--border)", fontSize: "13px", lineHeight: 1.6
                      }}>
                        <div style={{ marginBottom: msg.details ? "10px" : 0, display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          <span dangerouslySetInnerHTML={{ __html: (msg.summary || msg.text).replace(/\*\*(.*?)\*\*/g, `<strong style="color:var(--text)">$1</strong>`) }} />
                          {msg.risk && riskBadge(msg.risk)}
                        </div>
                        {msg.details && (
                          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                            {msg.details.map((d, di) => (
                              <div key={di} style={{ fontSize: "12px", color: "var(--sub)", marginBottom: "4px", display: "flex", gap: "8px" }}>
                                <span style={{ color: color, flexShrink: 0 }}>·</span> {d}
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.confirmation && msg === messages[messages.length - 1] && pendingAction && (
                          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                            <button onClick={confirm} style={{
                              padding: "7px 18px", borderRadius: "7px", border: "none",
                              background: "#10b981", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "600"
                            }}>
                              ✓ Execute
                            </button>
                            <button onClick={cancel} style={{
                              padding: "7px 18px", borderRadius: "7px", border: "1px solid var(--border)",
                              background: "none", color: "var(--sub)", cursor: "pointer", fontSize: "12px"
                            }}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {msg.role === "system" && (
                  <div style={{ textAlign: "center" }}>
                    <span style={{
                      fontSize: "11px", padding: "3px 12px", borderRadius: "12px",
                      background: msg.type === "success" ? "#10b98118" : "var(--surface2)",
                      color: msg.type === "success" ? "#10b981" : "var(--sub)",
                      border: `1px solid ${msg.type === "success" ? "#10b98130" : "var(--border)"}`,
                    }}>
                      {msg.text}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${color}18`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                  </svg>
                </div>
                <div style={{ padding: "12px 16px", borderRadius: "3px 14px 14px 14px", background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: "6px", height: "6px", borderRadius: "50%", background: color,
                        animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                        opacity: 0.7,
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "8px", padding: "12px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !loading && send(input)}
                placeholder="e.g. 'Dispatch 2 MW from Lisboa Norte for 3h at max €85/MWh'..."
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "var(--text)", fontSize: "13px", padding: 0
                }}
              />
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                style={{
                  padding: "7px 16px", borderRadius: "8px", border: "none",
                  background: loading || !input.trim() ? "var(--border)" : color,
                  color: loading || !input.trim() ? "var(--sub)" : "#fff",
                  cursor: loading || !input.trim() ? "default" : "pointer", fontSize: "12px", fontWeight: "600"
                }}
              >
                Send
              </button>
            </div>
            <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {SUGGESTIONS.slice(0, 3).map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{
                  padding: "4px 10px", borderRadius: "20px", border: "1px solid var(--border)",
                  background: "none", color: "var(--sub)", cursor: "pointer", fontSize: "11px",
                  transition: "all 0.1s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--sub)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fleet sidebar */}
        <div style={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)", padding: "16px", overflowY: "auto" }}>
          <div style={{ fontSize: "11px", color: "var(--sub)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>Live Fleet Status</div>
          {MOCK_SITES.map(site => (
            <div key={site.id} style={{ marginBottom: "10px", padding: "10px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)", marginBottom: "4px" }}>{site.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "var(--sub)" }}>{site.mw} MW</span>
                <span style={{
                  fontSize: "10px", padding: "1px 6px", borderRadius: "10px",
                  background: site.status === "idle" ? "var(--surface2)" : site.status === "charging" ? "#10b98118" : "#f59e0b18",
                  color: site.status === "idle" ? "var(--sub)" : site.status === "charging" ? "#10b981" : "#f59e0b",
                  fontWeight: "600",
                }}>
                  {site.status.toUpperCase()}
                </span>
              </div>
              <div style={{ height: "4px", borderRadius: "2px", background: "var(--border)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: "2px",
                  width: `${site.soc}%`,
                  background: site.soc > 70 ? "#10b981" : site.soc > 40 ? "#f59e0b" : "#ef4444",
                  transition: "width 0.5s",
                }} />
              </div>
              <div style={{ fontSize: "10px", color: "var(--sub)", marginTop: "3px" }}>{site.soc}% SOC</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0) }
          30% { transform: translateY(-6px) }
        }
      `}</style>
    </div>
  )
}
