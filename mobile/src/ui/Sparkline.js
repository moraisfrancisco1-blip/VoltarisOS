import { View } from "react-native"
import { C } from "../theme/tokens"

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

export default Sparkline
