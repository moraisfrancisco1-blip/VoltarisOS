import { NavigationContainer } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { LinearGradient } from "expo-linear-gradient"
import {
  useState, useEffect, useRef, useContext, createContext, useCallback
} from "react"
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList,
  TextInput, Alert, ActivityIndicator, RefreshControl, Animated,
  Dimensions, Platform, Pressable, Modal, Switch,
} from "react-native"
import * as api from "./api"
import { useWebSocket } from "./hooks/useWebSocket"
import { APP_VERSION } from "./config"

const { width: SW, height: SH } = Dimensions.get("window")

// ─── Design System ────────────────────────────────────────────────
const C = {
  bg:      "#070d19",
  card:    "#0d1629",
  card2:   "#111f35",
  border:  "#1a2d4a",
  accent:  "#00e5a0",   // electric teal-green
  blue:    "#3b82f6",
  purple:  "#a855f7",
  amber:   "#f59e0b",
  red:     "#ef4444",
  orange:  "#f97316",
  muted:   "#4b6185",
  text:    "#e8f0fe",
  sub:     "#7a99c2",
  white:   "#ffffff",
  glass:   "rgba(255,255,255,0.04)",
  glassB:  "rgba(255,255,255,0.08)",
  accentD: "#00b37a",
  accentL: "rgba(0,229,160,0.12)",
}

const FONT = {
  xs:   11,
  sm:   12,
  md:   14,
  base: 15,
  lg:   17,
  xl:   20,
  "2xl": 24,
  "3xl": 30,
}

// ─── Auth Context ─────────────────────────────────────────────────
const AuthCtx = createContext(null)
const useAuth = () => useContext(AuthCtx)

// ─── Role permissions ───────────────────────────────────────────────
// The backend's only real roles are SUPER_ADMIN / TENANT_ADMIN / TENANT_MEMBER
// (backend/security.py CANONICAL_ROLES) — legacy names like "operator"/"viewer"
// are normalized server-side into TENANT_MEMBER. Map to that reality here.
function isAdminRole(role) {
  return role === "SUPER_ADMIN" || role === "TENANT_ADMIN"
}
function displayRole(role) {
  if (role === "SUPER_ADMIN") return "super admin"
  if (role === "TENANT_ADMIN") return "admin"
  return "member"
}
function timeAgo(iso) {
  if (!iso) return "—"
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Shared Components ────────────────────────────────────────────

function KPI({ label, value, unit, color = C.accent, delta, style }) {
  return (
    <View style={[ss.card, { padding: 14, flex: 1 }, style]}>
      <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{label}</Text>
      <Text style={{ color: color, fontSize: FONT["2xl"], fontWeight: "900", letterSpacing: -0.5 }}>
        {value}<Text style={{ fontSize: FONT.sm, fontWeight: "600", color: C.sub }}> {unit}</Text>
      </Text>
      {delta != null && (
        <Text style={{ color: delta >= 0 ? C.accent : C.red, fontSize: FONT.xs, marginTop: 4, fontWeight: "600" }}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
        </Text>
      )}
    </View>
  )
}

function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14, marginTop: 22 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: FONT.lg, fontWeight: "800", letterSpacing: -0.3 }}>{title}</Text>
        {subtitle && <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ color: C.accent, fontSize: FONT.sm, fontWeight: "700" }}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function Badge({ label, color = C.accent }) {
  return (
    <View style={{ backgroundColor: color + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: color + "44" }}>
      <Text style={{ color: color, fontSize: FONT.xs, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
    </View>
  )
}

function ComingSoon({ icon = "🚧", label, sub }) {
  return (
    <View style={[ss.card, { padding: 28, alignItems: "center" }]}>
      <Text style={{ fontSize: 30, marginBottom: 10 }}>{icon}</Text>
      <Text style={{ color: C.text, fontWeight: "800", fontSize: FONT.md, textAlign: "center" }}>{label}</Text>
      {sub && <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 6, textAlign: "center" }}>{sub}</Text>}
    </View>
  )
}

function StatusDot({ status }) {
  const colors = { online: C.accent, warning: C.amber, offline: C.red, idle: C.muted }
  return (
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[status] || C.muted }} />
  )
}

function MiniBar({ value, max = 100, color = C.accent, height = 6 }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <View style={{ height, backgroundColor: C.border, borderRadius: 4, overflow: "hidden" }}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 4 }} />
    </View>
  )
}

function PulseIndicator({ color = C.accent }) {
  const anim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: anim }} />
}

// ─── Mini chart (bar sparkline) ────────────────────────────────────
function Sparkline({ data, color = C.accent, height = 48 }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap: 2 }}>
      {data.map((v, i) => {
        const h = ((v - min) / range) * (height - 6) + 6
        const isLast = i === data.length - 1
        return (
          <View key={i} style={{
            flex: 1,
            height: h,
            backgroundColor: isLast ? color : color + "55",
            borderRadius: 2,
          }} />
        )
      })}
    </View>
  )
}

// ─── Loading Screen ────────────────────────────────────────────────
function LoadingScreen() {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return (
    <View style={[ss.flex, ss.center, { backgroundColor: C.bg }]}>
      <Animated.View style={{ opacity: anim }}>
        <Text style={{ color: C.accent, fontSize: 36, fontWeight: "900", letterSpacing: -1 }}>⚡ Voltaris</Text>
      </Animated.View>
      <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 12 }}>Loading intelligence…</Text>
    </View>
  )
}

// ─── LOGIN ────────────────────────────────────────────────────────
function LoginScreen() {
  const auth = useAuth()
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const slideAnim = useRef(new Animated.Value(40)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start()
  }, [])

  const login = async () => {
    if (!email || !pass) { setError("Please enter credentials"); return }
    setLoading(true); setError("")
    try {
      const data = await api.login(email, pass)
      auth.login(data)
    } catch (e) {
      setError("Invalid credentials")
    } finally {
      setLoading(false)
    }
  }

  return (
    <LinearGradient colors={["#070d19", "#0a1628", "#070d19"]} style={ss.flex}>
      <SafeAreaView style={ss.flex} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 28 }}>
          <Animated.View style={{ opacity: opacityAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Logo */}
            <View style={{ alignItems: "center", marginBottom: 44 }}>
              <LinearGradient
                colors={["rgba(0,229,160,0.15)", "rgba(0,229,160,0.05)"]}
                style={{ width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.accent + "40", marginBottom: 20 }}>
                <Text style={{ fontSize: 38 }}>⚡</Text>
              </LinearGradient>
              <Text style={{ color: C.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 }}>VoltarisOS</Text>
              <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 5 }}>Energy Intelligence Platform</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
                <Badge label="v4.2" color={C.accent} />
                <Badge label="ENTERPRISE" color={C.blue} />
              </View>
            </View>

            {/* Form */}
            <View style={{ marginBottom: 20 }}>
              <Text style={ss.label}>Email</Text>
              <TextInput
                style={ss.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={C.muted}
                placeholder="you@company.com"
              />
              <Text style={[ss.label, { marginTop: 16 }]}>Password</Text>
              <TextInput
                style={ss.input}
                value={pass}
                onChangeText={setPass}
                secureTextEntry
                placeholderTextColor={C.muted}
                placeholder="••••••••"
              />
              {error ? <Text style={{ color: C.red, fontSize: FONT.sm, marginTop: 10, textAlign: "center" }}>{error}</Text> : null}
            </View>

            <TouchableOpacity onPress={login} disabled={loading}
              style={{ overflow: "hidden", borderRadius: 14, marginBottom: 24 }}>
              <LinearGradient colors={[C.accent, C.accentD]} style={{ paddingVertical: 16, alignItems: "center" }}>
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={{ color: "#000", fontWeight: "800", fontSize: FONT.base, letterSpacing: 0.3 }}>Sign In</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  )
}

// ─── HOME / DASHBOARD ─────────────────────────────────────────────
function HomeScreen({ navigation }) {
  const auth = useAuth()
  const [sites, setSites] = useState([])
  const [alerts, setAlerts] = useState([])
  const [gridPrice, setGridPrice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening"

  const { lastMessage: live, isConnected } = useWebSocket("/ws/dashboard")

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [sitesData, alertsData, priceData] = await Promise.all([
        api.getSites(),
        api.getAlerts(3),
        api.getDayAheadPrices(),
      ])
      setSites(sitesData || [])
      setAlerts(alertsData || [])
      const hourKey = `${String(new Date().getHours()).padStart(2, "0")}:00`
      const nowPrice = priceData?.prices?.find(p => p.hour === hourKey)
      setGridPrice(nowPrice ? nowPrice.price : null)
    } catch (e) {
      Alert.alert("Couldn't load dashboard", e.message || "Check your connection")
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingScreen />

  const online = sites.filter(s => s.status === "active").length
  const offline = sites.length - online

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} tintColor={C.accent} />}>
      <SafeAreaView edges={["top", "left", "right"]}>
        {/* Header */}
        <LinearGradient colors={["#0a1628", "#070d19"]} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.sub, fontSize: FONT.sm }}>{greeting},</Text>
              <Text style={{ color: C.text, fontSize: FONT.xl, fontWeight: "800", marginTop: 2 }}>
                {auth.user?.name || auth.user?.email?.split("@")[0] || "User"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <PulseIndicator color={C.accent} />
              <Badge label={displayRole(auth.user?.role)} color={isAdminRole(auth.user?.role) ? C.purple : C.blue} />
            </View>
          </View>

          {/* Live power widget */}
          <LinearGradient colors={["rgba(0,229,160,0.08)", "rgba(0,229,160,0.02)"]}
            style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.accent + "25" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <View>
                <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>Live Portfolio</Text>
                <Text style={{ color: C.accent, fontSize: 38, fontWeight: "900", letterSpacing: -1, marginTop: 4 }}>
                  {live?.total_power_kw != null ? live.total_power_kw.toFixed(0) : "—"}<Text style={{ fontSize: FONT.lg, color: C.sub }}> kW</Text>
                </Text>
                <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 3 }}>
                  {live?.avg_soc_pct != null ? `Avg SOC ${live.avg_soc_pct.toFixed(0)}% · ${live.device_count ?? 0} devices` : "Waiting for live data…"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Badge label={isConnected ? "LIVE" : "OFFLINE"} color={isConnected ? C.accent : C.muted} />
                <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 8 }}>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
            </View>
          </LinearGradient>
        </LinearGradient>

        {/* KPIs */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <KPI label="Grid Price" value={gridPrice != null ? gridPrice.toFixed(2) : "—"} unit="€/kWh" color={C.amber} />
            <KPI label="Active Alerts" value={alerts.length.toString()} unit="" color={alerts.length ? C.red : C.accent} />
          </View>

          {/* Sites overview */}
          <SectionHeader title="Sites" subtitle={`${online} active · ${offline} other`} action="View all" onAction={() => navigation.navigate("Energy")} />
          {sites.length === 0
            ? <ComingSoon icon="📍" label="No sites yet" sub="Sites you add in VoltarisOS will show up here." />
            : sites.map(site => (
              <View key={site.id} style={[ss.card, { marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
                <StatusDot status={site.status === "active" ? "online" : "warning"} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{site.name}</Text>
                  <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>
                    {site.location || "—"} · {site.solar_kw ? `${site.solar_kw}kW solar` : ""}{site.battery_kwh ? ` · ${site.battery_kwh}kWh battery` : ""}
                  </Text>
                </View>
                <Badge label={site.status} color={site.status === "active" ? C.accent : C.amber} />
              </View>
            ))}

          {/* Alerts preview */}
          <SectionHeader title="Active Alerts" subtitle="Most recent" action="Manage" onAction={() => navigation.navigate("Ops")} />
          {alerts.length === 0
            ? <View style={[ss.card, { alignItems: "center", padding: 20 }]}>
                <Text style={{ color: C.sub, fontSize: FONT.sm }}>No active alerts 🎉</Text>
              </View>
            : alerts.map(a => (
              <View key={a.id} style={[ss.card, { marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }]}>
                <Text style={{ fontSize: 16 }}>{a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.sm }}>{a.title}</Text>
                  <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{a.device_name || "—"} · {timeAgo(a.fired_at)}</Text>
                </View>
              </View>
            ))}
        </View>
        <View style={{ height: 32 }} />
      </SafeAreaView>
    </ScrollView>
  )
}

// ─── ENERGY SCREEN ────────────────────────────────────────────────
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

// ─── TRADING SCREEN ───────────────────────────────────────────────
function TradingScreen() {
  const [tab, setTab] = useState("market")
  const [groups, setGroups] = useState(null)

  useEffect(() => {
    api.getVPPGroups().then(setGroups).catch(() => setGroups([]))
  }, [])

  const selectedVppId = groups?.[0]?.id

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={ss.pageTitle}>Trading</Text>
          <Text style={ss.pageSubtitle}>Day-ahead market · VPP bidding</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
          {[{ id: "market", label: "Market" }, { id: "vpp", label: "VPP" }, { id: "bids", label: "Bids" }, { id: "pnl", label: "P&L" }].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
              style={[ss.tabPill, tab === t.id && ss.tabPillActive]}>
              <Text style={[ss.tabPillText, tab === t.id && ss.tabPillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {tab === "market" && <MarketTab vppId={selectedVppId} />}
          {tab === "vpp" && <VPPTab groups={groups} />}
          {tab === "bids" && <BidsTab vppId={selectedVppId} />}
          {tab === "pnl" && <PnLTab vppId={selectedVppId} />}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function MarketTab({ vppId }) {
  const [prices, setPrices] = useState(null)
  const [perf, setPerf] = useState(null)

  useEffect(() => {
    api.getDayAheadPrices().then(d => setPrices(d?.prices || [])).catch(() => setPrices([]))
  }, [])
  useEffect(() => {
    if (vppId) api.getVppPerformance(vppId).then(setPerf).catch(() => setPerf(null))
  }, [vppId])

  if (!prices) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  const values = prices.map(p => p.price)
  const maxP = values.length ? Math.max(...values) : 0
  const minP = values.length ? Math.min(...values) : 0
  const nowHour = `${String(new Date().getHours()).padStart(2, "0")}:00`
  const nowIdx = prices.findIndex(p => p.hour === nowHour)
  const currentPrice = nowIdx >= 0 ? prices[nowIdx].price : null

  return (
    <View>
      <LinearGradient colors={["rgba(245,158,11,0.12)", "rgba(245,158,11,0.02)"]}
        style={{ borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.amber + "30", marginBottom: 16 }}>
        <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>Current Spot Price</Text>
        <Text style={{ color: C.amber, fontSize: 52, fontWeight: "900", letterSpacing: -2, marginTop: 6 }}>
          {currentPrice != null ? currentPrice.toFixed(2) : "—"}<Text style={{ fontSize: FONT.lg, color: C.sub }}> €/kWh</Text>
        </Text>
        <Text style={{ color: C.amber + "99", fontSize: FONT.sm, marginTop: 4 }}>{nowHour} · day-ahead</Text>

        {values.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 72 }}>
              {prices.map((p, i) => {
                const h = maxP > minP ? ((p.price - minP) / (maxP - minP)) * 56 + 8 : 30
                const isNow = i === nowIdx
                return (
                  <View key={i} style={{
                    flex: 1, height: h,
                    backgroundColor: isNow ? C.accent : C.amber + "66",
                    borderRadius: 2,
                  }} />
                )
              })}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>{prices[0]?.hour}</Text>
              <Text style={{ color: C.accent, fontSize: FONT.xs }}>NOW</Text>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>{prices[prices.length - 1]?.hour}</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <KPI label={`P&L (${perf?.period_days ?? 30}d)`} value={perf ? `€${perf.total_pnl_eur.toFixed(0)}` : "—"} unit="" color={C.accent} />
        <KPI label="Total Bids" value={perf ? perf.total_bids.toString() : "—"} unit="" color={C.blue} />
        <KPI label="Accepted" value={perf ? `${perf.acceptance_rate_pct}%` : "—"} unit="" color={C.accent} />
      </View>
    </View>
  )
}

function VPPTab({ groups }) {
  const [aggregates, setAggregates] = useState({})

  useEffect(() => {
    if (!groups?.length) return
    groups.forEach(g => {
      api.getVppAggregate(g.id).then(a => setAggregates(prev => ({ ...prev, [g.id]: a }))).catch(() => {})
    })
  }, [groups])

  if (!groups) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
  if (!groups.length) return <ComingSoon icon="🔗" label="No VPP groups yet" sub="Create a Virtual Power Plant group in VoltarisOS to see it here." />

  return (
    <View>
      <SectionHeader title="VPP Groups" subtitle="Virtual Power Plant aggregation" />
      {groups.map(g => {
        const agg = aggregates[g.id]
        return (
          <View key={g.id} style={[ss.card, { marginBottom: 10 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{g.name}</Text>
                <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{agg?.site_count ?? 0} sites · {g.market}</Text>
              </View>
              <Badge label={g.active ? "active" : "inactive"} color={g.active ? C.accent : C.muted} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: FONT.xs }}>Power</Text>
                <Text style={{ color: C.accent, fontWeight: "800", fontSize: FONT.lg }}>{agg?.total_power_kw != null ? `${agg.total_power_kw} kW` : "—"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: FONT.xs }}>Min bid</Text>
                <Text style={{ color: C.blue, fontWeight: "800", fontSize: FONT.lg }}>{g.min_bid_kw} kW</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: FONT.xs }}>Can bid</Text>
                <Text style={{ color: agg?.can_bid ? C.accent : C.muted, fontWeight: "800", fontSize: FONT.lg }}>{agg ? (agg.can_bid ? "Yes" : "No") : "—"}</Text>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function BidsTab({ vppId }) {
  const [bids, setBids] = useState(null)

  useEffect(() => {
    if (!vppId) { setBids([]); return }
    api.getVppBids(vppId).then(setBids).catch(() => setBids([]))
  }, [vppId])

  if (!bids) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
  if (!bids.length) return <ComingSoon icon="📋" label="No bids yet" sub="Bids submitted for this VPP group will show up here." />

  return (
    <View>
      <SectionHeader title="Bids" subtitle={`${bids.length} total`} />
      {bids.map(b => (
        <View key={b.id} style={[ss.card, { marginBottom: 8, flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md, textTransform: "capitalize" }}>{b.direction} · {b.market}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{b.status} · {new Date(b.submitted_at).toLocaleDateString()}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: (b.pnl_eur ?? 0) >= 0 ? C.accent : C.red, fontWeight: "800", fontSize: FONT.md }}>
              {b.pnl_eur != null ? `${b.pnl_eur >= 0 ? "+" : ""}€${b.pnl_eur.toFixed(0)}` : "—"}
            </Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{b.quantity_kw} kW{b.price_eur_mwh != null ? ` @ €${b.price_eur_mwh}/MWh` : ""}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function PnLTab({ vppId }) {
  const [perf, setPerf] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!vppId) { setLoading(false); return }
    api.getVppPerformance(vppId).then(setPerf).catch(() => {}).finally(() => setLoading(false))
  }, [vppId])

  if (loading) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
  if (!perf) return <ComingSoon icon="💹" label="No P&L data yet" sub="Once this VPP group has accepted bids, P&L shows here." />

  return (
    <View>
      <LinearGradient colors={["rgba(0,229,160,0.10)", "rgba(0,229,160,0.02)"]}
        style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.accent + "25", marginBottom: 16 }}>
        <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>P&L — last {perf.period_days} days</Text>
        <Text style={{ color: C.accent, fontSize: 42, fontWeight: "900", letterSpacing: -1 }}>€{(perf.total_pnl_eur / 1000).toFixed(1)}K</Text>
        <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 4 }}>{perf.accepted} of {perf.total_bids} bids accepted · avg €{perf.avg_pnl_per_bid_eur.toFixed(0)}/bid</Text>
      </LinearGradient>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <KPI label="Total kWh" value={perf.total_kwh.toFixed(0)} unit="kWh" color={C.blue} />
        <KPI label="Acceptance" value={`${perf.acceptance_rate_pct}%`} unit="" color={C.accent} />
      </View>
    </View>
  )
}

// ─── OPERATIONS SCREEN ────────────────────────────────────────────
function OpsScreen() {
  const [tab, setTab] = useState("alerts")

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={ss.pageTitle}>Operations</Text>
          <Text style={ss.pageSubtitle}>Monitoring · Maintenance · Compliance</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
          {[
            { id: "alerts", label: "Alerts" },
            { id: "maintenance", label: "Maintenance" },
            { id: "anomaly", label: "Anomaly" },
            { id: "reports", label: "Reports" },
          ].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
              style={[ss.tabPill, tab === t.id && ss.tabPillActive]}>
              <Text style={[ss.tabPillText, tab === t.id && ss.tabPillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {tab === "alerts" && <AlertsTab />}
          {tab === "maintenance" && <MaintenanceTab />}
          {tab === "anomaly" && <AnomalyTab />}
          {tab === "reports" && <ReportsTab />}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function AlertsTab() {
  const [filter, setFilter] = useState("all")
  const [alerts, setAlerts] = useState(null)

  const load = useCallback(() => {
    api.getAlerts(50).then(setAlerts).catch(() => setAlerts([]))
  }, [])
  useEffect(() => { load() }, [load])

  const ack = async (id) => {
    try {
      await api.ackAlert(id)
      load()
    } catch (e) {
      Alert.alert("Couldn't acknowledge alert", e.message || "")
    }
  }

  if (!alerts) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  const filtered = filter === "all" ? alerts : alerts.filter(a => a.severity === filter)

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {["all", "critical", "warning", "info"].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[ss.tabPill, filter === f && ss.tabPillActive, { flex: 1 }]}>
            <Text style={[ss.tabPillText, filter === f && ss.tabPillTextActive, { textTransform: "capitalize", fontSize: FONT.xs }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Critical" value={alerts.filter(a => a.severity === "critical").length.toString()} unit="" color={C.red} />
        <KPI label="Warning" value={alerts.filter(a => a.severity === "warning").length.toString()} unit="" color={C.amber} />
        <KPI label="Info" value={alerts.filter(a => a.severity === "info").length.toString()} unit="" color={C.blue} />
      </View>
      {filtered.length === 0 && (
        <View style={[ss.card, { alignItems: "center", padding: 20 }]}>
          <Text style={{ color: C.sub, fontSize: FONT.sm }}>No alerts 🎉</Text>
        </View>
      )}
      {filtered.map(a => (
        <TouchableOpacity key={a.id} disabled={a.acknowledged} onPress={() => ack(a.id)}
          style={[ss.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: a.severity === "critical" ? C.red : a.severity === "warning" ? C.amber : C.blue, opacity: a.acknowledged ? 0.5 : 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontSize: 14, marginRight: 8 }}>{a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵"}</Text>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md, flex: 1 }}>{a.title}</Text>
            <Badge label={a.acknowledged ? "acked" : a.severity} color={a.acknowledged ? C.muted : a.severity === "critical" ? C.red : a.severity === "warning" ? C.amber : C.blue} />
          </View>
          {a.message && <Text style={{ color: C.sub, fontSize: FONT.xs }}>{a.message}</Text>}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>{a.device_name || "—"}</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>{timeAgo(a.fired_at)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function MaintenanceTab() {
  const [schedule, setSchedule] = useState(null)

  useEffect(() => {
    api.getMaintenanceSchedule().then(d => setSchedule(d?.schedule || [])).catch(() => setSchedule([]))
  }, [])

  if (!schedule) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  const corrective = schedule.filter(t => t.type === "corrective").length
  const inspection = schedule.filter(t => t.type === "inspection").length
  const scheduled = schedule.filter(t => t.type === "scheduled").length

  if (!schedule.length) return <ComingSoon icon="🛠️" label="Nothing due" sub="No maintenance items right now — great sign." />

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Corrective" value={corrective.toString()} unit="" color={C.red} />
        <KPI label="Inspection" value={inspection.toString()} unit="" color={C.amber} />
        <KPI label="Scheduled" value={scheduled.toString()} unit="" color={C.blue} />
      </View>
      {schedule.map(t => (
        <View key={t.id} style={[ss.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{t.asset_name || "Unknown asset"}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{t.site || "—"} · {t.type}</Text>
            </View>
            <Badge label={t.severity} color={t.severity === "critical" ? C.red : t.severity === "warning" ? C.amber : C.muted} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.sub, fontSize: FONT.xs }}>Due: {t.due_date}</Text>
            <Text style={{ color: t.days_remaining <= 0 ? C.red : C.blue, fontSize: FONT.xs, fontWeight: "600" }}>{t.days_remaining}d remaining</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function AnomalyTab() {
  return (
    <ComingSoon icon="🧠" label="ML anomaly detection — coming soon"
      sub="No anomaly-detection model is wired into the backend yet." />
  )
}

function ReportsTab() {
  return (
    <ComingSoon icon="📄" label="Reports — coming soon"
      sub="Report generation isn't available in the backend yet." />
  )
}

// ─── INVESTOR SCREEN ──────────────────────────────────────────────
function InvestorScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1, justifyContent: "center" }}>
          <View style={{ marginBottom: 24 }}>
            <Text style={ss.pageTitle}>Investor Dashboard</Text>
            <Text style={ss.pageSubtitle}>Portfolio performance</Text>
          </View>
          <ComingSoon icon="💼" label="Investor reporting is in development"
            sub="Portfolio value, IRR and asset-breakdown metrics need real financial data behind them — nothing is shown until that's built." />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─── ADMIN SCREEN ─────────────────────────────────────────────────
function AdminScreen({ navigation }) {
  const auth = useAuth()
  const [tab, setTab] = useState("users")

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={ss.pageTitle}>Admin Panel</Text>
          <Text style={ss.pageSubtitle}>Tenant management & system config</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
          {[
            { id: "users", label: "Users" },
            { id: "system", label: "System" },
            { id: "api", label: "API Keys" },
            { id: "audit", label: "Audit" },
          ].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
              style={[ss.tabPill, tab === t.id && ss.tabPillActive]}>
              <Text style={[ss.tabPillText, tab === t.id && ss.tabPillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {tab === "users" && <UsersAdminTab />}
          {tab === "system" && <SystemTab />}
          {tab === "api" && <APIKeysTab />}
          {tab === "audit" && <AuditTab />}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function UsersAdminTab() {
  const [users, setUsers] = useState(null)

  useEffect(() => {
    api.getUsers().then(data => setUsers(data?.users || data || [])).catch(() => setUsers([]))
  }, [])

  const roleColor = (r) => (r === "SUPER_ADMIN" ? C.purple : r === "TENANT_ADMIN" ? C.blue : C.muted)

  if (!users) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Total Users" value={users.length.toString()} unit="" color={C.accent} />
        <KPI label="Active" value={users.filter(u => u.active !== false).length.toString()} unit="" color={C.blue} />
      </View>
      {users.map((u, i) => (
        <View key={u.id || i} style={[ss.card, { marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: roleColor(u.role) + "22", borderWidth: 1, borderColor: roleColor(u.role) + "44", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
            <Text style={{ color: roleColor(u.role), fontWeight: "800", fontSize: FONT.md }}>{(u.name || u.email || "?")[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{u.name || u.email}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{u.email}</Text>
          </View>
          <Badge label={displayRole(u.role)} color={roleColor(u.role)} />
        </View>
      ))}
    </View>
  )
}

function SystemTab() {
  const [settingsData, setSettingsData] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getTenantSettings().then(setSettingsData).catch(() => setSettingsData({}))
  }, [])

  const toggle = async (block, key, value) => {
    const next = { ...settingsData, [block]: { ...(settingsData[block] || {}), [key]: value } }
    setSettingsData(next)
    setSaving(true)
    try {
      await api.updateTenantSettings({ [block]: next[block] })
    } catch (e) {
      Alert.alert("Couldn't save setting", e.message || "")
    } finally {
      setSaving(false)
    }
  }

  if (!settingsData) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  const settings = [
    { label: "Push Notifications", sub: "Real-time alerts on mobile", value: !!settingsData.notifications?.pushAlerts, onChange: (v) => toggle("notifications", "pushAlerts", v), color: C.accent },
    { label: "Autonomous Trading", sub: "AI-driven market execution", value: !!settingsData.trading?.autoTradingEnabled, onChange: (v) => toggle("trading", "autoTradingEnabled", v), color: C.blue },
  ]

  return (
    <View>
      <SectionHeader title="System Settings" subtitle={saving ? "Saving…" : "Platform configuration"} />
      {settings.map((s, i) => (
        <View key={i} style={[ss.card, { marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{s.label}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{s.sub}</Text>
          </View>
          <Switch value={s.value} onValueChange={s.onChange} trackColor={{ false: C.border, true: s.color + "66" }} thumbColor={s.value ? s.color : C.muted} />
        </View>
      ))}

      <SectionHeader title="Platform Info" />
      {[
        { label: "App Version", value: APP_VERSION },
        { label: "API", value: "Railway · production" },
      ].map((item, i) => (
        <View key={i} style={[ss.card, { marginBottom: 8, flexDirection: "row", alignItems: "center" }]}>
          <Text style={{ color: C.sub, fontSize: FONT.md, flex: 1 }}>{item.label}</Text>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{item.value}</Text>
        </View>
      ))}
    </View>
  )
}

function APIKeysTab() {
  const [keys, setKeys] = useState(null)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [justCreated, setJustCreated] = useState(null)

  const load = useCallback(() => {
    api.getApiKeys().then(setKeys).catch(() => setKeys([]))
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await api.createApiKey({ name: newName.trim() })
      setJustCreated(created.key)
      setNewName("")
      load()
    } catch (e) {
      Alert.alert("Couldn't create key", e.message || "")
    } finally {
      setCreating(false)
    }
  }

  const revoke = (id) => {
    Alert.alert("Revoke key?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Revoke", style: "destructive", onPress: async () => {
        try { await api.revokeApiKey(id); load() }
        catch (e) { Alert.alert("Couldn't revoke key", e.message || "") }
      }},
    ])
  }

  if (!keys) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  return (
    <View>
      <SectionHeader title="API Keys" subtitle="Manage access tokens" />
      {justCreated && (
        <View style={[ss.card, { marginBottom: 12, borderColor: C.accent + "44" }]}>
          <Text style={{ color: C.accent, fontWeight: "700", fontSize: FONT.sm, marginBottom: 6 }}>New key — copy it now, it won't be shown again</Text>
          <Text style={{ color: C.text, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: FONT.xs }}>{justCreated}</Text>
        </View>
      )}
      {keys.length === 0 && (
        <View style={[ss.card, { alignItems: "center", padding: 20, marginBottom: 12 }]}>
          <Text style={{ color: C.sub, fontSize: FONT.sm }}>No API keys yet</Text>
        </View>
      )}
      {keys.map(k => (
        <View key={k.id} style={[ss.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{k.name}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{k.key_prefix}••••••••</Text>
            </View>
            <TouchableOpacity onPress={() => revoke(k.id)}>
              <Text style={{ color: C.red, fontWeight: "700", fontSize: FONT.xs }}>Revoke</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: C.muted, fontSize: FONT.xs }}>
            Created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at ? ` · last used ${timeAgo(k.last_used_at)}` : " · never used"}
          </Text>
        </View>
      ))}
      <View style={[ss.card, { marginTop: 8, flexDirection: "row", gap: 8, alignItems: "center" }]}>
        <TextInput style={[ss.input, { flex: 1, paddingVertical: 10 }]} value={newName} onChangeText={setNewName}
          placeholder="Key name" placeholderTextColor={C.muted} />
        <TouchableOpacity onPress={create} disabled={creating || !newName.trim()}
          style={[ss.btn, { backgroundColor: C.accentL, borderColor: C.accent + "44" }]}>
          {creating ? <ActivityIndicator color={C.accent} size="small" /> : <Text style={{ color: C.accent, fontWeight: "700" }}>Create</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function AuditTab() {
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    api.getAuditLog({ limit: 50 }).then(d => setEntries(d?.entries || [])).catch(() => setEntries([]))
  }, [])

  if (!entries) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
  if (!entries.length) return <ComingSoon icon="📜" label="No audit entries yet" />

  return (
    <View>
      <SectionHeader title="Audit Log" subtitle="Security & compliance trail" />
      {entries.map(l => (
        <View key={l.id} style={[ss.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: C.accent }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md, flex: 1 }}>{l.action}</Text>
            {l.target_resource && <Badge label={l.target_resource} color={C.blue} />}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.sub, fontSize: FONT.xs }}>{l.user_email || "—"}</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>{timeAgo(l.timestamp)}</Text>
          </View>
          {l.ip_address && (
            <Text style={{ color: C.muted, fontSize: FONT.xs, marginTop: 4, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{l.ip_address}</Text>
          )}
        </View>
      ))}
    </View>
  )
}

// ─── PROFILE SCREEN ───────────────────────────────────────────────
function ProfileScreen() {
  const auth = useAuth()
  const u = auth.user

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Avatar */}
          <View style={{ alignItems: "center", marginBottom: 32, marginTop: 12 }}>
            <LinearGradient
              colors={["rgba(0,229,160,0.18)", "rgba(59,130,246,0.12)"]}
              style={{ width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: C.accent + "40", marginBottom: 16 }}>
              <Text style={{ color: C.accent, fontSize: 36, fontWeight: "900" }}>
                {(u?.name || u?.email || "?")[0].toUpperCase()}
              </Text>
            </LinearGradient>
            <Text style={{ color: C.text, fontSize: FONT.xl, fontWeight: "800" }}>{u?.name || "User"}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 4 }}>{u?.email}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Badge label={displayRole(u?.role)} color={isAdminRole(u?.role) ? C.purple : C.blue} />
              <Badge label="Active" color={C.accent} />
            </View>
          </View>

          {/* Info cards */}
          {[
            { label: "Role", value: displayRole(u?.role) },
            ...(u?.company ? [{ label: "Company", value: u.company }] : []),
            ...(u?.plan ? [{ label: "Plan", value: u.plan }] : []),
          ].map((item, i) => (
            <View key={i} style={[ss.card, { marginBottom: 8, flexDirection: "row", alignItems: "center" }]}>
              <Text style={{ color: C.sub, fontSize: FONT.md, flex: 1 }}>{item.label}</Text>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{item.value}</Text>
            </View>
          ))}

          <TouchableOpacity onPress={auth.logout}
            style={[ss.btn, { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.3)", marginTop: 24 }]}>
            <Text style={{ color: C.red, fontWeight: "700", fontSize: FONT.base }}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─── TAB ICONS ────────────────────────────────────────────────────
function TabIcon({ name, focused }) {
  const icons = {
    Home:     { active: "⚡", inactive: "⚡" },
    Energy:   { active: "🔋", inactive: "🔋" },
    Trading:  { active: "📈", inactive: "📈" },
    Ops:      { active: "🛠️", inactive: "🛠️" },
    Admin:    { active: "👑", inactive: "👑" },
    Investor: { active: "💰", inactive: "💰" },
    Profile:  { active: "👤", inactive: "👤" },
  }
  const icon = icons[name] || { active: "•", inactive: "•" }
  return (
    <View style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icon.active}</Text>
      {focused && (
        <View style={{ position: "absolute", bottom: -4, width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
      )}
    </View>
  )
}

// ─── TAB NAVIGATOR ────────────────────────────────────────────────
const Tab = createBottomTabNavigator()

function tabOptions(name) {
  return {
    tabBarIcon: ({ focused }) => <TabIcon name={name} focused={focused} />,
  }
}

function MainApp() {
  const auth = useAuth()
  const role = auth.user?.role || "TENANT_MEMBER"
  const isAdmin = isAdminRole(role)

  const tabBarStyle = {
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    height: Platform.OS === "ios" ? 90 : 72,
    paddingBottom: Platform.OS === "ios" ? 24 : 14,
    paddingTop: 10,
  }

  const screenOptions = ({ route }) => ({
    headerStyle: { backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, elevation: 0, shadowOpacity: 0 },
    headerTintColor: C.text,
    headerTitleStyle: { fontWeight: "800", fontSize: FONT.lg, color: C.text },
    headerShown: false,
    tabBarStyle,
    tabBarActiveTintColor: C.accent,
    tabBarInactiveTintColor: C.muted,
    tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  })

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      {/* Every authenticated user (only real roles are SUPER_ADMIN/TENANT_ADMIN/TENANT_MEMBER) */}
      <Tab.Screen name="Home" component={HomeScreen} options={tabOptions("Home")} />
      <Tab.Screen name="Energy" component={EnergyScreen} options={tabOptions("Energy")} />
      <Tab.Screen name="Trading" component={TradingScreen} options={tabOptions("Trading")} />
      <Tab.Screen name="Ops" component={OpsScreen} options={tabOptions("Ops")} />

      {/* Admin-only (SUPER_ADMIN / TENANT_ADMIN) */}
      {isAdmin && (
        <Tab.Screen name="Admin" component={AdminScreen} options={tabOptions("Admin")} />
      )}
      {isAdmin && (
        <Tab.Screen name="Investor" component={InvestorScreen} options={tabOptions("Investor")} />
      )}

      {/* Profile always last */}
      <Tab.Screen name="Profile" component={ProfileScreen} options={tabOptions("Profile")} />
    </Tab.Navigator>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(null)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const token = await api.getStoredToken()
        const user = await api.getStoredUser()
        if (token && user) setAuth({ token, ...user })
      } finally {
        setRestoring(false)
      }
    })()
  }, [])

  const authValue = {
    token: auth?.token,
    user: auth,
    login: (data) => setAuth(data),
    logout: () => { api.logout(); setAuth(null) },
  }

  if (restoring) return <LoadingScreen />

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthCtx.Provider value={authValue}>
        <NavigationContainer
          theme={{
            dark: true,
            colors: {
              primary: C.accent,
              background: C.bg,
              card: C.card,
              text: C.text,
              border: C.border,
              notification: C.red,
            },
          }}
        >
          {auth ? <MainApp /> : <LoginScreen />}
        </NavigationContainer>
      </AuthCtx.Provider>
    </SafeAreaProvider>
  )
}

// ─── Shared Styles ────────────────────────────────────────────────
const ss = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  pageTitle: { color: C.text, fontSize: FONT["2xl"], fontWeight: "900", letterSpacing: -0.6 },
  pageSubtitle: { color: C.sub, fontSize: FONT.sm, marginTop: 4 },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    color: C.text,
    fontSize: FONT.base,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    color: C.sub,
    fontSize: FONT.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tabPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 50,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabPillActive: {
    backgroundColor: C.accentL,
    borderColor: C.accent + "44",
  },
  tabPillText: {
    color: C.sub,
    fontSize: FONT.sm,
    fontWeight: "700",
  },
  tabPillTextActive: {
    color: C.accent,
  },
})
