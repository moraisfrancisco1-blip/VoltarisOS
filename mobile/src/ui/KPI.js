import { View, Text } from "react-native"
import { C, FONT, ss } from "../theme/tokens"

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

export default KPI
