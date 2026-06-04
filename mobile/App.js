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

// ─── API ──────────────────────────────────────────────────────────
const API_BASE = "https://voltarisos-production.up.railway.app/api"

async function apiFetch(path, opts = {}, token) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  try {
    const r = await fetch(`${API_BASE}${path}`, { ...opts, headers })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  } catch (e) {
    throw e
  }
}

// ─── Role permissions ─────────────────────────────────────────────
const ROLE_TABS = {
  admin:    ["home", "energy", "trading", "ops", "admin"],
  operator: ["home", "energy", "trading", "ops"],
  viewer:   ["home", "energy", "viewer"],
  investor: ["home", "investor"],
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
  const [email, setEmail] = useState("admin@voltaris.com")
  const [pass, setPass] = useState("admin123")
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
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: pass }),
      })
      auth.login(data)
    } catch (e) {
      setError("Invalid credentials. Try admin@voltaris.com / admin123")
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (role) => {
    const creds = {
      admin: ["admin@voltaris.com", "admin123"],
      operator: ["operator@voltaris.com", "op123"],
      viewer: ["viewer@voltaris.com", "view123"],
      investor: ["investor@voltaris.com", "inv123"],
    }
    const [e, p] = creds[role]
    setEmail(e); setPass(p)
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

            {/* Quick access */}
            <View style={[ss.card, { padding: 16 }]}>
              <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, textAlign: "center" }}>Quick Access</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {["admin", "operator", "viewer", "investor"].map(r => (
                  <TouchableOpacity key={r} onPress={() => quickLogin(r)}
                    style={{ flex: 1, minWidth: "40%", backgroundColor: C.card2, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 10, alignItems: "center" }}>
                    <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "700", textTransform: "capitalize" }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  )
}

// ─── HOME / DASHBOARD ─────────────────────────────────────────────
function HomeScreen({ navigation }) {
  const auth = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening"

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const d = await apiFetch("/dashboard/summary", {}, auth.token)
      setData(d)
    } catch {
      setData(mockDashboard())
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [auth.token])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingScreen />

  const d = data || mockDashboard()
  const powerData = [42, 38, 45, 55, 60, 58, 72, 80, 75, 68, 70, 65, 58, 52, 60, 68, 75, 80, 72, 65, 55, 48, 42, 38]
  const now = new Date().getHours()

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
              <Badge label={auth.user?.role || "operator"} color={auth.user?.role === "admin" ? C.purple : C.blue} />
            </View>
          </View>

          {/* Live power widget */}
          <LinearGradient colors={["rgba(0,229,160,0.08)", "rgba(0,229,160,0.02)"]}
            style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.accent + "25" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <View>
                <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>Live Portfolio</Text>
                <Text style={{ color: C.accent, fontSize: 38, fontWeight: "900", letterSpacing: -1, marginTop: 4 }}>
                  {d.total_power_kw?.toFixed(0) || "1,847"}<Text style={{ fontSize: FONT.lg, color: C.sub }}> kW</Text>
                </Text>
                <Text style={{ color: C.accent + "99", fontSize: FONT.sm, marginTop: 3 }}>▲ 12.4% vs yesterday</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Badge label="LIVE" color={C.accent} />
                <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 8 }}>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
            </View>
            <Sparkline data={powerData.slice(Math.max(0, now - 11), now + 1)} color={C.accent} height={52} />
          </LinearGradient>
        </LinearGradient>

        {/* KPIs */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <KPI label="Revenue" value={`€${d.revenue_today?.toFixed(0) || "8,240"}`} unit="" color={C.accent} delta={8} />
            <KPI label="SOC" value={d.battery_soc?.toFixed(0) || "74"} unit="%" color={C.blue} delta={3} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <KPI label="Grid Price" value={`€${d.grid_price?.toFixed(0) || "68"}`} unit="/MWh" color={C.amber} />
            <KPI label="CO₂ Saved" value={d.co2_saved?.toFixed(1) || "4.2"} unit="t" color={C.accent} delta={5} />
          </View>

          {/* Sites overview */}
          <SectionHeader title="Sites" subtitle={`${d.sites_online || 12} online · ${d.sites_offline || 2} offline`} action="View all" />
          {mockSites().map(site => (
            <View key={site.id} style={[ss.card, { marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
              <StatusDot status={site.status} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{site.name}</Text>
                <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{site.location} · {site.type}</Text>
                <MiniBar value={site.power} max={site.capacity} color={site.status === "online" ? C.accent : C.amber} height={5} />
              </View>
              <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
                <Text style={{ color: site.status === "online" ? C.accent : C.amber, fontWeight: "800", fontSize: FONT.md }}>{site.power} kW</Text>
                <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{Math.round(site.power / site.capacity * 100)}%</Text>
              </View>
            </View>
          ))}

          {/* Alerts preview */}
          <SectionHeader title="Active Alerts" subtitle="Last 24 hours" action="Manage" />
          {mockAlerts().slice(0, 3).map(a => (
            <View key={a.id} style={[ss.card, { marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }]}>
              <Text style={{ fontSize: 16 }}>{a.level === "critical" ? "🔴" : a.level === "warning" ? "🟡" : "🔵"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.sm }}>{a.title}</Text>
                <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{a.site} · {a.time}</Text>
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
  const batteries = mockBatteries()
  const totalSOC = batteries.reduce((a, b) => a + b.soc, 0) / batteries.length

  return (
    <View>
      {/* Fleet overview */}
      <LinearGradient colors={["rgba(59,130,246,0.12)", "rgba(59,130,246,0.04)"]}
        style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.blue + "30", marginBottom: 16 }}>
        <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Fleet Average SOC</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
          <Text style={{ color: C.blue, fontSize: 44, fontWeight: "900", letterSpacing: -1 }}>{totalSOC.toFixed(0)}%</Text>
          <Text style={{ color: C.sub, fontSize: FONT.sm, marginBottom: 10 }}>avg across {batteries.length} units</Text>
        </View>
        <MiniBar value={totalSOC} max={100} color={C.blue} height={10} />
      </LinearGradient>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Charging" value="4" unit="units" color={C.accent} />
        <KPI label="Discharging" value="3" unit="units" color={C.amber} />
        <KPI label="Idle" value="2" unit="units" color={C.muted} />
      </View>

      {batteries.map(b => (
        <View key={b.id} style={[ss.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{b.name}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{b.site} · {b.capacity} kWh</Text>
            </View>
            <Badge label={b.mode} color={b.mode === "charging" ? C.accent : b.mode === "discharging" ? C.amber : C.muted} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: C.accent, fontWeight: "800", fontSize: FONT.xl }}>{b.soc}%</Text>
            <Text style={{ color: C.sub, fontSize: FONT.sm }}>{b.power > 0 ? "+" : ""}{b.power} kW</Text>
          </View>
          <MiniBar value={b.soc} max={100} color={b.soc > 60 ? C.accent : b.soc > 30 ? C.amber : C.red} height={7} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ color: C.sub, fontSize: FONT.xs }}>Temp: {b.temp}°C</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs }}>Health: {b.health}%</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs }}>{b.cycles} cycles</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function EVTab() {
  const evs = mockEVs()
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Charging" value="18" unit="EVs" color={C.accent} />
        <KPI label="Total V2G" value="142" unit="kW" color={C.blue} />
      </View>
      {evs.map(ev => (
        <View key={ev.id} style={[ss.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{ev.plate}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{ev.model} · Bay {ev.bay}</Text>
            </View>
            <Badge label={ev.status} color={ev.status === "charging" ? C.accent : ev.status === "v2g" ? C.blue : C.muted} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: C.accent, fontWeight: "800", fontSize: FONT.xl }}>{ev.soc}%</Text>
            <Text style={{ color: C.sub, fontSize: FONT.sm }}>ETA: {ev.eta}</Text>
          </View>
          <MiniBar value={ev.soc} max={100} color={ev.soc > 60 ? C.accent : C.amber} height={7} />
        </View>
      ))}
    </View>
  )
}

function GridTab() {
  const data = [68, 72, 65, 80, 88, 75, 62, 58, 54, 60, 72, 85]
  return (
    <View>
      <LinearGradient colors={["rgba(245,158,11,0.12)", "rgba(245,158,11,0.02)"]}
        style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.amber + "30", marginBottom: 16 }}>
        <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Day-Ahead Price</Text>
        <Text style={{ color: C.amber, fontSize: 44, fontWeight: "900", letterSpacing: -1 }}>€68<Text style={{ fontSize: FONT.lg, color: C.sub }}>/MWh</Text></Text>
        <Text style={{ color: C.amber + "99", fontSize: FONT.sm, marginTop: 6 }}>▼ 8.2% vs yesterday · EPEX SPOT</Text>
        <View style={{ marginTop: 14 }}>
          <Sparkline data={data} color={C.amber} height={56} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>00:00</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>12:00</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>23:00</Text>
          </View>
        </View>
      </LinearGradient>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Frequency" value="50.02" unit="Hz" color={C.accent} />
        <KPI label="Voltage" value="232" unit="V" color={C.blue} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <KPI label="Export" value="284" unit="kW" color={C.accent} />
        <KPI label="Import" value="0" unit="kW" color={C.muted} />
      </View>
    </View>
  )
}

function ForecastTab() {
  const forecast = [
    { hour: "Now", load: 1847, solar: 620, wind: 340 },
    { hour: "01:00", load: 1620, solar: 0, wind: 380 },
    { hour: "02:00", load: 1480, solar: 0, wind: 420 },
    { hour: "06:00", load: 1800, solar: 180, wind: 310 },
    { hour: "12:00", load: 2100, solar: 890, wind: 280 },
    { hour: "18:00", load: 2350, solar: 340, wind: 350 },
    { hour: "22:00", load: 1950, solar: 0, wind: 400 },
  ]
  return (
    <View>
      <SectionHeader title="48h Load Forecast" subtitle="AI-generated · 94.2% accuracy" />
      {forecast.map((f, i) => (
        <View key={i} style={[ss.card, { marginBottom: 8, flexDirection: "row", alignItems: "center" }]}>
          <Text style={{ color: C.sub, fontSize: FONT.xs, width: 48, fontWeight: "600" }}>{f.hour}</Text>
          <View style={{ flex: 1, marginLeft: 12, gap: 5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: C.muted, fontSize: FONT.xs, width: 40 }}>Load</Text>
              <View style={{ flex: 1 }}>
                <MiniBar value={f.load} max={2500} color={C.blue} height={5} />
              </View>
              <Text style={{ color: C.blue, fontSize: FONT.xs, width: 44, textAlign: "right" }}>{f.load}kW</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: C.muted, fontSize: FONT.xs, width: 40 }}>Solar</Text>
              <View style={{ flex: 1 }}>
                <MiniBar value={f.solar} max={1000} color={C.amber} height={5} />
              </View>
              <Text style={{ color: C.amber, fontSize: FONT.xs, width: 44, textAlign: "right" }}>{f.solar}kW</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── TRADING SCREEN ───────────────────────────────────────────────
function TradingScreen() {
  const [tab, setTab] = useState("market")
  const prices = [42, 38, 35, 51, 68, 85, 72, 62, 58, 71, 88, 95, 82, 67, 54, 48, 62, 78, 91, 84, 69, 58, 47, 39]
  const currentHour = new Date().getHours()
  const currentPrice = prices[currentHour]

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={ss.pageTitle}>Trading</Text>
          <Text style={ss.pageSubtitle}>EPEX SPOT · Day-ahead & intraday</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
          {[{ id: "market", label: "Market" }, { id: "vpp", label: "VPP" }, { id: "positions", label: "Positions" }, { id: "pnl", label: "P&L" }].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
              style={[ss.tabPill, tab === t.id && ss.tabPillActive]}>
              <Text style={[ss.tabPillText, tab === t.id && ss.tabPillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {tab === "market" && <MarketTab prices={prices} currentPrice={currentPrice} currentHour={currentHour} />}
          {tab === "vpp" && <VPPTab />}
          {tab === "positions" && <PositionsTab />}
          {tab === "pnl" && <PnLTab />}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function MarketTab({ prices, currentPrice, currentHour }) {
  const [mode, setMode] = useState("auto")
  const maxP = Math.max(...prices), minP = Math.min(...prices)

  return (
    <View>
      <LinearGradient colors={["rgba(245,158,11,0.12)", "rgba(245,158,11,0.02)"]}
        style={{ borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.amber + "30", marginBottom: 16 }}>
        <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>Current Spot Price</Text>
        <Text style={{ color: C.amber, fontSize: 52, fontWeight: "900", letterSpacing: -2, marginTop: 6 }}>
          €{currentPrice}<Text style={{ fontSize: FONT.lg, color: C.sub }}>/MWh</Text>
        </Text>
        <Text style={{ color: C.amber + "99", fontSize: FONT.sm, marginTop: 4 }}>Hour {currentHour}:00 · EPEX SPOT DE/AT/LU</Text>

        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 72 }}>
            {prices.map((p, i) => {
              const h = ((p - minP) / (maxP - minP)) * 56 + 8
              const isNow = i === currentHour
              const isHigh = p > 80
              return (
                <View key={i} style={{
                  flex: 1, height: h,
                  backgroundColor: isNow ? C.accent : isHigh ? C.red + "aa" : C.amber + "66",
                  borderRadius: 2,
                }} />
              )
            })}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>00:00</Text>
            <Text style={{ color: C.accent, fontSize: FONT.xs }}>NOW</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>23:00</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {["auto", "manual"].map(m => (
          <TouchableOpacity key={m} onPress={() => setMode(m)}
            style={[ss.btn, { flex: 1, backgroundColor: mode === m ? C.accentL : C.card, borderColor: mode === m ? C.accent + "44" : C.border }]}>
            <Text style={{ color: mode === m ? C.accent : C.muted, fontWeight: "700", textTransform: "capitalize" }}>
              {m === "auto" ? "🤖 Auto" : "✋ Manual"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <KPI label="Today P&L" value="€3,840" unit="" color={C.accent} delta={18} />
        <KPI label="Open Bids" value="12" unit="" color={C.blue} />
        <KPI label="Filled" value="87%" unit="" color={C.accent} />
      </View>
    </View>
  )
}

function VPPTab() {
  const groups = mockVPPGroups()
  return (
    <View>
      <SectionHeader title="VPP Groups" subtitle="Virtual Power Plant aggregation" />
      {groups.map(g => (
        <View key={g.id} style={[ss.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{g.name}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{g.assets} assets · {g.region}</Text>
            </View>
            <Badge label={g.status} color={g.status === "active" ? C.accent : C.muted} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>Available</Text>
              <Text style={{ color: C.accent, fontWeight: "800", fontSize: FONT.lg }}>{g.capacity} MW</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>Dispatched</Text>
              <Text style={{ color: C.blue, fontWeight: "800", fontSize: FONT.lg }}>{g.dispatched} MW</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>Revenue</Text>
              <Text style={{ color: C.amber, fontWeight: "800", fontSize: FONT.lg }}>€{g.revenue}K</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

function PositionsTab() {
  const positions = mockPositions()
  return (
    <View>
      <SectionHeader title="Open Positions" subtitle={`${positions.length} active`} />
      {positions.map(p => (
        <View key={p.id} style={[ss.card, { marginBottom: 8, flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{p.product}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{p.type} · {p.hour}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: p.pnl >= 0 ? C.accent : C.red, fontWeight: "800", fontSize: FONT.md }}>
              {p.pnl >= 0 ? "+" : ""}€{p.pnl}
            </Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{p.volume} MWh @ €{p.price}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function PnLTab() {
  const weekData = [1240, 2100, 1880, 3200, 2840, 3840, 4200]
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const total = weekData.reduce((a, b) => a + b, 0)

  return (
    <View>
      <LinearGradient colors={["rgba(0,229,160,0.10)", "rgba(0,229,160,0.02)"]}
        style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.accent + "25", marginBottom: 16 }}>
        <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Week P&L</Text>
        <Text style={{ color: C.accent, fontSize: 42, fontWeight: "900", letterSpacing: -1 }}>€{(total / 1000).toFixed(1)}K</Text>
        <Text style={{ color: C.accent + "99", fontSize: FONT.sm, marginTop: 4 }}>▲ 32% vs last week</Text>
        <View style={{ marginTop: 16 }}>
          <Sparkline data={weekData} color={C.accent} height={60} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            {days.map(d => <Text key={d} style={{ color: C.muted, fontSize: 10 }}>{d}</Text>)}
          </View>
        </View>
      </LinearGradient>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <KPI label="Best Day" value="€4,200" unit="" color={C.accent} />
        <KPI label="Avg/Day" value={`€${(total / 7 / 1000).toFixed(1)}K`} unit="" color={C.blue} />
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
  const alerts = mockAlerts()
  const filtered = filter === "all" ? alerts : alerts.filter(a => a.level === filter)

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
        <KPI label="Critical" value={alerts.filter(a => a.level === "critical").length.toString()} unit="" color={C.red} />
        <KPI label="Warning" value={alerts.filter(a => a.level === "warning").length.toString()} unit="" color={C.amber} />
        <KPI label="Info" value={alerts.filter(a => a.level === "info").length.toString()} unit="" color={C.blue} />
      </View>
      {filtered.map(a => (
        <View key={a.id} style={[ss.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: a.level === "critical" ? C.red : a.level === "warning" ? C.amber : C.blue }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontSize: 14, marginRight: 8 }}>{a.level === "critical" ? "🔴" : a.level === "warning" ? "🟡" : "🔵"}</Text>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md, flex: 1 }}>{a.title}</Text>
            <Badge label={a.level} color={a.level === "critical" ? C.red : a.level === "warning" ? C.amber : C.blue} />
          </View>
          <Text style={{ color: C.sub, fontSize: FONT.xs }}>{a.message}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>{a.site}</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>{a.time}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function MaintenanceTab() {
  const tasks = mockMaintenance()
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Scheduled" value="8" unit="" color={C.blue} />
        <KPI label="Overdue" value="2" unit="" color={C.red} />
        <KPI label="Done" value="14" unit="" color={C.accent} />
      </View>
      {tasks.map(t => (
        <View key={t.id} style={[ss.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{t.title}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{t.asset} · {t.site}</Text>
            </View>
            <Badge label={t.priority} color={t.priority === "high" ? C.red : t.priority === "medium" ? C.amber : C.muted} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.sub, fontSize: FONT.xs }}>Due: {t.due}</Text>
            <Text style={{ color: t.status === "overdue" ? C.red : C.blue, fontSize: FONT.xs, fontWeight: "600" }}>{t.status}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function AnomalyTab() {
  const anomalies = mockAnomalies()
  return (
    <View>
      <SectionHeader title="ML Anomaly Detection" subtitle="AI-powered · Real-time" />
      {anomalies.map(a => (
        <View key={a.id} style={[ss.card, { marginBottom: 10, borderLeftWidth: 3, borderLeftColor: a.severity > 7 ? C.red : a.severity > 4 ? C.amber : C.blue }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{a.type}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{a.device} · {a.site}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: a.severity > 7 ? C.red : a.severity > 4 ? C.amber : C.blue, fontWeight: "900", fontSize: FONT.xl }}>{a.severity}</Text>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>/10</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>Confidence:</Text>
            <View style={{ flex: 1 }}>
              <MiniBar value={a.confidence} max={100} color={C.purple} height={4} />
            </View>
            <Text style={{ color: C.purple, fontSize: FONT.xs, fontWeight: "700" }}>{a.confidence}%</Text>
          </View>
          <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 8 }}>{a.recommendation}</Text>
        </View>
      ))}
    </View>
  )
}

function ReportsTab() {
  const reports = [
    { id: 1, title: "Monthly Energy Summary", type: "PDF", date: "2025-05-01", size: "2.4 MB" },
    { id: 2, title: "Trading Performance Q1", type: "Excel", date: "2025-04-01", size: "1.8 MB" },
    { id: 3, title: "Carbon Emissions Report", type: "PDF", date: "2025-04-15", size: "3.1 MB" },
    { id: 4, title: "Regulatory Compliance", type: "PDF", date: "2025-03-31", size: "5.2 MB" },
  ]
  return (
    <View>
      <SectionHeader title="Reports" subtitle="Generated & scheduled" />
      {reports.map(r => (
        <TouchableOpacity key={r.id} style={[ss.card, { marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: r.type === "PDF" ? C.red + "22" : C.accent + "22", borderWidth: 1, borderColor: r.type === "PDF" ? C.red + "44" : C.accent + "44", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
            <Text style={{ fontSize: 18 }}>{r.type === "PDF" ? "📄" : "📊"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{r.title}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 3 }}>{r.date} · {r.size}</Text>
          </View>
          <Text style={{ color: C.sub, fontSize: FONT.xl }}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── INVESTOR SCREEN ──────────────────────────────────────────────
function InvestorScreen() {
  const kpis = [
    { label: "Portfolio Value", value: "€42.8M", color: C.accent, delta: 12 },
    { label: "Monthly Revenue", value: "€284K", color: C.blue, delta: 8 },
    { label: "IRR", value: "18.4%", color: C.purple, delta: 2 },
    { label: "EBITDA Margin", value: "42%", color: C.amber, delta: -1 },
  ]
  const weekRevenue = [38, 42, 35, 55, 62, 68, 80]
  const days = ["M", "T", "W", "T", "F", "S", "S"]

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={{ marginBottom: 24 }}>
            <Text style={ss.pageTitle}>Investor Dashboard</Text>
            <Text style={ss.pageSubtitle}>Portfolio performance · Real-time</Text>
          </View>

          {/* Revenue chart */}
          <LinearGradient colors={["rgba(0,229,160,0.10)", "rgba(0,229,160,0.02)"]}
            style={{ borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.accent + "25", marginBottom: 20 }}>
            <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Weekly Revenue</Text>
            <Text style={{ color: C.accent, fontSize: 44, fontWeight: "900", letterSpacing: -1 }}>€284K</Text>
            <Text style={{ color: C.accent + "99", fontSize: FONT.sm, marginTop: 4 }}>▲ 18% vs last week</Text>
            <View style={{ marginTop: 16 }}>
              <Sparkline data={weekRevenue} color={C.accent} height={64} />
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 8 }}>
                {days.map((d, i) => <Text key={i} style={{ color: C.muted, fontSize: FONT.xs }}>{d}</Text>)}
              </View>
            </View>
          </LinearGradient>

          {/* KPIs grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {kpis.map((k, i) => (
              <View key={i} style={[ss.card, { width: "47%", padding: 16 }]}>
                <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{k.label}</Text>
                <Text style={{ color: k.color, fontSize: FONT.xl, fontWeight: "900" }}>{k.value}</Text>
                {k.delta != null && (
                  <Text style={{ color: k.delta >= 0 ? C.accent : C.red, fontSize: FONT.xs, marginTop: 4, fontWeight: "700" }}>
                    {k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta)}%
                  </Text>
                )}
              </View>
            ))}
          </View>

          {/* Assets */}
          <SectionHeader title="Asset Breakdown" subtitle="By technology type" />
          {[
            { name: "Battery Storage", pct: 45, value: "€19.3M", color: C.blue },
            { name: "Solar PV", pct: 30, value: "€12.8M", color: C.amber },
            { name: "Wind", pct: 15, value: "€6.4M", color: C.accent },
            { name: "EV Charging", pct: 10, value: "€4.3M", color: C.purple },
          ].map((a, i) => (
            <View key={i} style={[ss.card, { marginBottom: 10 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md, flex: 1 }}>{a.name}</Text>
                <Text style={{ color: a.color, fontWeight: "800", fontSize: FONT.md }}>{a.value}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <MiniBar value={a.pct} max={100} color={a.color} height={7} />
                </View>
                <Text style={{ color: C.sub, fontSize: FONT.xs, width: 30, textAlign: "right" }}>{a.pct}%</Text>
              </View>
            </View>
          ))}
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
  const auth = useAuth()
  const [users, setUsers] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch("/users", {}, auth.token)
      .then(data => setUsers(data?.users || data || mockUsers()))
      .catch(() => setUsers(mockUsers()))
      .finally(() => setLoading(false))
  }, [])

  const roleColor = (r) => ({ admin: C.purple, operator: C.blue, viewer: C.muted, investor: C.amber }[r] || C.muted)

  if (loading) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Total Users" value={(users?.length || 0).toString()} unit="" color={C.accent} />
        <KPI label="Active" value={(users?.filter(u => u.active !== false).length || 0).toString()} unit="" color={C.blue} />
      </View>
      {(users || []).map((u, i) => (
        <View key={u.id || i} style={[ss.card, { marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: roleColor(u.role) + "22", borderWidth: 1, borderColor: roleColor(u.role) + "44", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
            <Text style={{ color: roleColor(u.role), fontWeight: "800", fontSize: FONT.md }}>{(u.name || u.email || "?")[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{u.name || u.email}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{u.email}</Text>
          </View>
          <Badge label={u.role} color={roleColor(u.role)} />
        </View>
      ))}
    </View>
  )
}

function SystemTab() {
  const [notifications, setNotifications] = useState(true)
  const [autoTrading, setAutoTrading] = useState(true)
  const [maintenanceMode, setMaintenanceMode] = useState(false)

  const settings = [
    { label: "Push Notifications", sub: "Real-time alerts on mobile", value: notifications, onChange: setNotifications, color: C.accent },
    { label: "Autonomous Trading", sub: "AI-driven market execution", value: autoTrading, onChange: setAutoTrading, color: C.blue },
    { label: "Maintenance Mode", sub: "Suspend all operations", value: maintenanceMode, onChange: setMaintenanceMode, color: C.red },
  ]

  return (
    <View>
      <SectionHeader title="System Settings" subtitle="Platform configuration" />
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
        { label: "Version", value: "VoltarisOS v4.2.1" },
        { label: "Build", value: "#20250604" },
        { label: "DB", value: "SQLite · energy.db" },
        { label: "API", value: "Railway · production" },
        { label: "Uptime", value: "99.94%" },
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
  const keys = [
    { id: 1, name: "Production API", key: "vos_prod_••••••••4a2f", scope: "read:write", created: "2025-01-15", active: true },
    { id: 2, name: "Dashboard Integration", key: "vos_dash_••••••••9b1c", scope: "read", created: "2025-02-20", active: true },
    { id: 3, name: "Trading Bot", key: "vos_trad_••••••••3e7d", scope: "trading", created: "2025-03-01", active: false },
  ]
  return (
    <View>
      <SectionHeader title="API Keys" subtitle="Manage access tokens" />
      {keys.map(k => (
        <View key={k.id} style={[ss.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{k.name}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{k.key}</Text>
            </View>
            <Badge label={k.active ? "active" : "revoked"} color={k.active ? C.accent : C.red} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Badge label={k.scope} color={C.blue} />
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>Created {k.created}</Text>
          </View>
        </View>
      ))}
      <TouchableOpacity style={[ss.btn, { backgroundColor: C.accentL, borderColor: C.accent + "44", marginTop: 8 }]}>
        <Text style={{ color: C.accent, fontWeight: "700" }}>+ Generate New Key</Text>
      </TouchableOpacity>
    </View>
  )
}

function AuditTab() {
  const logs = [
    { id: 1, action: "User login", user: "admin@voltaris.com", time: "2m ago", ip: "192.168.1.1", result: "success" },
    { id: 2, action: "Battery dispatch", user: "operator@voltaris.com", time: "15m ago", ip: "10.0.0.5", result: "success" },
    { id: 3, action: "API key created", user: "admin@voltaris.com", time: "1h ago", ip: "192.168.1.1", result: "success" },
    { id: 4, action: "Login attempt", user: "unknown@hack.com", time: "3h ago", ip: "45.12.34.56", result: "failed" },
    { id: 5, action: "Trade executed", user: "bot@voltaris.com", time: "4h ago", ip: "internal", result: "success" },
  ]
  return (
    <View>
      <SectionHeader title="Audit Log" subtitle="Security & compliance trail" />
      {logs.map(l => (
        <View key={l.id} style={[ss.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: l.result === "failed" ? C.red : C.accent }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md, flex: 1 }}>{l.action}</Text>
            <Badge label={l.result} color={l.result === "failed" ? C.red : C.accent} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.sub, fontSize: FONT.xs }}>{l.user}</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>{l.time}</Text>
          </View>
          <Text style={{ color: C.muted, fontSize: FONT.xs, marginTop: 4, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{l.ip}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── VIEWER SCREEN ────────────────────────────────────────────────
function ViewerScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={{ marginBottom: 24 }}>
            <Text style={ss.pageTitle}>Energy Overview</Text>
            <Text style={ss.pageSubtitle}>Read-only · Live monitoring</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <KPI label="Total Power" value="1,847" unit="kW" color={C.accent} delta={12} />
            <KPI label="Revenue" value="€8.2K" unit="/day" color={C.blue} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
            <KPI label="SOC Avg" value="74" unit="%" color={C.amber} />
            <KPI label="CO₂ Saved" value="4.2" unit="t" color={C.accent} />
          </View>
          <Sparkline data={[42, 55, 68, 72, 80, 75, 68, 62, 70, 80, 88, 72]} color={C.accent} height={80} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 24 }}>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>00:00</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>12:00</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>23:00</Text>
          </View>
          <SectionHeader title="Read-only Access" />
          <View style={[ss.card, { padding: 20, alignItems: "center" }]}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>👁️</Text>
            <Text style={{ color: C.sub, textAlign: "center", fontSize: FONT.md }}>
              You have view-only access. Contact your administrator to request elevated permissions.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
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
              <Badge label={u?.role || "operator"} color={u?.role === "admin" ? C.purple : C.blue} />
              <Badge label="Active" color={C.accent} />
            </View>
          </View>

          {/* Info cards */}
          {[
            { label: "Role", value: u?.role || "operator" },
            { label: "Tenant", value: "Voltaris Energy Ltd" },
            { label: "Last Login", value: new Date().toLocaleDateString() },
            { label: "Timezone", value: "Europe/Lisbon" },
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
    Viewer:   { active: "👁️", inactive: "👁️" },
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
  const role = auth.user?.role || "operator"

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
      {/* All roles get Home */}
      <Tab.Screen name="Home" component={HomeScreen} options={tabOptions("Home")} />

      {/* Admin & Operator get Energy + Trading + Ops */}
      {(role === "admin" || role === "operator") && (
        <Tab.Screen name="Energy" component={EnergyScreen} options={tabOptions("Energy")} />
      )}
      {(role === "admin" || role === "operator") && (
        <Tab.Screen name="Trading" component={TradingScreen} options={tabOptions("Trading")} />
      )}
      {(role === "admin" || role === "operator") && (
        <Tab.Screen name="Ops" component={OpsScreen} options={tabOptions("Ops")} />
      )}

      {/* Admin only */}
      {role === "admin" && (
        <Tab.Screen name="Admin" component={AdminScreen} options={tabOptions("Admin")} />
      )}

      {/* Investor role */}
      {role === "investor" && (
        <Tab.Screen name="Investor" component={InvestorScreen} options={tabOptions("Investor")} />
      )}

      {/* Viewer role */}
      {role === "viewer" && (
        <Tab.Screen name="Viewer" component={ViewerScreen} options={tabOptions("Viewer")} />
      )}

      {/* Profile always last */}
      <Tab.Screen name="Profile" component={ProfileScreen} options={tabOptions("Profile")} />
    </Tab.Navigator>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(null)

  const authValue = {
    token: auth?.token,
    user: auth,
    login: (data) => setAuth(data),
    logout: () => setAuth(null),
  }

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

// ─── MOCK DATA ────────────────────────────────────────────────────
function mockDashboard() {
  return {
    total_power_kw: 1847,
    revenue_today: 8240,
    battery_soc: 74,
    grid_price: 68,
    co2_saved: 4.2,
    sites_online: 12,
    sites_offline: 2,
  }
}

function mockSites() {
  return [
    { id: 1, name: "Lisboa Norte", location: "Lisboa", type: "Solar+Storage", status: "online", power: 420, capacity: 500 },
    { id: 2, name: "Porto Sul", location: "Porto", type: "Wind+Battery", status: "online", power: 280, capacity: 350 },
    { id: 3, name: "Setúbal Industrial", location: "Setúbal", type: "Storage", status: "warning", power: 180, capacity: 400 },
    { id: 4, name: "Faro Logistics", location: "Faro", type: "Solar+EV", status: "online", power: 95, capacity: 120 },
  ]
}

function mockAlerts() {
  return [
    { id: 1, title: "Battery Cell Overtemp", message: "Cell block 3A exceeded 42°C threshold. Cooling activated.", site: "Lisboa Norte", level: "critical", time: "2m ago" },
    { id: 2, title: "Grid Frequency Deviation", message: "Frequency dropped to 49.8 Hz. Auto-correction engaged.", site: "Porto Sul", level: "warning", time: "8m ago" },
    { id: 3, title: "EV Charger Offline", message: "Bay 7 charger lost comms. Manual inspection required.", site: "Faro Logistics", level: "warning", time: "22m ago" },
    { id: 4, title: "Scheduled Report Ready", message: "May 2025 performance report is available.", site: "Platform", level: "info", time: "1h ago" },
    { id: 5, title: "High Price Spike Detected", message: "EPEX spot price exceeded €95/MWh. Discharge initiated.", site: "Setúbal Industrial", level: "info", time: "2h ago" },
  ]
}

function mockBatteries() {
  return [
    { id: 1, name: "BESS-LIS-01", site: "Lisboa Norte", capacity: 2000, soc: 82, power: 120, mode: "discharging", temp: 28, health: 96, cycles: 342 },
    { id: 2, name: "BESS-LIS-02", site: "Lisboa Norte", capacity: 1500, soc: 45, power: -80, mode: "charging", temp: 26, health: 98, cycles: 218 },
    { id: 3, name: "BESS-POR-01", site: "Porto Sul", capacity: 3000, soc: 67, power: 0, mode: "idle", temp: 24, health: 94, cycles: 512 },
    { id: 4, name: "BESS-SET-01", site: "Setúbal", capacity: 1000, soc: 31, power: -60, mode: "charging", temp: 30, health: 89, cycles: 680 },
  ]
}

function mockEVs() {
  return [
    { id: 1, plate: "51-AB-23", model: "Tesla Model 3", bay: 2, status: "charging", soc: 68, eta: "45min" },
    { id: 2, plate: "AA-42-BC", model: "Nissan Leaf", bay: 5, status: "v2g", soc: 85, eta: "—" },
    { id: 3, plate: "98-XY-12", model: "VW ID.4", bay: 8, status: "charging", soc: 42, eta: "1h 20m" },
    { id: 4, plate: "67-MN-89", model: "BMW iX3", bay: 11, status: "idle", soc: 100, eta: "—" },
  ]
}

function mockVPPGroups() {
  return [
    { id: 1, name: "Iberia-South VPP", assets: 12, region: "PT/ES", status: "active", capacity: "8.4", dispatched: "5.2", revenue: "18.4" },
    { id: 2, name: "Industrial Flex", assets: 8, region: "PT Central", status: "active", capacity: "4.2", dispatched: "3.1", revenue: "9.8" },
    { id: 3, name: "Residential Pool", assets: 340, region: "Nationwide", status: "standby", capacity: "2.1", dispatched: "0", revenue: "4.2" },
  ]
}

function mockPositions() {
  return [
    { id: 1, product: "DE Day-Ahead", type: "Sell", hour: "16:00-17:00", volume: 2.5, price: 91, pnl: 840 },
    { id: 2, product: "FR Intraday", type: "Buy", hour: "14:00-15:00", volume: 1.8, price: 65, pnl: 210 },
    { id: 3, product: "PT Balancing", type: "Sell", hour: "Now", volume: 3.2, price: 78, pnl: -120 },
  ]
}

function mockMaintenance() {
  return [
    { id: 1, title: "Battery Cell Inspection", asset: "BESS-LIS-01", site: "Lisboa Norte", priority: "high", due: "Today", status: "pending" },
    { id: 2, title: "Inverter Calibration", asset: "INV-POR-03", site: "Porto Sul", priority: "medium", due: "Jun 7", status: "scheduled" },
    { id: 3, title: "EV Charger Firmware", asset: "EVCS-FAR-07", site: "Faro", priority: "low", due: "Jun 1", status: "overdue" },
    { id: 4, title: "Grid Meter Audit", asset: "MTR-SET-01", site: "Setúbal", priority: "high", due: "Jun 10", status: "scheduled" },
  ]
}

function mockAnomalies() {
  return [
    { id: 1, type: "Thermal Runaway Risk", device: "BESS-LIS-01 Cell-3A", site: "Lisboa Norte", severity: 8, confidence: 92, recommendation: "Inspect cooling system. Consider partial isolation of affected cell block." },
    { id: 2, type: "Unusual Consumption Pattern", device: "EVCS-SET-Bay5", site: "Setúbal", severity: 5, confidence: 78, recommendation: "Possible charger malfunction. Schedule diagnostic within 48h." },
    { id: 3, type: "Grid Harmonic Distortion", device: "INV-POR-02", site: "Porto Sul", severity: 3, confidence: 85, recommendation: "Monitor and apply filter adjustment if distortion increases." },
  ]
}

function mockUsers() {
  return [
    { id: 1, name: "Francisco Morais", email: "admin@voltaris.com", role: "admin", active: true },
    { id: 2, name: "Sofia Oliveira", email: "operator@voltaris.com", role: "operator", active: true },
    { id: 3, name: "Pedro Santos", email: "viewer@voltaris.com", role: "viewer", active: true },
    { id: 4, name: "Ana Lima", email: "investor@voltaris.com", role: "investor", active: true },
  ]
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
