import * as Haptics from "expo-haptics"

/**
 * Central haptics helper — every screen calls these instead of importing
 * expo-haptics directly, so the "feel" of the app stays consistent and can
 * be tuned in one place. All calls are fire-and-forget and never throw
 * (haptics are unsupported on some Android devices/web — fail silently).
 */
const safe = (fn) => {
  try { fn() } catch {}
}

export const tap = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
export const mediumTap = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
export const success = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
export const warning = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))
export const error = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
export const selection = () => safe(() => Haptics.selectionAsync())
