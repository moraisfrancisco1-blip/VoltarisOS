import { TouchableOpacity, Text, ActivityIndicator } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { C, FONT, RADIUS } from "../theme/tokens"
import { tap } from "../lib/haptics"

/**
 * Button — primary (gradient-filled) or ghost (outlined) variant.
 * Fires a light haptic tap on press before calling onPress.
 */
function Button({ label, onPress, loading, disabled, variant = "primary", style }) {
  const handlePress = () => {
    if (disabled || loading) return
    tap()
    onPress?.()
  }

  if (variant === "primary") {
    return (
      <TouchableOpacity onPress={handlePress} disabled={disabled || loading}
        style={[{ overflow: "hidden", borderRadius: RADIUS.lg, opacity: disabled ? 0.5 : 1 }, style]}>
        <LinearGradient colors={[C.accent, C.accentD]} style={{ paddingVertical: 15, alignItems: "center" }}>
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={{ color: "#000", fontWeight: "800", fontSize: FONT.base, letterSpacing: 0.3 }}>{label}</Text>}
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled || loading}
      style={[{
        paddingVertical: 13, paddingHorizontal: 20, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: C.accent + "44", backgroundColor: C.accentL,
        alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1,
      }, style]}>
      {loading
        ? <ActivityIndicator color={C.accent} size="small" />
        : <Text style={{ color: C.accent, fontWeight: "700", fontSize: FONT.base }}>{label}</Text>}
    </TouchableOpacity>
  )
}

export default Button
