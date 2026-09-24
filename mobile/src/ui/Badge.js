import { View, Text } from "react-native"
import { C, FONT } from "../theme/tokens"

function Badge({ label, color = C.accent }) {
  return (
    <View style={{ backgroundColor: color + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: color + "44" }}>
      <Text style={{ color: color, fontSize: FONT.xs, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
    </View>
  )
}

export default Badge
