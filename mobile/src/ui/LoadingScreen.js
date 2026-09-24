import { useRef, useEffect } from "react"
import { View, Text, Animated } from "react-native"
import { ss, C, FONT } from "../theme/tokens"

function LoadingScreen() {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return (
    <View style={[ss.flex, ss.center, { backgroundColor: C.bg }]}>
      <Animated.View style={{ opacity: anim }}>
        <Text style={{ color: C.accent, fontSize: 36, fontWeight: "900", letterSpacing: -1 }}>⚡ Voltaris</Text>
      </Animated.View>
      <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 12 }}>Loading intelligence…</Text>
    </View>
  )
}

export default LoadingScreen
