import { View, Text, Platform } from "react-native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useAuth } from "../auth/AuthContext"
import { isAdminRole } from "../lib/roles"
import { C, FONT } from "../theme/tokens"

import HomeScreen from "../screens/HomeScreen"
import EnergyScreen from "../screens/EnergyScreen"
import TradingScreen from "../screens/TradingScreen"
import OpsScreen from "../screens/OpsScreen"
import AdminScreen from "../screens/AdminScreen"
import InvestorScreen from "../screens/InvestorScreen"
import ProfileScreen from "../screens/ProfileScreen"

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

const Tab = createBottomTabNavigator()

function tabOptions(name) {
  return {
    tabBarIcon: ({ focused }) => <TabIcon name={name} focused={focused} />,
  }
}

function MainTabs() {
  const auth = useAuth()
  const role = auth.user?.role || "TENANT_MEMBER"
  const isAdmin = isAdminRole(role)
  // Edge-to-edge (Android 15+ / SDK 56): the system nav bar overlaps the app,
  // so the tab bar must grow by the bottom inset to stay visible.
  const insets = useSafeAreaInsets()

  const tabBarStyle = {
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    height: Platform.OS === "ios" ? 90 : 72 + insets.bottom,
    paddingBottom: Platform.OS === "ios" ? 24 : 14 + insets.bottom,
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

export default MainTabs
