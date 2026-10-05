import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea } from "recharts";
import { C, glassCard, KpiCard, PremiumTooltip, axisStyle, gridStyle } from "../ChartTheme";
import { useApi, RealPage, LoadingCard, ErrorCard, EmptyCard } from "./realShared";

const th = { padding: "8px 12px", borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--sub)",
  fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 };
const td = { padding: "10px 12px", color: "var(--text)" };

const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const prColor = (v) => (v == null ? C.indigo : v >= 0.75 ? C.green : v >= 0.6 ? C.amber : C.red);

// What a given average PR means, in plain words and without claiming a diagnosis.
const interpret = (avg) => {
  if (avg == null) return null;
  if (avg >= 0.75) return { color: C.green, text: "Within the usual range for a healthy system (about 75-90%)." };
  if (avg >= 0.6) return { color: C.amber, text: "Somewhat below the usual 75-90%. Worth watching over the next weeks." };
  return {
    color: C.red,
    text: "Well below the usual 75-90%. Possible causes: shading, dirt on the panels, the inverter limiting output, or the monitoring portal not counting all the panels. More days of data will show whether it is lasting.",
  };
};

const STATUS_TEXT = {
  needs_orientation: ["Set the panel orientation", "The performance ratio needs the tilt and azimuth of the panels. Open the site under Sites, press Edit and fill in Tilt and Azimuth (0° = south, 90° = west, −90° = east)."],
  needs_location: ["Add the site's location", "Add the latitude and longitude of the site under Sites so the weather for that place can be used."],
  no_capacity: ["Add the installed solar capacity", "Fill in the solar capacity (kW) of the site under Sites. It is the reference the production is compared with."],
  weather_unavailable: ["Weather data is not available right now", "The irradiance history could not be fetched. Try again in a few minutes."],
};

function SiteBlock({ site, onNavigate }) {
  const header = (
    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
      {site.name}
      <span style={{ color: "var(--sub)", fontWeight: 500, fontSize: 12, marginLeft: 10 }}>
        {site.solar_kw} kWp{site.tilt_deg != null ? ` · ${site.tilt_deg}° tilt` : ""}{site.azimuth_deg != null ? ` · azimuth ${site.azimuth_deg}°` : ""}
      </span>
    </div>
  );

  if (site.status !== "ok") {
    const [title, text] = STATUS_TEXT[site.status] || ["No data", "Nothing to show for this site yet."];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {header}
        <EmptyCard title={title} text={text}
          actionLabel={onNavigate && site.status !== "weather_unavailable" ? "Go to Sites" : null}
          onAction={onNavigate ? () => onNavigate("sites") : null} />
      </div>
    );
  }

  const s = site.summary;
  const valid = site.days.filter(d => d.valid);
  const chart = valid.map(d => ({ date: d.date.slice(5), pr: Math.round(d.pr * 1000) / 10 }));
  const note = interpret(s.avg_pr);
  const recent = [...site.days].reverse().slice(0, 14);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {header}

      {s.valid_days === 0 && (
        <EmptyCard title="Collecting data"
          text={`The ratio needs a full day with enough sun and enough readings, and today does not count until it ends. Days with data so far: ${s.days_with_data}. The first result appears after the first full day.`} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <KpiCard label="Average PR" value={pct(s.avg_pr)} color={prColor(s.avg_pr)} icon="📈" sub={`${s.valid_days} valid day${s.valid_days === 1 ? "" : "s"}`} />
        <KpiCard label="Last 7 valid days" value={pct(s.last7_pr)} color={prColor(s.last7_pr)} icon="🗓️" sub="Average PR" />
        <KpiCard label="Trend" value={s.trend_pp == null ? "—" : `${s.trend_pp > 0 ? "+" : ""}${s.trend_pp} pp`}
          color={s.trend_pp == null ? C.indigo : s.trend_pp < -3 ? C.red : C.green} icon="↕️"
          sub={s.trend_pp == null ? `Needs ${s.trend_needs_valid_days} valid days` : "Last week vs first week"} />
        <KpiCard label="Days with data" value={s.days_with_data} color={C.blue} icon="🔌" sub="Including today" />
      </div>

      {note && (
        <div style={{ ...glassCard(note.color), color: "var(--text)", fontSize: 13, lineHeight: 1.6 }}>{note.text}</div>
      )}

      {chart.length > 0 && (
        <div style={glassCard(C.green)}>
          <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
            Performance ratio per day (%) — green band = usual range
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={chart} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid {...gridStyle} />
              <ReferenceArea y1={75} y2={90} fill={C.green} fillOpacity={0.08} />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis tick={axisStyle} domain={[0, 100]} unit="%" />
              <Tooltip content={<PremiumTooltip unit="%" />} />
              <Line type="monotone" dataKey="pr" name="PR" stroke={C.green} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={glassCard(C.blue)}>
        <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
          Latest days
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["Date", "Produced", "Sun on panels", "PR", "Note"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {recent.map(d => (
                <tr key={d.date}>
                  <td style={td}>{d.date}</td>
                  <td style={td}>{d.energy_kwh.toFixed(2)} kWh</td>
                  <td style={td}>{d.poa_kwh_m2.toFixed(2)} kWh/m²</td>
                  <td style={{ ...td, fontWeight: 800, color: prColor(d.pr) }}>{pct(d.pr)}</td>
                  <td style={{ ...td, color: "var(--sub)" }}>{d.reason || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Solar performance with the tenant's REAL data (GET /api/solar/performance): production
// measured by the inverter compared with what the weather allowed on the panels' real tilt and
// azimuth. Shown when Simulation mode is off; the demo simulator stays as is.
export default function DegradationReal({ onNavigate }) {
  const { data, error } = useApi(["/api/solar/performance?days=60"]);
  const title = "Solar Performance";
  const subtitle = "How your panels perform compared with the weather";

  if (error) return <RealPage title={title} subtitle={subtitle}><ErrorCard error={error} /></RealPage>;
  if (!data) return <RealPage title={title} subtitle={subtitle}><LoadingCard /></RealPage>;

  const body = data[0];
  const sites = body.sites || [];

  return (
    <RealPage title={title} subtitle={subtitle}>
      {sites.length === 0 ? (
        <EmptyCard title="No sites yet" text="Add a site with its solar capacity, location and panel orientation to see its performance."
          actionLabel={onNavigate ? "Go to Sites" : null} onAction={onNavigate ? () => onNavigate("sites") : null} />
      ) : (
        sites.map(s => <SiteBlock key={s.site_id} site={s} onNavigate={onNavigate} />)
      )}

      <div style={{ color: "var(--sub)", fontSize: 11, lineHeight: 1.6 }}>
        Performance ratio (PR) = energy produced ÷ (installed kWp × sun on the panel plane). The sun is the irradiance
        on the panels' real tilt and azimuth (Open-Meteo), so PR can be compared between sunny and cloudy days.
        Days with too little sun or too few readings are not counted, and today only counts once it is over. PR is not
        temperature-corrected, so it dips a little on hot days. {body.degradation && body.degradation.reason}
      </div>
    </RealPage>
  );
}
