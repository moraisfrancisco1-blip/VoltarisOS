import { View, Text, TouchableOpacity } from "react-native"
import { C, FONT } from "../theme/tokens"

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

export default SectionHeader
