import { Platform } from "react-native"
import * as TaskManager from "expo-task-manager"
import * as BackgroundTask from "expo-background-task"
import { requestWidgetUpdate } from "react-native-android-widget"

import { storage } from "./storage"
import { getDashboardSnapshot } from "../../api"
import { SavingsWidget } from "../widgets/SavingsWidget"
import { updateLiveNotification } from "./liveNotification"
import i18n from "../i18n"

// The single real data source behind both the "Savings" home-screen widget
// and the live ongoing notification. Neither of those can hold the app's
// /ws/dashboard websocket open while backgrounded or killed, so this task --
// scheduled by the OS via expo-background-task/WorkManager, matched to the
// widget provider's own 30-minute minimum refresh floor -- polls the real
// GET /api/dashboard/snapshot REST endpoint (backend/routers/
// dashboard_snapshot_api.py) instead. No mock numbers: if the fetch fails,
// the widget/notification simply keep showing the last real snapshot rather
// than a fabricated one.
export const BACKGROUND_SYNC_TASK = "voltarisos-background-sync"
const SNAPSHOT_CACHE_KEY = "widget-snapshot"
const MIN_INTERVAL_MINUTES = 30

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const raw = await getDashboardSnapshot()
    const snapshot = {
      solarKw: raw.solar_kw ?? 0,
      batteryKw: raw.battery_kw ?? 0,
      totalEur: raw.savings?.total_eur ?? 0,
      updatedAt: Date.now(),
    }
    storage.set(SNAPSHOT_CACHE_KEY, JSON.stringify(snapshot))

    if (Platform.OS === "android") {
      await requestWidgetUpdate({
        widgetName: "Savings",
        renderWidget: () => <SavingsWidget data={withLabels(snapshot)} />,
        widgetNotFound: () => {
          // No widget on the home screen -- nothing to draw, but we keep the
          // task registered since the live notification still needs it.
        },
      })
      await updateLiveNotification(snapshot)
    }

    return BackgroundTask.BackgroundTaskResult.Success
  } catch (error) {
    console.warn("[backgroundSync] snapshot refresh failed:", error?.message)
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

function withLabels(snapshot) {
  return { ...snapshot, labels: { savingsTitle: i18n.t("home.savingsTitle") } }
}

// Reads the last real snapshot the background task wrote, for the widget's
// own OS-driven repaint (widget-task-handler.js) -- never fetches itself.
export function readCachedSnapshot() {
  const raw = storage.getString(SNAPSHOT_CACHE_KEY)
  if (!raw) return null
  try {
    return withLabels(JSON.parse(raw))
  } catch {
    return null
  }
}

// Called once from App.js after login. Idempotent -- re-registering with the
// same task name just updates the interval.
export async function registerBackgroundSync() {
  if (Platform.OS !== "android") return
  await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    minimumInterval: MIN_INTERVAL_MINUTES,
  })
}

export async function unregisterBackgroundSync() {
  if (Platform.OS !== "android") return
  await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK).catch(() => {})
}

// Called on logout so a different tenant logging in on the same device never
// briefly sees the previous tenant's numbers in the widget/notification.
export function clearCachedSnapshot() {
  storage.remove(SNAPSHOT_CACHE_KEY)
}
