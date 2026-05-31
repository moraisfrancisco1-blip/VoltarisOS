/**
 * VoltarisOS — Premium Chart Theme
 * Shared visual system: gradients, glows, 3D depth, tooltips, axes
 */

export const C = {
  accent:  "#6366f1",
  green:   "#10b981",
  amber:   "#f59e0b",
  red:     "#ef4444",
  blue:    "#60a5fa",
  purple:  "#a78bfa",
  teal:    "#2dd4bf",
  rose:    "#fb7185",
  indigo:  "#818cf8",
  sky:     "#38bdf8",
};

// ── Gradient definitions (embed in chart <defs>) ─────────────────────────────
export function ChartDefs() {
  const gradients = [
    { id: "grad_solar",   top: C.amber,   bot: "#451a03"  },
    { id: "grad_bess",    top: C.purple,  bot: "#2e1065"  },
    { id: "grad_wind",    top: C.blue,    bot: "#172554"  },
    { id: "grad_load",    top: C.red,     bot: "#450a0a"  },
    { id: "grad_green",   top: C.green,   bot: "#022c22"  },
    { id: "grad_accent",  top: C.accent,  bot: "#1e1b4b"  },
    { id: "grad_teal",    top: C.teal,    bot: "#042f2e"  },
    { id: "grad_rose",    top: C.rose,    bot: "#4c0519"  },
    { id: "grad_sky",     top: C.sky,     bot: "#0c1a2e"  },
    { id: "grad_da",      top: "#60a5fa", bot: "#172554"  },
    { id: "grad_id",      top: C.amber,   bot: "#451a03"  },
    { id: "grad_forecast",top: C.purple,  bot: "#2e1065"  },
    { id: "grad_revenue", top: C.teal,    bot: "#042f2e"  },
    { id: "grad_avoided", top: C.green,   bot: "#022c22"  },
    { id: "grad_scope1",  top: C.amber,   bot: "#451a03"  },
    { id: "grad_scope2",  top: C.red,     bot: "#450a0a"  },
    { id: "grad_pnl",     top: C.green,   bot: "#022c22"  },
    { id: "grad_cum",     top: C.accent,  bot: "#1e1b4b"  },
  ];
  const radials = [
    { id: "radial_accent", color: C.accent },
    { id: "radial_green",  color: C.green  },
    { id: "radial_amber",  color: C.amber  },
  ];
  return (
    <defs>
      {gradients.map(g => (
        <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={g.top} stopOpacity={0.55} />
          <stop offset="60%"  stopColor={g.top} stopOpacity={0.12} />
          <stop offset="100%" stopColor={g.bot} stopOpacity={0.02} />
        </linearGradient>
      ))}
      {radials.map(r => (
        <radialGradient key={r.id} id={r.id} cx="50%" cy="0%" r="80%">
          <stop offset="0%"   stopColor={r.color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={r.color} stopOpacity={0}    />
        </radialGradient>
      ))}
      {/* Glow filters */}
      <filter id="glow_green" x="-20%" y="-50%" width="140%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow_amber" x="-20%" y="-50%" width="140%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow_blue" x="-20%" y="-50%" width="140%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="shadow3d" x="-5%" y="0%" width="110%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.35" />
      </filter>
    </defs>
  );
}

// ── Premium Tooltip ──────────────────────────────────────────────────────────
export function PremiumTooltip({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(15,18,32,0.97) 0%, rgba(22,26,42,0.97) 100%)",
      border: "1px solid rgba(99,102,241,0.3)",
      borderRadius: 12,
      padding: "12px 16px",
      backdropFilter: "blur(16px)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
      minWidth: 140,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "rgba(148,163,184,0.9)",
        textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
        borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 6,
      }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 4, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
            <span style={{ fontSize: 12, color: "rgba(148,163,184,0.8)" }}>{p.name}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: p.color, fontVariantNumeric: "tabular-nums" }}>
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}{unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Axis tick style ──────────────────────────────────────────────────────────
export const axisStyle = { fontSize: 10, fill: "rgba(148,163,184,0.6)", fontFamily: "inherit" };

// ── Grid style ───────────────────────────────────────────────────────────────
export const gridStyle = { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.04)" };

// ── Premium card ─────────────────────────────────────────────────────────────
export const glassCard = (accentColor = "#6366f1") => ({
  background: "linear-gradient(135deg, rgba(22,26,42,0.9) 0%, rgba(15,18,32,0.95) 100%)",
  border: `1px solid rgba(255,255,255,0.07)`,
  borderRadius: 18,
  padding: 22,
  position: "relative",
  overflow: "hidden",
  boxShadow: `0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset`,
  borderTop: `2px solid ${accentColor}50`,
});

// ── KPI card accent bar (3D depth) ───────────────────────────────────────────
export function KpiCard({ label: lbl, value, sub, color, icon }) {
  return (
    <div style={{
      ...glassCard(color),
      background: `linear-gradient(135deg, rgba(22,26,42,0.92) 0%, rgba(15,18,32,0.98) 100%)`,
    }}>
      {/* ambient glow blob */}
      <div style={{
        position: "absolute", top: -20, right: -20, width: 80, height: 80,
        borderRadius: "50%", background: color, opacity: 0.07, filter: "blur(20px)",
        pointerEvents: "none",
      }} />
      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
        {lbl}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 900, color,
        lineHeight: 1, letterSpacing: -0.5,
        fontVariantNumeric: "tabular-nums",
        textShadow: `0 0 20px ${color}60`,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.55)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
          {sub}
        </div>
      )}
      {/* bottom accent line */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
      }} />
    </div>
  );
}
