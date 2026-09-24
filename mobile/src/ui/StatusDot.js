import { View } from "react-native"
import { C } from "../theme/tokens"

function StatusDot({ status }) {
  const colors = { online: C.accent, warning: C.amber, offline: C.red, idle: C.muted }
  return (
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[status] || C.muted }} />
  )
}

export default StatusDot
