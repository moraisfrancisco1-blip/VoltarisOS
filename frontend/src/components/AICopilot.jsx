import { useState, useRef, useEffect } from "react"
import axios from "axios"

const SUGGESTIONS = [
  "Qual é a receita de hoje?",
  "Estado das baterias agora?",
  "Quando devo descarregar esta tarde?",
  "Quanto CO₂ evitei este mês?",
  "Há alertas de manutenção?",
]

function parseMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
}

export default function AICopilot({ user }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Olá! Sou o **VoltarisAI**, o teu copiloto de energia. Pergunta-me qualquer coisa sobre os teus sites, baterias, trading ou receita.",
      ts: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEnd = useRef()
  const inputRef = useRef()
  const color = user?.color || "#4ade80"

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg) return
    setInput("")
    const ts = new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    setMessages(m => [...m, { role: "user", text: msg, ts }])
    setLoading(true)
    try {
      const r = await axios.post("/api/copilot", { message: msg })
      setMessages(m => [...m, {
        role: "assistant",
        text: r.data.response,
        ts: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
        tokens: r.data.tokens
      }])
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "Erro de ligação ao servidor. Tenta novamente.", ts, error: true }])
    }
    setLoading(false)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          width: "54px", height: "54px", borderRadius: "50%",
          background: open ? "#1f2937" : `linear-gradient(135deg, ${color}, ${color}cc)`,
          border: open ? "1px solid #374151" : "none",
          cursor: "pointer", boxShadow: `0 4px 24px ${color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <circle cx="9" cy="10" r="1" fill="white"/><circle cx="12" cy="10" r="1" fill="white"/><circle cx="15" cy="10" r="1" fill="white"/>
          </svg>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: "fixed", bottom: "90px", right: "24px", zIndex: 9998,
          width: "380px", height: "520px",
          background: "#080d18",
          border: "1px solid #1a2234",
          borderRadius: "16px",
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          overflow: "hidden",
          animation: "slideUp 0.2s cubic-bezier(.4,0,.2,1)",
        }}>
          <style>{`
            @keyframes slideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
            @keyframes typing { 0%,80%,100%{transform:scale(1)} 40%{transform:scale(1.4)} }
            .copilot-input:focus { outline: none; border-color: ${color}66 !important; }
            .copilot-input::placeholder { color: #374151; }
          `}</style>

          {/* Header */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a2234", display: "flex", alignItems: "center", gap: "10px", background: "#0a1020", flexShrink: 0 }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `linear-gradient(135deg, ${color}44, ${color}88)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 14.93V18h-2v-1.07A8 8 0 0 1 4.07 9H6.1a6 6 0 0 0 11.8 0h2.03A8 8 0 0 1 13 16.93z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: "700", fontSize: "13px" }}>VoltarisAI</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#4ade80" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#4ade80" }} />
                Online
              </div>
            </div>
            <div style={{ marginLeft: "auto", fontSize: "10px", color: "#374151", background: "#0d1525", padding: "3px 8px", borderRadius: "6px", border: "1px solid #1a2234" }}>
              VoltarisAI-1.0
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  background: m.role === "user" ? color + "22" : "#111827",
                  border: `1px solid ${m.role === "user" ? color + "44" : "#1a2234"}`,
                  fontSize: "13px", lineHeight: "1.5",
                  color: m.error ? "#f87171" : "#e5e7eb",
                }}>
                  {m.role === "assistant"
                    ? <span dangerouslySetInnerHTML={{ __html: parseMarkdown(m.text) }} />
                    : m.text
                  }
                </div>
                <div style={{ fontSize: "9px", color: "#374151", marginTop: "3px", display: "flex", gap: "6px" }}>
                  {m.ts}
                  {m.tokens && <span>· {m.tokens} tokens</span>}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ padding: "12px 16px", background: "#111827", border: "1px solid #1a2234", borderRadius: "12px 12px 12px 4px", display: "flex", gap: "4px" }}>
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, animation: `typing 1.2s infinite ${d}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && (
            <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: "6px", flexShrink: 0 }}>
              {SUGGESTIONS.slice(0, 3).map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{
                  padding: "5px 10px", borderRadius: "20px", fontSize: "11px",
                  background: "#0d1525", border: "1px solid #1a2234",
                  color: "#6b7280", cursor: "pointer",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = color + "44"; e.currentTarget.style.color = color }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a2234"; e.currentTarget.style.color = "#6b7280" }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "12px", borderTop: "1px solid #1a2234", display: "flex", gap: "8px", flexShrink: 0, background: "#0a1020" }}>
            <input
              ref={inputRef}
              className="copilot-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Pergunta ao VoltarisAI..."
              style={{
                flex: 1, background: "#111827", border: "1px solid #1a2234",
                borderRadius: "8px", padding: "9px 12px", color: "white",
                fontSize: "13px",
              }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()} style={{
              padding: "9px 14px", borderRadius: "8px", border: "none",
              background: input.trim() ? color : "#1f2937",
              color: input.trim() ? "#000" : "#374151",
              cursor: input.trim() ? "pointer" : "default",
              fontWeight: "700", fontSize: "13px", transition: "all 0.15s",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
