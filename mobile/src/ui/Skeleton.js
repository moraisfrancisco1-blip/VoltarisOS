import { useRef, useEffect } from "react"
import { View, Animated } from "react-native"
import { C, RADIUS } from "../theme/tokens"

/** A shimmering placeholder block — used instead of a bare spinner while a
 * screen's first real data is still loading (cache-first screens still show
 * this briefly on a cold start with no persisted cache yet). */
function Skeleton({ width = "100%", height = 16, radius = RADIUS.sm, style }) {
  const anim = useRef(new Animated.Value(0.35)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: C.card2, opacity: anim },
        style,
      ]}
    />
  )
}

/** A skeleton shaped like a KPI/Card tile — convenience wrapper for the
 * common "row of stat cards" loading state. */
export function SkeletonCard({ height = 78, style }) {
  return (
    <View style={[{ flex: 1, backgroundColor: C.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, padding: 14 }, style]}>
      <Skeleton width="60%" height={10} style={{ marginBottom: 10 }} />
      <Skeleton width="40%" height={20} />
    </View>
  )
}

export default Skeleton
