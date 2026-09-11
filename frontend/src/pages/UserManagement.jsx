import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "../i18n/useTranslation";

const accent = "#6366f1";
const card = { background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 24 };

const roleColors = {
  superadmin: { bg: "#3730a3", text: "#a5b4fc" },
  admin: { bg: "#3730a3", text: "#a5b4fc" },
  operator: { bg: "#1e3a5f", text: "#60a5fa" },
  viewer: { bg: "#1f2937", text: "var(--sub)" },
  investor: { bg: "#064e3b", text: "#10b981" },
};

function timeAgo(iso, t) {
  if (!iso) return t("um_never");
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("um_now");
  if (mins < 60) return `${mins} ${t("um_ago_min")}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t("um_ago_h")}`;
  const days = Math.floor(hrs / 24);
  return `${days}${t("um_ago_d")}`;
}

function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function UserManagement() {
  const { t } = useTranslation();
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
        setErrorMsg(t("um_err_admin_only"));
      } else {
        setErrorMsg(t("um_err_load"));
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
      setInviteError(e.response?.data?.detail || t("um_err_invite"));
    } finally {
      setInviteLoading(false);
    }
  };

  const removeUser = async (id) => {
    if (!window.confirm(t("um_confirm_remove"))) return;
    try {
      await axios.delete(`/api/auth/users/${id}`);
      setUsers(u => u.filter(x => x.id !== id));
    } catch (e) {
      alert(e.response?.data?.detail || t("um_err_remove"));
    }
  };

  const toggleStatus = async (id) => {
    try {
      const res = await axios.patch(`/api/auth/users/${id}/toggle-active`);
      setUsers(u => u.map(x => x.id === id ? { ...x, active: res.data.active } : x));
    } catch (e) {
      alert(e.response?.data?.detail || t("um_err_toggle"));
    }
  };

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>{t("um_title")}</h1>
          <p style={{ color: "var(--sub)" }}>{t("um_sub")}</p>
        </div>
        <button onClick={() => { setShowInvite(!showInvite); setInviteError(""); }} style={{
          background: accent, color: "#fff", border: "none",
          borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 500,
        }}>{t("um_invite_btn")}</button>
      </div>

      {errorMsg && (
        <div style={{ ...card, marginBottom: 20, border: "1px solid #7f1d1d", color: "#f87171" }}>{errorMsg}</div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: t("um_stat_total"), value: users.length },
          { label: t("um_stat_active"), value: users.filter(u => u.active).length, color: "#10b981" },
          { label: t("um_stat_admins"), value: users.filter(u => u.role === "admin" || u.role === "superadmin").length, color: accent },
          { label: t("um_stat_operators"), value: users.filter(u => u.role === "operator").length, color: "#60a5fa" },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ color: "var(--sub)", fontSize: 12, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color || "var(--text)" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div style={{ ...card, marginBottom: 24, border: `1px solid ${accent}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t("um_invite_title")}</h2>
          <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 16 }}>
            {t("um_invite_note")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>{t("um_full_name")}</label>
              <input type="text" placeholder={t("um_name_ph")} value={inviteForm.name}
                onChange={e => setInviteForm(p => ({ ...p, name: e.target.value }))}
                style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Email</label>
              <input type="email" placeholder={t("um_email_ph")} value={inviteForm.email}
                onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>{t("um_initial_password")}</label>
              <input type="text" placeholder={t("um_ph_min8")} value={inviteForm.password}
                onChange={e => setInviteForm(p => ({ ...p, password: e.target.value }))}
                style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Role</label>
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
              {inviteLoading ? t("um_sending") : inviteSuccess ? t("um_invited") : t("um_send_invite")}
            </button>
            <button onClick={() => setShowInvite(false)} style={{
              background: "#1f2937", color: "var(--sub)", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13,
            }}>{t("um_cancel")}</button>
          </div>
        </div>
      )}

      {/* Search + table */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t("um_team_members")}</h2>
          <input placeholder={t("um_search_ph")} value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
              padding: "8px 14px", color: "var(--text)", fontSize: 13, width: 240,
            }} />
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--sub)" }}>{t("um_loading")}</div>
        ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--sub)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              {[t("um_col_user"), t("um_col_role"), t("um_col_status"), t("um_col_lastlogin"), ""].map(h => (
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
                        <div style={{ fontSize: 11, color: "var(--sub)" }}>{u.email}</div>
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
                      color: u.active ? "#10b981" : "var(--sub)",
                    }}>{u.active ? t("um_active") : t("um_inactive")}</span>
                  </td>
                  <td style={{ padding: "12px", color: "var(--sub)" }}>{timeAgo(u.last_login, t)}</td>
                  <td style={{ padding: "12px" }}>
                    {isSuperadmin ? (
                      <span style={{ fontSize: 11, color: "var(--sub)" }}>{t("um_protected")}</span>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => toggleStatus(u.id)} style={{
                          background: "#1f2937", color: "var(--sub)", border: "none",
                          borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
                        }}>{u.active ? t("um_deactivate") : t("um_activate")}</button>
                        <button onClick={() => removeUser(u.id)} style={{
                          background: "#7f1d1d", color: "#ef4444", border: "none",
                          borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
                        }}>{t("um_remove")}</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--sub)" }}>{t("um_empty")}</td></tr>
            )}
          </tbody>
        </table>
        )}
      </div>

      {/* Role reference */}
      <div style={{ ...card, marginTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t("um_perm_ref")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { role: "superadmin", label: "Superadmin", perms: [t("um_perm_full"), t("um_perm_unique"), t("um_perm_user_mgmt"), t("um_perm_all_config")] },
            { role: "operator", label: "Operator", perms: [t("um_perm_view_control"), t("um_perm_trading"), t("um_perm_grid"), t("um_perm_alerts")] },
            { role: "investor", label: "Investor", perms: [t("um_perm_readonly"), t("um_perm_financial"), t("um_perm_reports"), t("um_perm_no_control")] },
            { role: "viewer", label: "Viewer", perms: [t("um_perm_readonly"), t("um_perm_dashboard"), t("um_perm_basic_metrics"), t("um_perm_no_actions")] },
          ].map(r => {
            const rc = roleColors[r.role];
            return (
              <div key={r.role} style={{ background: "var(--surface2)", padding: 14, borderRadius: 10 }}>
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 99, background: rc.bg, color: rc.text, textTransform: "capitalize" }}>
                  {r.label}
                </span>
                <ul style={{ marginTop: 10, paddingLeft: 16, fontSize: 12, color: "var(--sub)", lineHeight: 1.8 }}>
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
