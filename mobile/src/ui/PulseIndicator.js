import { useRef, useEffect } from "react"
import { Animated } from "react-native"
import { C } from "../theme/tokens"

function PulseIndicator({ color = C.accent }) {
  const anim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: anim }} />
}

export default PulseIndicator
