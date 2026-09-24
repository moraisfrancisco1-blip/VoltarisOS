import { useState, useEffect, useRef } from "react"
import { View, Text, TextInput, Animated, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { useTranslation } from "react-i18next"

import * as api from "../../api"
import { useAuth } from "../auth/AuthContext"
import { C, FONT, ss } from "../theme/tokens"
import { Badge, Button } from "../ui"
import { success, error as errorHaptic } from "../lib/haptics"

function LoginScreen() {
  const { t } = useTranslation()
  const auth = useAuth()
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const slideAnim = useRef(new Animated.Value(40)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start()
  }, [])

  const login = async () => {
    if (!email || !pass) { setErrorMsg(t("login.errorEmpty")); return }
    setLoading(true); setErrorMsg("")
    try {
      const data = await api.login(email, pass)
      success()
      auth.login(data)
    } catch (e) {
      errorHaptic()
      setErrorMsg(t("login.errorInvalid"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <LinearGradient colors={["#070d19", "#0a1628", "#070d19"]} style={ss.flex}>
      <SafeAreaView style={ss.flex} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 28 }}>
          <Animated.View style={{ opacity: opacityAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Logo */}
            <View style={{ alignItems: "center", marginBottom: 44 }}>
              <LinearGradient
                colors={["rgba(0,229,160,0.15)", "rgba(0,229,160,0.05)"]}
                style={{ width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.accent + "40", marginBottom: 20 }}>
                <Text style={{ fontSize: 38 }}>⚡</Text>
              </LinearGradient>
              <Text style={{ color: C.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 }}>{t("login.title")}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 5 }}>{t("login.subtitle")}</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
                <Badge label={t("login.badgeVersion")} color={C.accent} />
                <Badge label={t("login.badgeTier")} color={C.blue} />
              </View>
            </View>

            {/* Form */}
            <View style={{ marginBottom: 20 }}>
              <Text style={ss.label}>{t("login.emailLabel")}</Text>
              <TextInput
                style={ss.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={C.muted}
                placeholder={t("login.emailPlaceholder")}
              />
              <Text style={[ss.label, { marginTop: 16 }]}>{t("login.passwordLabel")}</Text>
              <TextInput
                style={ss.input}
                value={pass}
                onChangeText={setPass}
                secureTextEntry
                placeholderTextColor={C.muted}
                placeholder={t("login.passwordPlaceholder")}
              />
              {errorMsg ? <Text style={{ color: C.red, fontSize: FONT.sm, marginTop: 10, textAlign: "center" }}>{errorMsg}</Text> : null}
            </View>

            <Button label={t("login.signIn")} onPress={login} loading={loading} style={{ marginBottom: 24 }} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  )
}

export default LoginScreen
