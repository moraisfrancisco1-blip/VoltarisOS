import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { C, glassCard, KpiCard, PremiumTooltip, axisStyle, gridStyle } from "../ChartTheme";
import { API, RealPage, LoadingCard, ErrorCard, EmptyCard, Chip } from "./realShared";

const CATEGORIES = ["Safety", "Regulatory", "ESG", "Grid", "Market", "Environmental", "ISO"];
const RISKS = ["low", "medium", "high"];
const STATUSES = [["pending", "Pending"], ["inprogress", "In progress"], ["done", "Done"]];

const statusLabel = (s) => (STATUSES.find(([v]) => v === s) || [s, s])[1];
const statusColor = (s) => (s === "done" ? C.green : s === "inprogress" ? C.amber : C.indigo);
const riskColor = (r) => (r === "high" ? C.red : r === "medium" ? C.amber : C.green);

// Whole days from today (local) to the due date; negative when overdue.
const daysLeft = (due) => Math.ceil((new Date(`${due}T00:00:00`) - new Date()) / 86400000);

const input = {
  width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13,
};
const btn = {
  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
  background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)",
};
const primaryBtn = { ...btn, background: C.accent, color: "#0b1020", border: "none" };

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function downloadCsv(items) {
  const header = ["Title", "Authority", "Due date", "Category", "Risk", "Status", "Completed", "Notes"];
  const rows = items.map(i => [i.title, i.body, i.due_date, i.category, i.risk, statusLabel(i.status),
    i.completed_at ? i.completed_at.slice(0, 10) : "", i.notes]);
  const csv = [header, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `compliance_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const emptyForm = { title: "", body: "", due_date: "", category: "Regulatory", risk: "medium", status: "pending", notes: "" };

// The tenant's REAL compliance tracker (GET/POST/PUT/DELETE /api/compliance). The data is whatever
// the tenant's admins enter: deadlines, who they are owed to, risk and status. Shown when
// Simulation mode is off; the demo page stays as is. Only admins see the editing controls (the
// backend enforces it too).
export default function ComplianceReal({ canEdit }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null); // null | { id?: number, form }
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/api/compliance`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(data => { setItems(data); setError(null); })
      .catch(e => setError(e.message || "Failed to load"));
  }, []);
  useEffect(() => { load(); }, [load]);

  const call = async (method, path, body) => {
    setActionError(null);
    const r = await fetch(`${API}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      let detail = `HTTP ${r.status}`;
      try { const j = await r.json(); detail = typeof j.detail === "string" ? j.detail : "Invalid data"; } catch { /* keep status */ }
      throw new Error(detail);
    }
    return r.status === 204 ? null : r.json();
  };

  const run = async (fn) => {
    try { await fn(); load(); } catch (e) { setActionError(e.message); }
  };

  const title = "Regulatory Compliance";
  const subtitle = "Deadlines, certifications and reports you need to keep track of";

  if (error) return <RealPage title={title} subtitle={subtitle}><ErrorCard error={error} /></RealPage>;
  if (!items) return <RealPage title={title} subtitle={subtitle}><LoadingCard /></RealPage>;

  const open = items.filter(i => i.status !== "done");
  const done = items.length - open.length;
  const overdue = open.filter(i => daysLeft(i.due_date) < 0).length;
  const urgent = open.filter(i => daysLeft(i.due_date) <= 60).length;
  const highRisk = open.filter(i => i.risk === "high").length;
  const inprogress = items.filter(i => i.status === "inprogress").length;
  const pending = items.filter(i => i.status === "pending").length;
  const score = items.length ? Math.round((done / items.length) * 100) : null;

  const barData = [
    { name: "Done", value: done, fill: C.green },
    { name: "In progress", value: inprogress, fill: C.amber },
    { name: "Pending", value: pending, fill: C.indigo },
    { name: "Overdue", value: overdue, fill: C.red },
  ];

  const byCategory = CATEGORIES
    .map(c => {
      const all = items.filter(i => i.category === c);
      return { c, total: all.length, done: all.filter(i => i.status === "done").length };
    })
    .filter(x => x.total > 0);

  const filters = ["all", "open", "done", "inprogress", "pending", ...byCategory.map(x => x.c)];
  const shown = items.filter(i => {
    if (filter === "all") return true;
    if (filter === "open") return i.status !== "done";
    return i.status === filter || i.category === filter;
  });

  const openModal = (item) => setModal(item
    ? { id: item.id, form: { title: item.title, body: item.body || "", due_date: item.due_date, category: item.category,
        risk: item.risk, status: item.status, notes: item.notes || "" } }
    : { form: { ...emptyForm } });

  const save = async () => {
    const f = modal.form;
    if (!f.title.trim() || !f.due_date) { setActionError("Title and due date are required."); return; }
    setSaving(true);
    const payload = { ...f, title: f.title.trim(), body: f.body.trim() || null, notes: f.notes.trim() || null };
    try {
      await call(modal.id ? "PUT" : "POST", modal.id ? `/api/compliance/${modal.id}` : "/api/compliance", payload);
      setModal(null);
      load();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RealPage title={title} subtitle={subtitle}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canEdit && <button style={primaryBtn} onClick={() => { setActionError(null); openModal(null); }}>+ Add deadline</button>}
        {items.length > 0 && <button style={btn} onClick={() => downloadCsv(items)}>Export CSV</button>}
        {!canEdit && (
          <span style={{ alignSelf: "center", color: "var(--sub)", fontSize: 12 }}>
            Only administrators can add or change items.
          </span>
        )}
      </div>

      {actionError && !modal && (
        <div style={{ ...glassCard(C.red), color: "var(--text)", fontSize: 13 }}>{actionError}</div>
      )}

      {items.length === 0 ? (
        <EmptyCard
          title="No compliance items yet"
          text={canEdit
            ? "Add the deadlines you need to track, for example a grid operator registration, an inverter or battery safety certificate, an insurance renewal or a tax filing. Each one gets a due date, a risk level and a status."
            : "Nothing has been added yet. An administrator can add the deadlines to track."} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
            <KpiCard label="Compliance score" value={score == null ? "—" : `${score}%`} color={score >= 80 ? C.green : score >= 50 ? C.amber : C.red}
              icon="✅" sub={`${done} of ${items.length} done`} />
            <KpiCard label="Urgent (≤ 60 days)" value={urgent} color={urgent ? C.red : C.green} icon="⏰"
              sub={overdue ? `${overdue} overdue` : "Open items"} />
            <KpiCard label="High risk" value={highRisk} color={highRisk ? C.red : C.green} icon="⚠️" sub="Open items" />
            <KpiCard label="In progress" value={inprogress} color={C.amber} icon="🛠️" sub="Active" />
            <KpiCard label="Pending" value={pending} color={C.indigo} icon="📋" sub="Not started" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            <div style={glassCard(C.indigo)}>
              <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>
                Status
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={barData} margin={{ top: 8, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis tick={axisStyle} allowDecimals={false} />
                  <Tooltip content={<PremiumTooltip />} />
                  <Bar dataKey="value" name="Items" radius={[5, 5, 0, 0]}>
                    {barData.map(b => <Cell key={b.name} fill={b.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={glassCard(C.green)}>
              <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>
                Completion by category
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {byCategory.map(x => {
                  const pct = Math.round((x.done / x.total) * 100);
                  return (
                    <div key={x.c}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "var(--text)" }}>{x.c}</span>
                        <span style={{ color: "var(--sub)" }}>{x.done}/{x.total} · {pct}%</span>
                      </div>
                      <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: C.green }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                background: filter === f ? C.accent : "var(--surface2)", color: filter === f ? "#0b1020" : "var(--sub)",
                border: `1px solid ${filter === f ? C.accent : "var(--border)"}`,
              }}>{f === "inprogress" ? "In progress" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
            ))}
          </div>

          <div style={glassCard(C.amber)}>
            <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>
              Deadlines ({shown.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shown.length === 0 && <div style={{ color: "var(--sub)", fontSize: 13 }}>No items match this filter.</div>}
              {shown.map(i => {
                const dl = daysLeft(i.due_date);
                const isUrgent = dl <= 60 && i.status !== "done";
                return (
                  <div key={i.id} style={{
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10,
                    background: isUrgent ? `${C.red}10` : "var(--surface2)", border: `1px solid ${isUrgent ? `${C.red}44` : "var(--border)"}`,
                  }}>
                    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{i.title}</div>
                      {i.body && <div style={{ fontSize: 12, color: "var(--sub)" }}>{i.body}</div>}
                      {i.notes && <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4, whiteSpace: "pre-wrap" }}>{i.notes}</div>}
                    </div>
                    <div style={{ minWidth: 110 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isUrgent ? C.red : "var(--text)" }}>{i.due_date}</div>
                      <div style={{ fontSize: 11, color: isUrgent ? C.red : "var(--sub)" }}>
                        {i.status === "done" ? "Completed" : dl < 0 ? `${-dl} d overdue` : `${dl} d left`}
                      </div>
                    </div>
                    <Chip color={C.sky}>{i.category}</Chip>
                    <Chip color={riskColor(i.risk)}>{i.risk} risk</Chip>
                    <Chip color={statusColor(i.status)}>{statusLabel(i.status)}</Chip>
                    {canEdit && (
                      <div style={{ display: "flex", gap: 6 }}>
                        {i.status !== "done" && (
                          <button style={btn} onClick={() => run(() => call("PUT", `/api/compliance/${i.id}`, { status: "done" }))}>Mark done</button>
                        )}
                        <button style={btn} onClick={() => { setActionError(null); openModal(i); }}>Edit</button>
                        <button style={{ ...btn, color: C.red }} onClick={() => {
                          if (window.confirm(`Delete "${i.title}"?`)) run(() => call("DELETE", `/api/compliance/${i.id}`));
                        }}>Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => !saving && setModal(null)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: 480, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              {modal.id ? "Edit deadline" : "Add deadline"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["Title", "title", "text"],
                ["Authority or counterparty", "body", "text"],
                ["Due date", "due_date", "date"],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{label}</div>
                  <input type={type} value={modal.form[key]} style={input}
                    onChange={e => setModal(m => ({ ...m, form: { ...m.form, [key]: e.target.value } }))} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["Category", "category", CATEGORIES.map(c => [c, c])],
                  ["Risk", "risk", RISKS.map(r => [r, r])],
                  ["Status", "status", STATUSES],
                ].map(([label, key, opts]) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{label}</div>
                    <select value={modal.form[key]} style={input}
                      onChange={e => setModal(m => ({ ...m, form: { ...m.form, [key]: e.target.value } }))}>
                      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>Notes</div>
                <textarea rows={3} value={modal.form.notes} style={{ ...input, resize: "vertical" }}
                  onChange={e => setModal(m => ({ ...m, form: { ...m.form, notes: e.target.value } }))} />
              </div>
              {actionError && <div style={{ color: C.red, fontSize: 12 }}>{actionError}</div>}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button style={btn} disabled={saving} onClick={() => setModal(null)}>Cancel</button>
              <button style={primaryBtn} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </RealPage>
  );
}
