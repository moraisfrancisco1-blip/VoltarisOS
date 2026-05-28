import { useState } from "react"
import axios from "axios"

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login")
  const [form, setForm] = useState({
    email: "", password: "", company: "", color: "#4ade80"
  })
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    try {
      if (mode === "login") {
        const res = await axios.post("http://localhost:8000/api/auth/login", {
          email: form.email,
          password: form.password
        })
        localStorage.setItem("token", res.data.token)
        localStorage.setItem("company", res.data.company)
        localStorage.setItem("color", res.data.color)
        onLogin(res.data)
      } else {
        await axios.post("http://localhost:8000/api/auth/register", form)
        setMode("login")
        setError("Conta criada! Faz login.")
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Erro desconhecido")
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1a",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "#111827", padding: "40px", borderRadius: "16px",
        width: "400px", color: "white"
      }}>
        <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>⚡ VoltarisOS</h1>
        <p style={{ color: "#9ca3af", marginBottom: "32px" }}>
          {mode === "login" ? "Entra na tua conta" : "Cria a tua conta"}
        </p>

        {mode === "register" && (
          <>
            <input
              placeholder="Nome da empresa"
              value={form.company}
              onChange={e => setForm({ ...form, company: e.target.value })}
              style={inputStyle}
            />
            <div style={{ marginBottom: "16px" }}>
              <label style={{ color: "#9ca3af", fontSize: "14px" }}>Cor da marca</label>
              <input
                type="color"
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
                style={{ display: "block", marginTop: "8px", width: "60px", height: "40px", cursor: "pointer", border: "none", background: "none" }}
              />
            </div>
          </>
        )}

        <input
          placeholder="Email"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          style={inputStyle}
        />
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          style={inputStyle}
        />

        {error && <p style={{ color: "#f87171", marginBottom: "16px" }}>{error}</p>}

        <button onClick={handleSubmit} style={{
          width: "100%", padding: "14px",
          background: "#4ade80", color: "#0a0f1a",
          border: "none", borderRadius: "8px",
          fontWeight: "bold", fontSize: "16px", cursor: "pointer",
          marginBottom: "16px"
        }}>
          {mode === "login" ? "Entrar" : "Criar conta"}
        </button>

        <p style={{ color: "#9ca3af", textAlign: "center", cursor: "pointer" }}
          onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Não tens conta? Regista-te" : "Já tens conta? Login"}
        </p>
      </div>
    </div>
  )
}

const inputStyle = {
  width: "100%", padding: "12px",
  background: "#1f2937", border: "1px solid #374151",
  borderRadius: "8px", color: "white",
  marginBottom: "16px", fontSize: "16px",
  boxSizing: "border-box"
}