import { useEffect, useRef, useState } from "react";

const accent = "#6366f1";

const sites = [
  {
    id: 1, name: "Rotterdam", lat: 51.9225, lng: 4.4792, country: "Netherlands",
    status: "Online", solar: 420, battery: 72, ev: 3, power: 318, revenue: "€1,240",
    type: "Solar + BESS + EV", capacity: "500 kW / 1000 kWh",
  },
  {
    id: 2, name: "Rebordelo", lat: 41.8028, lng: -7.2042, country: "Portugal",
    status: "Online", solar: 310, battery: 45, ev: 1, power: 210, revenue: "€890",
    type: "Solar + BESS", capacity: "250 kW / 500 kWh",
  },
];

export default function MapView() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (mapInstanceRef.current) return;

    if (!document.querySelector("#leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Leaflet popup premium styling injection
    if (!document.querySelector("#leaflet-premium-css")) {
      const style = document.createElement("style");
      style.id = "leaflet-premium-css";
      style.textContent = `
        .leaflet-popup-content-wrapper {
          background: var(--surface, #1e293b) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          border-radius: 12px !important;
          box-shadow: 0 16px 48px rgba(0,0,0,0.5) !important;
          color: var(--text, #e2e8f0) !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-tip {
          background: var(--surface, #1e293b) !important;
        }
        .leaflet-popup-close-button {
          color: var(--sub, #94a3b8) !important;
          font-size: 18px !important;
          top: 8px !important;
          right: 10px !important;
        }
        .leaflet-control-zoom a {
          background: var(--surface, #1e293b) !important;
          border-color: rgba(255,255,255,0.15) !important;
          color: var(--text, #e2e8f0) !important;
        }
        .leaflet-control-zoom a:hover {
          background: var(--surface2, #162032) !important;
        }
        .leaflet-control-attribution {
          background: rgba(15,23,42,0.7) !important;
          color: rgba(148,163,184,0.5) !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: rgba(148,163,184,0.6) !important; }
      `;
      document.head.appendChild(style);
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: [48.0, 0.0],
        zoom: 4,
        zoomControl: true,
      });

      // Voyager tiles — colorful, light, premium
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      sites.forEach(site => {
        const color = site.status === "Online" ? "#10b981" : "#ef4444";
        const ring = site.status === "Online" ? "#34d399" : "#f87171";

        // Premium pulsing marker
        const icon = L.divIcon({
          html: `
            <div style="position:relative; width:32px; height:32px;">
              <div style="
                position:absolute; inset:0; border-radius:50%;
                background:${color}22;
                animation: markerPulse 2s ease-out infinite;
              "></div>
              <div style="
                position:absolute; top:6px; left:6px; width:20px; height:20px;
                border-radius:50%; background:${color};
                border: 3px solid #fff;
                box-shadow: 0 0 16px ${color}99, 0 2px 8px rgba(0,0,0,0.4);
              "></div>
            </div>
            <style>
              @keyframes markerPulse {
                0% { transform: scale(1); opacity: 0.6; }
                70% { transform: scale(2.2); opacity: 0; }
                100% { transform: scale(2.2); opacity: 0; }
              }
            </style>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          className: "",
        });

        const marker = L.marker([site.lat, site.lng], { icon }).addTo(map);
        marker.on("click", () => setSelected(site));

        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 14px 16px; min-width: 200px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div>
                <div style="font-size:15px; font-weight:700; color:var(--text,#e2e8f0);">${site.name}</div>
                <div style="font-size:11px; color:var(--sub,#94a3b8); margin-top:1px;">${site.country}</div>
              </div>
              <span style="
                font-size:10px; font-weight:700; padding:3px 10px; border-radius:20px;
                background:${color}20; color:${color}; border:1px solid ${color}40;
              ">${site.status}</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:8px 10px;">
                <div style="font-size:10px; color:var(--sub,#94a3b8);">Power</div>
                <div style="font-size:14px; font-weight:700; color:#60a5fa;">${site.power} kW</div>
              </div>
              <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:8px 10px;">
                <div style="font-size:10px; color:var(--sub,#94a3b8);">Battery</div>
                <div style="font-size:14px; font-weight:700; color:${color};">${site.battery}%</div>
              </div>
              <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:8px 10px;">
                <div style="font-size:10px; color:var(--sub,#94a3b8);">Solar</div>
                <div style="font-size:14px; font-weight:700; color:#fbbf24;">${site.solar} kW</div>
              </div>
              <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:8px 10px;">
                <div style="font-size:10px; color:var(--sub,#94a3b8);">Revenue</div>
                <div style="font-size:14px; font-weight:700; color:#34d399;">${site.revenue}</div>
              </div>
            </div>
            <div style="margin-top:10px; font-size:11px; color:var(--sub,#94a3b8);">${site.type} · ${site.capacity}</div>
          </div>
        `);
      });

      mapInstanceRef.current = map;
      setMapReady(true);
    };
    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
  };

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4, color: "var(--text)" }}>Site Map</h1>
      <p style={{ color: "var(--sub)", marginBottom: 24 }}>Geographic overview of all VPP assets</p>

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Sites",  value: sites.length },
          { label: "Online",       value: sites.filter(s => s.status === "Online").length, color: "#10b981" },
          { label: "Total Power",  value: `${sites.reduce((a, s) => a + s.power, 0)} kW`,  color: accent },
          { label: "Countries",    value: 2 },
        ].map(k => (
          <div key={k.label} style={cardStyle}>
            <div style={{ color: "var(--sub)", fontSize: 12, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color || "var(--text)" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        {/* Map */}
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden", position: "relative",
          height: "calc(100vh - 300px)", minHeight: 480,
          boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
          border: "1px solid var(--border)",
        }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
          {!mapReady && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              color: "var(--sub)", fontSize: 13, background: "var(--surface)", padding: "12px 20px",
              borderRadius: 10, border: "1px solid var(--border)" }}>
              Loading map...
            </div>
          )}
        </div>

        {/* Site list + detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sites.map(s => {
            const sc = s.status === "Online" ? "#10b981" : "#ef4444";
            return (
              <div key={s.id}
                onClick={() => {
                  setSelected(s);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo([s.lat, s.lng], 8, { duration: 1.2 });
                  }
                }}
                style={{
                  ...cardStyle,
                  cursor: "pointer",
                  border: `1px solid ${selected?.id === s.id ? accent : "var(--border)"}`,
                  background: selected?.id === s.id ? "var(--surface2)" : "var(--surface)",
                  transition: "all 0.15s",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "var(--sub)" }}>{s.country}</div>
                  </div>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 99,
                    background: `${sc}20`, color: sc, border: `1px solid ${sc}40`,
                  }}>{s.status}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--sub)", marginBottom: 8 }}>{s.type}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    { label: "Power",   val: `${s.power} kW`,  color: "#60a5fa" },
                    { label: "Battery", val: `${s.battery}%`,  color: sc },
                    { label: "Solar",   val: `${s.solar} kW`,  color: "#fbbf24" },
                    { label: "Revenue", val: s.revenue,         color: "#34d399" },
                  ].map(m => (
                    <div key={m.label} style={{ background: "var(--surface2)", padding: "6px 10px", borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: "var(--sub)" }}>{m.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: m.color }}>{m.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {selected && (
            <div style={{ ...cardStyle, border: `1px solid ${accent}55`, background: "var(--surface2)" }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text)", fontSize: 13 }}>Coordinates</div>
              <div style={{ fontSize: 12, color: "var(--sub)", lineHeight: 1.8 }}>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>Lat:</span> {selected.lat.toFixed(4)}<br />
                <span style={{ color: "var(--text)", fontWeight: 600 }}>Lng:</span> {selected.lng.toFixed(4)}<br />
                <span style={{ color: "var(--text)", fontWeight: 600 }}>Capacity:</span> {selected.capacity}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
