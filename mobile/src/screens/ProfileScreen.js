import { View, Text, ScrollView, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"

import { useAuth } from "../auth/AuthContext"
import { C, FONT, ss } from "../theme/tokens"
import { Badge } from "../ui"
import { isAdminRole, displayRole } from "../lib/roles"

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


export default ProfileScreen
