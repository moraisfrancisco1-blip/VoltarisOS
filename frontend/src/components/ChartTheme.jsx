/**
 * VoltarisOS — Chart Theme v4
 * All backgrounds use CSS vars → adapts to any theme automatically.
 */

export const C = {
  accent:  "#818cf8",
  green:   "#34d399",
  amber:   "#fbbf24",
  red:     "#f87171",
  blue:    "#60a5fa",
  purple:  "#c084fc",
  teal:    "#2dd4bf",
  rose:    "#fb7185",
  indigo:  "#a5b4fc",
  sky:     "#38bdf8",
};

// ── Gradient definitions ──────────────────────────────────────────────────────
export function ChartDefs() {
  const gradients = [
    { id: "grad_solar",    top: C.amber   },
    { id: "grad_bess",     top: C.purple  },
    { id: "grad_wind",     top: C.blue    },
    { id: "grad_load",     top: C.red     },
    { id: "grad_green",    top: C.green   },
    { id: "grad_accent",   top: C.accent  },
    { id: "grad_teal",     top: C.teal    },
    { id: "grad_rose",     top: C.rose    },
    { id: "grad_sky",      top: C.sky     },
    { id: "grad_da",       top: C.blue    },
    { id: "grad_id",       top: C.amber   },
    { id: "grad_forecast", top: C.purple  },
    { id: "grad_revenue",  top: C.teal    },
    { id: "grad_avoided",  top: C.green   },
    { id: "grad_scope1",   top: C.amber   },
    { id: "grad_scope2",   top: C.red     },
    { id: "grad_pnl",      top: C.green   },
    { id: "grad_cum",      top: C.accent  },
  ];

  return (
    <defs>
      {gradients.map(g => (
        <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={g.top} stopOpacity={0.5}  />
          <stop offset="60%"  stopColor={g.top} stopOpacity={0.15} />
          <stop offset="100%" stopColor={g.top} stopOpacity={0.02} />
        </linearGradient>
      ))}
      <filter id="glow_green" x="-20%" y="-50%" width="140%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow_amber" x="-20%" y="-50%" width="140%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow_blue" x="-20%" y="-50%" width="140%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="shadow3d" x="-5%" y="0%" width="110%" height="200%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
      </filter>
    </defs>
  );
}

// ── Premium Tooltip — uses CSS vars ──────────────────────────────────────────
export function PremiumTooltip({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border-strong)",
      borderRadius: 10,
      padding: "10px 14px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
      minWidth: 140,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "var(--sub)",
        textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
        borderBottom: "1px solid var(--border)", paddingBottom: 6,
      }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:20, marginBottom:4, alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:p.color, boxShadow:`0 0 8px ${p.color}` }} />
            <span style={{ fontSize:12, color:"var(--sub)" }}>{p.name}</span>
          </div>
          <span style={{ fontSize:13, fontWeight:800, color:p.color, fontVariantNumeric:"tabular-nums" }}>
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}{unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Axis + Grid ───────────────────────────────────────────────────────────────
export const axisStyle = { fontSize: 10, fill: "var(--sub)", fontFamily: "inherit" };
export const gridStyle  = { strokeDasharray: "3 3", stroke: "var(--border)" };

// ── Card style — uses CSS vars, adapts to any theme ───────────────────────────
export const glassCard = (accentColor = "#818cf8") => ({
  background: "var(--surface)",
  border: `1px solid var(--border)`,
  borderTop: `2px solid ${accentColor}`,
  borderRadius: 16,
  padding: 20,
  position: "relative",
  overflow: "hidden",
  boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
});

// ── KPI Card ──────────────────────────────────────────────────────────────────
export function KpiCard({ label: lbl, value, sub, color, icon }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderTop: `2px solid ${color}`,
      borderRadius: 16,
      padding: "18px 20px",
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
    }}>
      {/* Ambient glow */}
      <div style={{
        position:"absolute", top:-40, right:-40, width:120, height:120,
        borderRadius:"50%", background:color, opacity:0.07, filter:"blur(35px)",
        pointerEvents:"none",
      }} />
      <div style={{
        fontSize:11, color:"var(--sub)", textTransform:"uppercase",
        letterSpacing:1, marginBottom:10, display:"flex", alignItems:"center", gap:6,
      }}>
        {icon && <span style={{ fontSize:14 }}>{icon}</span>}
        {lbl}
      </div>
      <div style={{
        fontSize:30, fontWeight:900, color,
        lineHeight:1, letterSpacing:-0.5,
        fontVariantNumeric:"tabular-nums",
        textShadow:`0 0 20px ${color}60`,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize:11, color:"var(--sub)", marginTop:8, display:"flex", alignItems:"center", gap:4 }}>
          {sub}
        </div>
      )}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, height:1,
        background:`linear-gradient(90deg, transparent, ${color}30, transparent)`,
      }} />
    </div>
  );
}
