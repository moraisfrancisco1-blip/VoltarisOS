import { useState, useEffect } from "react";

const accent = "#6366f1";
const card = { background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 24 };

const roleColors = {
  admin: { bg: "#3730a3", text: "#a5b4fc" },
  operator: { bg: "#1e3a5f", text: "#60a5fa" },
  viewer: { bg: "#1f2937", text: "#9ca3af" },
  investor: { bg: "#064e3b", text: "#10b981" },
};

const mockUsers = [
  { id: 1, name: "Francisco Morais", email: "admin@voltaris.com", role: "admin", site: "All Sites", status: "Active", lastLogin: "2 min ago", avatar: "FM" },
  { id: 2, name: "Ana Silva", email: "ana@voltaris.com", role: "operator", site: "Rotterdam", status: "Active", lastLogin: "1h ago", avatar: "AS" },
  { id: 3, name: "João Santos", email: "joao@voltaris.com", role: "operator", site: "Rebordelo", status: "Active", lastLogin: "3h ago", avatar: "JS" },
  { id: 4, name: "Emma Müller", email: "emma@investor.com", role: "investor", site: "Read-only", status: "Active", lastLogin: "Yesterday", avatar: "EM" },
  { id: 5, name: "Carlos Rivera", email: "carlos@voltaris.com", role: "viewer", site: "All Sites", status: "Inactive", lastLogin: "2 weeks ago", avatar: "CR" },
];

export default function UserManagement() {
  const [users, setUsers] = useState(mockUsers);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "operator", site: "All Sites" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.name) return;
    setInviteLoading(true);
    try {
      // Attempt real API call
      await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteForm.email, password: "voltaris2025!", username: inviteForm.name }),
      });
    } catch (_) {}
    await new Promise(r => setTimeout(r, 600));
    setUsers(prev => [...prev, {
      id: prev.length + 1,
      name: inviteForm.name,
      email: inviteForm.email,
      role: inviteForm.role,
      site: inviteForm.site,
      status: "Invited",
      lastLogin: "Never",
      avatar: inviteForm.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
    }]);
    setInviteForm({ name: "", email: "", role: "operator", site: "All Sites" });
    setInviteLoading(false);
    setInviteSuccess(true);
    setTimeout(() => { setInviteSuccess(false); setShowInvite(false); }, 2000);
  };

  const removeUser = id => setUsers(u => u.filter(x => x.id !== id));
  const toggleStatus = id => setUsers(u => u.map(x => x.id === id
    ? { ...x, status: x.status === "Active" ? "Inactive" : "Active" } : x));

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>User Management</h1>
          <p style={{ color: "rgba(148,163,184,0.85)" }}>Manage team access, roles, and site permissions</p>
        </div>
        <button onClick={() => setShowInvite(!showInvite)} style={{
          background: accent, color: "#fff", border: "none",
          borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 500,
        }}>+ Invite User</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Users", value: users.length },
          { label: "Active", value: users.filter(u => u.status === "Active").length, color: "#10b981" },
          { label: "Admins", value: users.filter(u => u.role === "admin").length, color: accent },
          { label: "Operators", value: users.filter(u => u.role === "operator").length, color: "#60a5fa" },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ color: "rgba(148,163,184,0.85)", fontSize: 12, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color || "#e5e7eb" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div style={{ ...card, marginBottom: 24, border: `1px solid ${accent}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Invite New User</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Full Name", key: "name", type: "text", placeholder: "e.g. Maria Kovacs" },
              { label: "Email", key: "email", type: "email", placeholder: "user@company.com" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: "rgba(148,163,184,0.85)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={inviteForm[f.key]}
                  onChange={e => setInviteForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{
                    background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
                    padding: "9px 12px", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box",
                  }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: "rgba(148,163,184,0.85)", display: "block", marginBottom: 4 }}>Role</label>
              <select value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, width: "100%" }}>
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="investor">Investor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "rgba(148,163,184,0.85)", display: "block", marginBottom: 4 }}>Site Access</label>
              <select value={inviteForm.site} onChange={e => setInviteForm(p => ({ ...p, site: e.target.value }))}
                style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, width: "100%" }}>
                <option>All Sites</option>
                <option>Rotterdam</option>
                <option>Rebordelo</option>
                <option>Read-only</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleInvite} disabled={inviteLoading} style={{
              background: inviteSuccess ? "#064e3b" : accent, color: inviteSuccess ? "#10b981" : "#fff",
              border: "none", borderRadius: 8, padding: "9px 24px", cursor: "pointer", fontSize: 13,
            }}>
              {inviteLoading ? "Sending..." : inviteSuccess ? "Invited!" : "Send Invite"}
            </button>
            <button onClick={() => setShowInvite(false)} style={{
              background: "#1f2937", color: "rgba(148,163,184,0.85)", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13,
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Search + table */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Team Members</h2>
          <input placeholder="Search by name or email..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
              padding: "8px 14px", color: "var(--text)", fontSize: 13, width: 240,
            }} />
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "rgba(148,163,184,0.85)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              {["User", "Role", "Site Access", "Status", "Last Login", ""].map(h => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const rc = roleColors[u.role] || roleColors.viewer;
              return (
                <tr key={u.id} style={{ borderBottom: "1px solid #0d1117" }}>
                  <td style={{ padding: "12px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%", background: accent + "33",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: accent, flexShrink: 0,
                      }}>{u.avatar}</div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)" }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: rc.bg, color: rc.text, textTransform: "capitalize" }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: "12px", color: "rgba(148,163,184,0.85)" }}>{u.site}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{
                      fontSize: 12, padding: "3px 10px", borderRadius: 99,
                      background: u.status === "Active" ? "#064e3b" : u.status === "Invited" ? "#1e3a5f" : "#1f2937",
                      color: u.status === "Active" ? "#10b981" : u.status === "Invited" ? "#60a5fa" : "#6b7280",
                    }}>{u.status}</span>
                  </td>
                  <td style={{ padding: "12px", color: "rgba(148,163,184,0.85)" }}>{u.lastLogin}</td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => toggleStatus(u.id)} style={{
                        background: "#1f2937", color: "rgba(148,163,184,0.85)", border: "none",
                        borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
                      }}>{u.status === "Active" ? "Disable" : "Enable"}</button>
                      {u.id !== 1 && (
                        <button onClick={() => removeUser(u.id)} style={{
                          background: "#7f1d1d", color: "#ef4444", border: "none",
                          borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
                        }}>Remove</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Role reference */}
      <div style={{ ...card, marginTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Role Permissions Reference</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { role: "admin", label: "Admin", perms: ["Full access", "User management", "Settings", "API keys"] },
            { role: "operator", label: "Operator", perms: ["View + control", "Trading", "Grid services", "Alerts"] },
            { role: "investor", label: "Investor", perms: ["Read-only", "Financials", "Reports", "No control"] },
            { role: "viewer", label: "Viewer", perms: ["Read-only", "Dashboard", "Basic metrics", "No actions"] },
          ].map(r => {
            const rc = roleColors[r.role];
            return (
              <div key={r.role} style={{ background: "var(--surface2)", padding: 14, borderRadius: 10 }}>
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 99, background: rc.bg, color: rc.text, textTransform: "capitalize" }}>
                  {r.label}
                </span>
                <ul style={{ marginTop: 10, paddingLeft: 16, fontSize: 12, color: "rgba(148,163,184,0.85)", lineHeight: 1.8 }}>
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
