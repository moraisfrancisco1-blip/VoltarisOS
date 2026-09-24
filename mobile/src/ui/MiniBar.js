import { View } from "react-native"
import { C } from "../theme/tokens"

function MiniBar({ value, max = 100, color = C.accent, height = 6 }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <View style={{ height, backgroundColor: C.border, borderRadius: 4, overflow: "hidden" }}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 4 }} />
    </View>
  )
}

export default MiniBar
