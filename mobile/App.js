import "./src/i18n"
import { initSentry, Sentry } from "./src/lib/sentry"
initSentry()

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
