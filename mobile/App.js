import "./src/i18n"
import { initSentry, Sentry } from "./src/lib/sentry"
initSentry()

import { useEffect } from "react"
import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import { NavigationContainer } from "@react-navigation/native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"

import { queryClient, PERSIST_MAX_AGE } from "./src/lib/queryClient"
import { queryPersister } from "./src/lib/storage"
import { AuthProvider, useAuth } from "./src/auth/AuthContext"
import { C } from "./src/theme/tokens"
import { LoadingScreen } from "./src/ui"
import LoginScreen from "./src/screens/LoginScreen"
import MainTabs from "./src/navigation/MainTabs"
import { registerBackgroundSync, unregisterBackgroundSync, clearCachedSnapshot } from "./src/lib/backgroundSync"
import { ensureLiveNotificationChannel, dismissLiveNotification } from "./src/lib/liveNotification"

const navigationTheme = {
  dark: true,
  colors: {
    primary: C.accent,
    background: C.bg,
    card: C.card,
    text: C.text,
    border: C.border,
    notification: C.red,
  },
}

function RootNavigator() {
  const { user, restoring } = useAuth()

  // The "Savings" widget and the live ongoing notification only make sense
  // for a logged-in tenant (they show real, tenant-scoped numbers) -- so the
  // background sync task is armed on login and torn down on logout, same
  // lifecycle as the query cache in AuthContext.
  useEffect(() => {
    if (Platform.OS !== "android" || !user) return
    let cancelled = false
    ;(async () => {
      await ensureLiveNotificationChannel()
      await Notifications.requestPermissionsAsync()
      if (!cancelled) await registerBackgroundSync()
    })()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (Platform.OS !== "android") return
    if (!user) {
      unregisterBackgroundSync()
      dismissLiveNotification()
      clearCachedSnapshot()
    }
  }, [user])

  if (restoring) return <LoadingScreen />
  return user ? <MainTabs /> : <LoginScreen />
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: PERSIST_MAX_AGE }}
    >
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <NavigationContainer theme={navigationTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  )
}

export default Sentry.wrap(App)
