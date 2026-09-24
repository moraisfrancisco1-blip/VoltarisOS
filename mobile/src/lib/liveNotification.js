import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import i18n from "../i18n"

// A single ongoing (sticky, low-priority, non-dismissible-by-swipe-on-most-
// launchers) Android notification showing the same numbers as the home
// screen's savings headline and the "Savings" widget -- kept alive by the
// same background sync tick that refreshes those (src/lib/backgroundSync.js).
// iOS has no ongoing-notification concept; this is Android-only by design,
// matching the Phase 3 scope decision (Live Activity is separate, iOS-only,
// and blocked on an Apple Developer Program account).
const CHANNEL_ID = "voltarisos-live"
const NOTIFICATION_ID = "voltarisos-live-savings"

export async function ensureLiveNotificationChannel() {
  if (Platform.OS !== "android") return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: i18n.t("widget.channelName"),
    importance: Notifications.AndroidImportance.LOW,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: false,
  })
}

export async function updateLiveNotification(snapshot) {
  if (Platform.OS !== "android" || !snapshot) return

  const { solarKw, batteryKw, totalEur } = snapshot
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: i18n.t("widget.notificationTitle", { total: `€${totalEur.toFixed(2)}` }),
      body: i18n.t("widget.notificationBody", { solar: solarKw.toFixed(1), battery: batteryKw.toFixed(1) }),
      sticky: true,
      autoDismiss: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: { channelId: CHANNEL_ID },
  })
}

export async function dismissLiveNotification() {
  await Notifications.dismissNotificationAsync(NOTIFICATION_ID)
}
