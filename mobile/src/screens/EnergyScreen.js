import { useState, useEffect } from "react"
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"

import * as api from "../../api"
import { C, FONT, ss } from "../theme/tokens"
import { KPI, SectionHeader, Badge, ComingSoon, MiniBar, Sparkline } from "../ui"

function EnergyScreen() {
  const auth = useAuth()
  const [tab, setTab] = useState("battery")

  const tabs = [
    { id: "battery", label: "Battery" },
    { id: "ev", label: "EV Fleet" },
    { id: "grid", label: "Grid" },
    { id: "forecast", label: "Forecast" },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={ss.pageTitle}>Energy Systems</Text>
          <Text style={ss.pageSubtitle}>Real-time monitoring & control</Text>
        </View>
        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
          {tabs.map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
              style={[ss.tabPill, tab === t.id && ss.tabPillActive]}>
              <Text style={[ss.tabPillText, tab === t.id && ss.tabPillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Content */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {tab === "battery" && <BatteryTab />}
          {tab === "ev" && <EVTab />}
          {tab === "grid" && <GridTab />}
          {tab === "forecast" && <ForecastTab />}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function BatteryTab() {
  const [batteries, setBatteries] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const devices = await api.getDevices()
        const batteryDevices = (devices || []).filter(d => d.device_type === "battery")
        const withReadings = await Promise.all(batteryDevices.map(async d => {
          const readings = await api.getDeviceReadings(d.id).catch(() => [])
          const latest = readings?.[0] || {}
          return { ...d, soc: latest.soc_pct, power: latest.power_kw, temp: latest.temp_c }
        }))
        setBatteries(withReadings)
      } catch {
        setBatteries([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
  if (!batteries.length) return <ComingSoon icon="🔋" label="No battery devices yet" sub="Batteries registered in VoltarisOS will show live SOC here." />

  const withSoc = batteries.filter(b => b.soc != null)
  const totalSOC = withSoc.length ? withSoc.reduce((a, b) => a + b.soc, 0) / withSoc.length : null
  const charging = batteries.filter(b => b.power != null && b.power < 0).length
  const discharging = batteries.filter(b => b.power != null && b.power > 0).length
  const idle = batteries.length - charging - discharging

  return (
    <View>
      {/* Fleet overview */}
      <LinearGradient colors={["rgba(59,130,246,0.12)", "rgba(59,130,246,0.04)"]}
        style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.blue + "30", marginBottom: 16 }}>
        <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Fleet Average SOC</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
          <Text style={{ color: C.blue, fontSize: 44, fontWeight: "900", letterSpacing: -1 }}>{totalSOC != null ? totalSOC.toFixed(0) : "—"}%</Text>
          <Text style={{ color: C.sub, fontSize: FONT.sm, marginBottom: 10 }}>avg across {batteries.length} units</Text>
        </View>
        <MiniBar value={totalSOC || 0} max={100} color={C.blue} height={10} />
      </LinearGradient>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Charging" value={charging.toString()} unit="units" color={C.accent} />
        <KPI label="Discharging" value={discharging.toString()} unit="units" color={C.amber} />
        <KPI label="Idle" value={idle.toString()} unit="units" color={C.muted} />
      </View>

      {batteries.map(b => (
        <View key={b.id} style={[ss.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{b.name}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{b.status}</Text>
            </View>
            <Badge label={b.power > 0 ? "discharging" : b.power < 0 ? "charging" : "idle"}
              color={b.power > 0 ? C.amber : b.power < 0 ? C.accent : C.muted} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: C.accent, fontWeight: "800", fontSize: FONT.xl }}>{b.soc != null ? `${b.soc.toFixed(0)}%` : "—"}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.sm }}>{b.power != null ? `${b.power > 0 ? "+" : ""}${b.power.toFixed(1)} kW` : "—"}</Text>
          </View>
          <MiniBar value={b.soc || 0} max={100} color={b.soc > 60 ? C.accent : b.soc > 30 ? C.amber : C.red} height={7} />
          {b.temp != null && (
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 8 }}>Temp: {b.temp.toFixed(1)}°C</Text>
          )}
        </View>
      ))}
    </View>
  )
}

function EVTab() {
  const [sites, setSites] = useState(null)

  useEffect(() => {
    api.getSites().then(setSites).catch(() => setSites([]))
  }, [])

  if (!sites) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  const totalChargers = sites.reduce((a, s) => a + (s.ev_chargers || 0), 0)
  const sitesWithChargers = sites.filter(s => s.ev_chargers > 0)

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="EV Chargers" value={totalChargers.toString()} unit="installed" color={C.accent} />
        <KPI label="Sites" value={sitesWithChargers.length.toString()} unit="with EV" color={C.blue} />
      </View>
      {sitesWithChargers.length > 0 && sitesWithChargers.map(s => (
        <View key={s.id} style={[ss.card, { marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{s.name}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{s.location || "—"}</Text>
          </View>
          <Text style={{ color: C.accent, fontWeight: "800", fontSize: FONT.md }}>{s.ev_chargers} bays</Text>
        </View>
      ))}
      <View style={{ marginTop: 8 }}>
        <ComingSoon icon="🔌" label="Per-vehicle EV telemetry — coming soon"
          sub="Plate, live SOC, V2G status and ETA require a charger integration that isn't built yet." />
      </View>
    </View>
  )
}

function GridTab() {
  const [prices, setPrices] = useState(null)
  const [source, setSource] = useState(null)

  useEffect(() => {
    api.getDayAheadPrices().then(d => { setPrices(d?.prices || []); setSource(d?.source) }).catch(() => setPrices([]))
  }, [])

  if (!prices) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  const values = prices.map(p => p.price)
  const nowHour = `${String(new Date().getHours()).padStart(2, "0")}:00`
  const nowIdx = prices.findIndex(p => p.hour === nowHour)
  const current = nowIdx >= 0 ? prices[nowIdx].price : null

  return (
    <View>
      <LinearGradient colors={["rgba(245,158,11,0.12)", "rgba(245,158,11,0.02)"]}
        style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.amber + "30", marginBottom: 16 }}>
        <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Day-Ahead Price</Text>
        <Text style={{ color: C.amber, fontSize: 44, fontWeight: "900", letterSpacing: -1 }}>
          {current != null ? current.toFixed(2) : "—"}<Text style={{ fontSize: FONT.lg, color: C.sub }}> €/kWh</Text>
        </Text>
        <Text style={{ color: C.amber + "99", fontSize: FONT.sm, marginTop: 6 }}>
          {source === "entsoe" ? "ENTSO-E live" : source === "simulated" ? "Simulated (no ENTSO-E token configured)" : ""}
        </Text>
        {values.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Sparkline data={values} color={C.amber} height={56} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>{prices[0]?.hour}</Text>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>{prices[Math.floor(prices.length / 2)]?.hour}</Text>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>{prices[prices.length - 1]?.hour}</Text>
            </View>
          </View>
        )}
      </LinearGradient>
      <ComingSoon icon="⚡" label="Frequency / voltage / import-export — coming soon"
        sub="No grid-meter telemetry is wired into the backend yet." />
    </View>
  )
}

function ForecastTab() {
  return (
    <ComingSoon icon="📈" label="Load forecast — coming soon"
      sub="A forecasting endpoint isn't available in the backend yet." />
  )
}

export default EnergyScreen
