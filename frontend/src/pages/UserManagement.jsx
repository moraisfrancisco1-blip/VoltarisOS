import { useState, useEffect } from "react";
import axios from "axios";

const accent = "#6366f1";
const card = { background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 24 };

const roleColors = {
  superadmin: { bg: "#3730a3", text: "#a5b4fc" },
  admin: { bg: "#3730a3", text: "#a5b4fc" },
  operator: { bg: "#1e3a5f", text: "#60a5fa" },
<<<<<<< HEAD
  viewer: { bg: "#1f2937", text: "var(--sub)" },
=======
  viewer: { bg: "#1f2937", text: "#9ca3af" },
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
  investor: { bg: "#064e3b", text: "#10b981" },
};

function timeAgo(iso) {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Agora mesmo";
  if (mins < 60) return `${mins} min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  return `${days}d atrás`;
}

function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", password: "", role: "operator" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [search, setSearch] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await axios.get("/api/auth/users");
      setUsers(res.data || []);
    } catch (e) {
      if (e.response?.status === 403) {
        setErrorMsg("Só administradores podem ver a lista de utilizadores.");
      } else {
        setErrorMsg("Não foi possível carregar os utilizadores.");
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(u =>
    (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.name || !inviteForm.password) return;
    setInviteLoading(true);
    setInviteError("");
    try {
      await axios.post("/api/auth/invite", {
        email: inviteForm.email,
        password: inviteForm.password,
        name: inviteForm.name,
        role: inviteForm.role,
      });
      setInviteForm({ name: "", email: "", password: "", role: "operator" });
      setInviteSuccess(true);
      await loadUsers();
      setTimeout(() => { setInviteSuccess(false); setShowInvite(false); }, 1600);
    } catch (e) {
      setInviteError(e.response?.data?.detail || "Erro ao convidar utilizador");
    } finally {
      setInviteLoading(false);
    }
  };

  const removeUser = async (id) => {
    if (!window.confirm("Remover este utilizador definitivamente?")) return;
    try {
      await axios.delete(`/api/auth/users/${id}`);
      setUsers(u => u.filter(x => x.id !== id));
    } catch (e) {
      alert(e.response?.data?.detail || "Erro ao remover utilizador");
    }
  };

  const toggleStatus = async (id) => {
    try {
      const res = await axios.patch(`/api/auth/users/${id}/toggle-active`);
      setUsers(u => u.map(x => x.id === id ? { ...x, active: res.data.active } : x));
    } catch (e) {
      alert(e.response?.data?.detail || "Erro ao alterar estado");
    }
  };

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Gestão de Utilizadores</h1>
<<<<<<< HEAD
          <p style={{ color: "var(--sub)" }}>Equipa real ligada à base de dados — sem dados de exemplo.</p>
=======
          <p style={{ color: "rgba(148,163,184,0.85)" }}>Equipa real ligada à base de dados — sem dados de exemplo.</p>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
        </div>
        <button onClick={() => { setShowInvite(!showInvite); setInviteError(""); }} style={{
          background: accent, color: "#fff", border: "none",
          borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 500,
        }}>+ Convidar Utilizador</button>
      </div>

      {errorMsg && (
        <div style={{ ...card, marginBottom: 20, border: "1px solid #7f1d1d", color: "#f87171" }}>{errorMsg}</div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total de Utilizadores", value: users.length },
          { label: "Ativos", value: users.filter(u => u.active).length, color: "#10b981" },
          { label: "Admins", value: users.filter(u => u.role === "admin" || u.role === "superadmin").length, color: accent },
          { label: "Operadores", value: users.filter(u => u.role === "operator").length, color: "#60a5fa" },
        ].map(k => (
          <div key={k.label} style={card}>
<<<<<<< HEAD
            <div style={{ color: "var(--sub)", fontSize: 12, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color || "var(--text)" }}>{k.value}</div>
=======
            <div style={{ color: "rgba(148,163,184,0.85)", fontSize: 12, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color || "#e5e7eb" }}>{k.value}</div>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
          </div>
        ))}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div style={{ ...card, marginBottom: 24, border: `1px solid ${accent}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Convidar Novo Utilizador</h2>
<<<<<<< HEAD
          <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 16 }}>
=======
          <p style={{ fontSize: 12, color: "rgba(148,163,184,0.7)", marginBottom: 16 }}>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
            Por segurança, o role "Admin" não pode ser atribuído aqui — apenas o superadmin original tem esse acesso.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
<<<<<<< HEAD
              <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Nome Completo</label>
=======
              <label style={{ fontSize: 12, color: "rgba(148,163,184,0.85)", display: "block", marginBottom: 4 }}>Nome Completo</label>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
              <input type="text" placeholder="ex: Maria Kovacs" value={inviteForm.name}
                onChange={e => setInviteForm(p => ({ ...p, name: e.target.value }))}
                style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
<<<<<<< HEAD
              <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Email</label>
=======
              <label style={{ fontSize: 12, color: "rgba(148,163,184,0.85)", display: "block", marginBottom: 4 }}>Email</label>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
              <input type="email" placeholder="user@empresa.com" value={inviteForm.email}
                onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
<<<<<<< HEAD
              <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Password Inicial</label>
=======
              <label style={{ fontSize: 12, color: "rgba(148,163,184,0.85)", display: "block", marginBottom: 4 }}>Password Inicial</label>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
              <input type="text" placeholder="mín. 8 caracteres" value={inviteForm.password}
                onChange={e => setInviteForm(p => ({ ...p, password: e.target.value }))}
                style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
<<<<<<< HEAD
              <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Role</label>
=======
              <label style={{ fontSize: 12, color: "rgba(148,163,184,0.85)", display: "block", marginBottom: 4 }}>Role</label>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
              <select value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, width: "100%" }}>
                <option value="operator">Operator</option>
                <option value="investor">Investor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          {inviteError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{inviteError}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleInvite} disabled={inviteLoading} style={{
              background: inviteSuccess ? "#064e3b" : accent, color: inviteSuccess ? "#10b981" : "#fff",
              border: "none", borderRadius: 8, padding: "9px 24px", cursor: "pointer", fontSize: 13,
            }}>
              {inviteLoading ? "A enviar..." : inviteSuccess ? "Convidado!" : "Enviar Convite"}
            </button>
            <button onClick={() => setShowInvite(false)} style={{
<<<<<<< HEAD
              background: "#1f2937", color: "var(--sub)", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13,
=======
              background: "#1f2937", color: "rgba(148,163,184,0.85)", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13,
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
            }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Search + table */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Membros da Equipa</h2>
          <input placeholder="Procurar por nome ou email..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
              padding: "8px 14px", color: "var(--text)", fontSize: 13, width: 240,
            }} />
        </div>

        {loading ? (
<<<<<<< HEAD
          <div style={{ padding: 24, textAlign: "center", color: "var(--sub)" }}>A carregar...</div>
        ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--sub)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
=======
          <div style={{ padding: 24, textAlign: "center", color: "rgba(148,163,184,0.7)" }}>A carregar...</div>
        ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "rgba(148,163,184,0.85)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
              {["Utilizador", "Role", "Estado", "Último Login", ""].map(h => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const rc = roleColors[u.role] || roleColors.viewer;
              const isSuperadmin = u.role === "superadmin";
              return (
                <tr key={u.id} style={{ borderBottom: "1px solid #0d1117" }}>
                  <td style={{ padding: "12px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%", background: accent + "33",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: accent, flexShrink: 0,
                      }}>{initials(u.name, u.email)}</div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.name || "—"}</div>
<<<<<<< HEAD
                        <div style={{ fontSize: 11, color: "var(--sub)" }}>{u.email}</div>
=======
                        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)" }}>{u.email}</div>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: rc.bg, color: rc.text, textTransform: "capitalize" }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{
                      fontSize: 12, padding: "3px 10px", borderRadius: 99,
                      background: u.active ? "#064e3b" : "#1f2937",
<<<<<<< HEAD
                      color: u.active ? "#10b981" : "var(--sub)",
                    }}>{u.active ? "Ativo" : "Inativo"}</span>
                  </td>
                  <td style={{ padding: "12px", color: "var(--sub)" }}>{timeAgo(u.last_login)}</td>
                  <td style={{ padding: "12px" }}>
                    {isSuperadmin ? (
                      <span style={{ fontSize: 11, color: "var(--sub)" }}>Conta protegida</span>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => toggleStatus(u.id)} style={{
                          background: "#1f2937", color: "var(--sub)", border: "none",
=======
                      color: u.active ? "#10b981" : "#6b7280",
                    }}>{u.active ? "Ativo" : "Inativo"}</span>
                  </td>
                  <td style={{ padding: "12px", color: "rgba(148,163,184,0.85)" }}>{timeAgo(u.last_login)}</td>
                  <td style={{ padding: "12px" }}>
                    {isSuperadmin ? (
                      <span style={{ fontSize: 11, color: "rgba(148,163,184,0.5)" }}>Conta protegida</span>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => toggleStatus(u.id)} style={{
                          background: "#1f2937", color: "rgba(148,163,184,0.85)", border: "none",
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
                          borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
                        }}>{u.active ? "Desativar" : "Ativar"}</button>
                        <button onClick={() => removeUser(u.id)} style={{
                          background: "#7f1d1d", color: "#ef4444", border: "none",
                          borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
                        }}>Remover</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !loading && (
<<<<<<< HEAD
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--sub)" }}>Nenhum utilizador encontrado</td></tr>
=======
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "rgba(148,163,184,0.6)" }}>Nenhum utilizador encontrado</td></tr>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
            )}
          </tbody>
        </table>
        )}
      </div>

      {/* Role reference */}
      <div style={{ ...card, marginTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Referência de Permissões</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { role: "superadmin", label: "Superadmin", perms: ["Acesso total", "Único, não atribuível", "Gestão de utilizadores", "Toda a configuração"] },
            { role: "operator", label: "Operator", perms: ["Ver + controlar", "Trading", "Serviços de rede", "Alertas"] },
            { role: "investor", label: "Investor", perms: ["Só leitura", "Financeiro", "Relatórios", "Sem controlo"] },
            { role: "viewer", label: "Viewer", perms: ["Só leitura", "Dashboard", "Métricas básicas", "Sem ações"] },
          ].map(r => {
            const rc = roleColors[r.role];
            return (
              <div key={r.role} style={{ background: "var(--surface2)", padding: 14, borderRadius: 10 }}>
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 99, background: rc.bg, color: rc.text, textTransform: "capitalize" }}>
                  {r.label}
                </span>
<<<<<<< HEAD
                <ul style={{ marginTop: 10, paddingLeft: 16, fontSize: 12, color: "var(--sub)", lineHeight: 1.8 }}>
=======
                <ul style={{ marginTop: 10, paddingLeft: 16, fontSize: 12, color: "rgba(148,163,184,0.85)", lineHeight: 1.8 }}>
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
                  {r.perms.map(p => <li key={p}>{p}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
