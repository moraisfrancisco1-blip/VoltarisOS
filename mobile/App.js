import { NavigationContainer } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createStackNavigator } from "@react-navigation/stack"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useState } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, RefreshControl
} from "react-native"

const C = {
  bg: "#0a0f1a",
  card: "#111827",
  border: "#1a2234",
  accent: "#4ade80",
  blue: "#60a5fa",
  amber: "#f59e0b",
  red: "#f87171",
  muted: "#6b7280",
  text: "#f1f5f9",
  subtext: "#9ca3af",
}

// ─── Auth Context ───────────────────────────────────────────────
import { createContext, useContext } from "react"
const AuthCtx = createContext(null)
const useAuth = () => useContext(AuthCtx)

// ─── API ─────────────────────────────────────────────────────────
const API_BASE = "https://voltarisos-production.up.railway.app/api"

async function apiFetch(path, opts = {}, token) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const r = await fetch(`${API_BASE}${path}`, { ...opts, headers })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// ─── Login Screen ─────────────────────────────────────────────────
function LoginScreen() {
  const auth = useAuth()
  const [email, setEmail] = useState("admin@voltaris.com")
  const [pass, setPass] = useState("admin123")
  const [loading, setLoading] = useState(false)

  const login = async () => {
    setLoading(true)
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: pass }),
      })
      auth.login(data)
    } catch (e) {
      Alert.alert("Login failed", "Check credentials and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[s.flex, s.center, { backgroundColor: C.bg, padding: 32 }]}>
      <View style={{ marginBottom: 40, alignItems: "center" }}>
        <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: C.accent + "22", borderWidth: 1, borderColor: C.accent + "44", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 28 }}>⚡</Text>
        </View>
        <Text style={{ color: C.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 }}>VoltarisOS</Text>
        <Text style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>Energy Intelligence Platform</Text>
      </View>

      <View style={{ width: "100%" }}>
        <Text style={s.label}>Email</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" placeholderTextColor={C.muted} />

        <Text style={[s.label, { marginTop: 16 }]}>Password</Text>
        <TextInput style={s.input} value={pass} onChangeText={setPass}
          secureTextEntry placeholderTextColor={C.muted} />

        <TouchableOpacity onPress={login} disabled={loading}
          style={[s.btn, { backgroundColor: C.accent + "22", borderColor: C.accent + "44", marginTop: 28 }]}>
          {loading
            ? <ActivityIndicator color={C.accent} />
            : <Text style={{ color: C.accent, fontWeight: "700", fontSize: 15 }}>Sign In</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Dashboard Screen ─────────────────────────────────────────────
function DashboardScreen() {
  const auth = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const d = await apiFetch("/dashboard", {}, auth.token)
      setData(d)
    } catch {
      // use mock data
      setData({
        total_power_kw: 4280,
        battery_soc_pct: 74,
        grid_frequency: 50.02,
        total_revenue_eur: 12840,
        active_sites: 2,
        alerts: 3,
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useState(() => { load() }, [])

  const onRefresh = () => { setRefreshing(true); load(true) }

  const metrics = data ? [
    { label: "Total Power", value: `${(data.total_power_kw / 1000).toFixed(1)} MW`, color: C.accent, icon: "⚡" },
    { label: "Battery SoC", value: `${data.battery_soc_pct}%`, color: C.blue, icon: "🔋" },
    { label: "Grid Freq", value: `${data.grid_frequency} Hz`, color: C.amber, icon: "📡" },
    { label: "Revenue", value: `€${(data.total_revenue_eur / 1000).toFixed(1)}K`, color: "#a78bfa", icon: "💶" },
    { label: "Sites", value: data.active_sites, color: C.accent, icon: "🏭" },
    { label: "Alerts", value: data.alerts, color: C.red, icon: "🔔" },
  ] : []

  if (loading) return <View style={[s.flex, s.center, { backgroundColor: C.bg }]}><ActivityIndicator color={C.accent} size="large" /></View>

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}>
      <View style={{ padding: 20 }}>
        <Text style={{ color: C.subtext, fontSize: 13, marginBottom: 4 }}>Good morning,</Text>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: "800", marginBottom: 20 }}>
          {auth.user?.company || "Voltaris"} ⚡
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {metrics.map((m, i) => (
            <View key={i} style={[s.card, { width: "47%", alignItems: "center", padding: 16 }]}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</Text>
              <Text style={{ color: m.color, fontSize: 22, fontWeight: "800" }}>{m.value}</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Status strip */}
        <View style={[s.card, { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }]}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />
          <Text style={{ color: C.subtext, fontSize: 13 }}>All systems operational</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ color: C.muted, fontSize: 12 }}>Live</Text>
        </View>
      </View>
    </ScrollView>
  )
}

// ─── Sites Screen ─────────────────────────────────────────────────
function SitesScreen() {
  const auth = useAuth()
  const [sites, setSites] = useState([
    { id: 1, name: "Rotterdam BESS", location: "Netherlands", capacity_mwh: 50, status: "online", soc: 74, power_kw: 2200 },
    { id: 2, name: "Rebordelo VPP", location: "Portugal", capacity_mwh: 30, status: "online", soc: 58, power_kw: 1800 },
  ])
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 800)
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}>
      <View style={{ padding: 20 }}>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 4 }}>Sites</Text>
        <Text style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>2 active sites</Text>

        {sites.map(site => (
          <View key={site.id} style={[s.card, { marginBottom: 12 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: C.accent + "22", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Text style={{ fontSize: 20 }}>🏭</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>{site.name}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{site.location}</Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: C.accent + "18" }}>
                <Text style={{ color: C.accent, fontSize: 11, fontWeight: "700" }}>
                  {site.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={[s.metricPill, { flex: 1 }]}>
                <Text style={{ color: C.blue, fontWeight: "700", fontSize: 16 }}>{site.soc}%</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>SoC</Text>
              </View>
              <View style={[s.metricPill, { flex: 1 }]}>
                <Text style={{ color: C.amber, fontWeight: "700", fontSize: 16 }}>{site.power_kw}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>kW</Text>
              </View>
              <View style={[s.metricPill, { flex: 1 }]}>
                <Text style={{ color: C.accent, fontWeight: "700", fontSize: 16 }}>{site.capacity_mwh}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>MWh</Text>
              </View>
            </View>

            {/* SoC bar */}
            <View style={{ marginTop: 14, height: 6, backgroundColor: C.border, borderRadius: 3 }}>
              <View style={{ width: `${site.soc}%`, height: "100%", backgroundColor: C.accent, borderRadius: 3 }} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

// ─── Battery Screen ───────────────────────────────────────────────
function BatteryScreen() {
  const cells = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    soc: Math.round(60 + Math.random() * 30),
    temp: (28 + Math.random() * 8).toFixed(1),
    health: Math.random() > 0.1 ? "good" : "warn",
  }))

  const avgSoc = Math.round(cells.reduce((a, c) => a + c.soc, 0) / cells.length)

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 20 }}>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 4 }}>Battery BMS</Text>
        <Text style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Real-time cell monitoring</Text>

        {/* Main SoC */}
        <View style={[s.card, { alignItems: "center", padding: 28, marginBottom: 16 }]}>
          <Text style={{ color: C.accent, fontSize: 52, fontWeight: "900" }}>{avgSoc}%</Text>
          <Text style={{ color: C.subtext, fontSize: 13, marginTop: 4 }}>Average State of Charge</Text>
          <View style={{ width: "100%", marginTop: 16, height: 10, backgroundColor: C.border, borderRadius: 5 }}>
            <View style={{ width: `${avgSoc}%`, height: "100%", backgroundColor: C.accent, borderRadius: 5 }} />
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Charging", value: "2.4 MW", color: C.accent },
            { label: "Temp avg", value: "31.2°C", color: C.amber },
            { label: "Cycles", value: "1,247", color: C.blue },
          ].map((m, i) => (
            <View key={i} style={[s.card, { flex: 1, alignItems: "center", padding: 12 }]}>
              <Text style={{ color: m.color, fontWeight: "800", fontSize: 15 }}>{m.value}</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Cell grid */}
        <Text style={{ color: C.subtext, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Cell Array</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {cells.map(cell => (
            <View key={cell.id} style={{
              width: "22%", aspectRatio: 1, borderRadius: 10,
              backgroundColor: cell.health === "warn" ? C.amber + "18" : C.accent + "18",
              borderWidth: 1, borderColor: cell.health === "warn" ? C.amber + "44" : C.accent + "33",
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ color: cell.health === "warn" ? C.amber : C.accent, fontWeight: "700", fontSize: 14 }}>{cell.soc}%</Text>
              <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>C{cell.id}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

// ─── Alerts Screen ────────────────────────────────────────────────
function AlertsScreen() {
  const [alerts, setAlerts] = useState([
    { id: 1, type: "warning", title: "High Temperature", message: "Cell C7 at Rotterdam reached 41°C", time: "2 min ago", site: "Rotterdam", read: false },
    { id: 2, type: "info", title: "Frequency Response", message: "Grid frequency deviation detected: 49.97 Hz", time: "8 min ago", site: "Rebordelo", read: false },
    { id: 3, type: "success", title: "Optimization Complete", message: "Daily dispatch schedule updated for peak shaving", time: "1h ago", site: "Rotterdam", read: true },
    { id: 4, type: "error", title: "Inverter Fault", message: "INV-03 communication timeout. Auto-restart triggered.", time: "2h ago", site: "Rotterdam", read: true },
    { id: 5, type: "info", title: "Trading Opportunity", message: "Price spike detected: €180/MWh in 15min slot", time: "3h ago", site: "System", read: true },
  ])

  const typeColor = (t) => ({ warning: C.amber, info: C.blue, success: C.accent, error: C.red })[t]
  const typeIcon = (t) => ({ warning: "⚠️", info: "ℹ️", success: "✅", error: "🚨" })[t]

  const markRead = (id) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <View>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>Alerts</Text>
            <Text style={{ color: C.muted, fontSize: 13 }}>{alerts.filter(a => !a.read).length} unread</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setAlerts(prev => prev.map(a => ({ ...a, read: true })))}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.muted, fontSize: 12 }}>Mark all read</Text>
          </TouchableOpacity>
        </View>

        {alerts.map(alert => (
          <TouchableOpacity key={alert.id} onPress={() => markRead(alert.id)}
            style={[s.card, { marginBottom: 10, opacity: alert.read ? 0.7 : 1, flexDirection: "row", gap: 12 }]}>
            <Text style={{ fontSize: 22 }}>{typeIcon(alert.type)}</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, flex: 1 }}>{alert.title}</Text>
                {!alert.read && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: typeColor(alert.type) }} />}
              </View>
              <Text style={{ color: C.subtext, fontSize: 13, lineHeight: 18 }}>{alert.message}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <Text style={{ color: C.muted, fontSize: 11 }}>{alert.time}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>·</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>{alert.site}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

// ─── Trading Screen ───────────────────────────────────────────────
function TradingScreen() {
  const [mode, setMode] = useState("auto")
  const prices = [42, 38, 35, 51, 68, 85, 72, 62, 58, 71, 88, 95, 82, 67, 54, 48, 62, 78, 91, 84, 69, 58, 47, 39]
  const maxPrice = Math.max(...prices)
  const minPrice = Math.min(...prices)
  const currentHour = new Date().getHours()
  const currentPrice = prices[currentHour]

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 20 }}>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 4 }}>Energy Trading</Text>
        <Text style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Day-ahead market · EPEX SPOT</Text>

        {/* Current price */}
        <View style={[s.card, { alignItems: "center", padding: 24, marginBottom: 16 }]}>
          <Text style={{ color: C.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Current Price</Text>
          <Text style={{ color: C.amber, fontSize: 48, fontWeight: "900", marginTop: 4 }}>
            €{currentPrice}
          </Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>per MWh · {currentHour}:00 slot</Text>
        </View>

        {/* Mode toggle */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {["auto", "manual"].map(m => (
            <TouchableOpacity key={m} onPress={() => setMode(m)}
              style={[s.btn, { flex: 1, backgroundColor: mode === m ? C.accent + "22" : C.card, borderColor: mode === m ? C.accent + "44" : C.border }]}>
              <Text style={{ color: mode === m ? C.accent : C.muted, fontWeight: "600", textTransform: "capitalize" }}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price chart — bar chart using RN */}
        <View style={[s.card, { padding: 16 }]}>
          <Text style={{ color: C.subtext, fontSize: 12, fontWeight: "600", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>24h Price Curve</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 80 }}>
            {prices.map((p, i) => {
              const h = ((p - minPrice) / (maxPrice - minPrice)) * 70 + 10
              const isNow = i === currentHour
              const isHigh = p > 75
              return (
                <View key={i} style={{
                  flex: 1, height: h,
                  backgroundColor: isNow ? C.accent : isHigh ? C.amber + "99" : C.blue + "55",
                  borderRadius: 2,
                }} />
              )
            })}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ color: C.muted, fontSize: 10 }}>00:00</Text>
            <Text style={{ color: C.muted, fontSize: 10 }}>12:00</Text>
            <Text style={{ color: C.muted, fontSize: 10 }}>23:00</Text>
          </View>
        </View>

        {/* Today stats */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          {[
            { label: "Today Revenue", value: "€3.2K", color: C.accent },
            { label: "Dispatched", value: "18.4 MWh", color: C.blue },
            { label: "Avg Price", value: `€${Math.round(prices.reduce((a, b) => a + b) / 24)}/MWh`, color: C.amber },
          ].map((m, i) => (
            <View key={i} style={[s.card, { flex: 1, alignItems: "center", padding: 12 }]}>
              <Text style={{ color: m.color, fontWeight: "800", fontSize: 13 }}>{m.value}</Text>
              <Text style={{ color: C.muted, fontSize: 10, marginTop: 3, textAlign: "center" }}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

// ─── Tab Navigator ────────────────────────────────────────────────
const Tab = createBottomTabNavigator()

const TabIcon = ({ name, focused }) => {
  const icons = {
    Dashboard: focused ? "⚡" : "⚡",
    Sites: "🏭",
    Battery: "🔋",
    Alerts: "🔔",
    Trading: "📈",
  }
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>
  )
}

function MainApp() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: "800", fontSize: 17 },
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopWidth: 1,
          borderTopColor: C.border,
          height: 84,
          paddingBottom: 24,
          paddingTop: 10,
        },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Sites" component={SitesScreen} />
      <Tab.Screen name="Battery" component={BatteryScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Trading" component={TradingScreen} />
    </Tab.Navigator>
  )
}

// ─── Root ─────────────────────────────────────────────────────────
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
              notification: C.accent,
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
const s = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: "#0a0f1a",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    color: C.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  label: {
    color: C.subtext,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  metricPill: {
    backgroundColor: "#0a0f1a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    alignItems: "center",
  },
})
