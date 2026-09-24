import { View, Text } from "react-native"
import { ss, C, FONT } from "../theme/tokens"

function ComingSoon({ icon = "🚧", label, sub }) {
  return (
    <View style={[ss.card, { padding: 28, alignItems: "center" }]}>
      <Text style={{ fontSize: 30, marginBottom: 10 }}>{icon}</Text>
      <Text style={{ color: C.text, fontWeight: "800", fontSize: FONT.md, textAlign: "center" }}>{label}</Text>
      {sub && <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 6, textAlign: "center" }}>{sub}</Text>}
    </View>
  )
}

export default ComingSoon
