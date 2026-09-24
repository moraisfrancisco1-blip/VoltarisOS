import { View, StyleSheet } from "react-native"
import { BlurView } from "expo-blur"
import { C, RADIUS } from "../theme/tokens"

/**
 * Card — the standard surface. `variant="glass"` renders a translucent,
 * blurred panel (Liquid-Glass-ish) for hero tiles sitting over a gradient
 * background (e.g. Home's "Live Portfolio"); the default `variant="solid"`
 * is the flat opaque card every screen already uses via `ss.card`.
 */
function Card({ children, variant = "solid", style, ...rest }) {
  if (variant === "glass") {
    return (
      <View style={[styles.glassWrap, style]} {...rest}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.glassTint} pointerEvents="none" />
        <View style={styles.glassContent}>{children}</View>
      </View>
    )
  }
  return (
    <View style={[styles.solid, style]} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  solid: {
    backgroundColor: C.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  glassWrap: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: "hidden",
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.glassTint,
  },
  glassContent: {
    padding: 18,
  },
})

export default Card
