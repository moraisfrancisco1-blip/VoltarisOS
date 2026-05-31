import { useEffect, useRef, useState } from "react";

const accent = "#6366f1";
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 };

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

// Leaflet map component — lazy loads leaflet from CDN to avoid build issues
export default function MapView() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (mapInstanceRef.current) return;

    // Inject leaflet CSS
    if (!document.querySelector("#leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load leaflet JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: [48.0, 0.0],
        zoom: 4,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      sites.forEach(site => {
        const color = site.status === "Online" ? "#10b981" : "#ef4444";
        const icon = L.divIcon({
          html: `<div style="
            width: 18px; height: 18px; border-radius: 50%;
            background: ${color}; border: 3px solid #fff;
            box-shadow: 0 0 12px ${color}88;
          "></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          className: "",
        });

        const marker = L.marker([site.lat, site.lng], { icon }).addTo(map);
        marker.on("click", () => setSelected(site));

        marker.bindPopup(`
          <div style="font-family:sans-serif; min-width:140px;">
            <strong>${site.name}</strong><br/>
            <span style="color:#6b7280; font-size:12px">${site.country}</span><br/>
            <span style="color:${color}; font-size:12px">${site.status}</span>
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

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--bg)" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Site Map</h1>
      <p style={{ color: "var(--sub)", marginBottom: 24 }}>Geographic overview of all VPP assets</p>

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Sites", value: sites.length },
          { label: "Online", value: sites.filter(s => s.status === "Online").length, color: "#10b981" },
          { label: "Total Power", value: `${sites.reduce((a, s) => a + s.power, 0)} kW`, color: accent },
          { label: "Countries", value: 2 },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ color: "var(--sub)", fontSize: 12, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color || "#e5e7eb" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        {/* Map */}
        <div style={{ ...card, padding: 0, overflow: "hidden", minHeight: 500 }}>
          <div ref={mapRef} style={{ width: "100%", height: 500 }} />
          {!mapReady && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "var(--sub)", fontSize: 13 }}>
              Loading map...
            </div>
          )}
        </div>

        {/* Site list + detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sites.map(s => (
            <div key={s.id}
              onClick={() => {
                setSelected(s);
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([s.lat, s.lng], 8, { duration: 1.2 });
                }
              }}
              style={{
                ...card,
                cursor: "pointer",
                border: `1px solid ${selected?.id === s.id ? accent : "#1f2937"}`,
                background: selected?.id === s.id ? "var(--surface2)" : "var(--surface)",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "var(--sub)" }}>{s.country}</div>
                </div>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 99,
                  background: "#064e3b", color: "#10b981"
                }}>{s.status}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--sub)", marginBottom: 8 }}>{s.type}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  { label: "Power", val: `${s.power} kW` },
                  { label: "Battery", val: `${s.battery}%` },
                  { label: "Solar", val: `${s.solar} kW` },
                  { label: "Revenue", val: s.revenue },
                ].map(m => (
                  <div key={m.label} style={{ background: "var(--surface2)", padding: "6px 10px", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--sub)" }}>{m.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {selected && (
            <div style={{ ...card, background: "#1a1f35", border: `1px solid ${accent}` }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Coordinates</div>
              <div style={{ fontSize: 12, color: "var(--sub)" }}>
                Lat: {selected.lat.toFixed(4)}<br />
                Lng: {selected.lng.toFixed(4)}<br />
                Capacity: {selected.capacity}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
