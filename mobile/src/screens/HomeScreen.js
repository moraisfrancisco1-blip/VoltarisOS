import { View, Text, ScrollView, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { useTranslation } from "react-i18next"

import { useAuth } from "../auth/AuthContext"
import { useWebSocket } from "../hooks/useWebSocket"
import { useSites, useAlerts, useDayAheadPrices, useSavingsToday, useVppGroups, useOptimizerPlan } from "../api/queries"
import { C, FONT, ss } from "../theme/tokens"
import { KPI, SectionHeader, Badge, ComingSoon, StatusDot, PulseIndicator, Card, SkeletonCard, EnergyFlow, PriceScrubber } from "../ui"
import { isAdminRole, displayRole } from "../lib/roles"
import { timeAgo } from "../lib/format"

function HomeScreen({ navigation }) {
  const { t } = useTranslation()
  const auth = useAuth()

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? t("home.greetingMorning") : greetingHour < 17 ? t("home.greetingAfternoon") : t("home.greetingEvening")

  const { lastMessage: live, isConnected } = useWebSocket("/ws/dashboard")

  const sitesQ = useSites()
  const alertsQ = useAlerts(3)
  const pricesQ = useDayAheadPrices()
  const savingsQ = useSavingsToday()
  const vppGroupsQ = useVppGroups()
  const selectedVppId = vppGroupsQ.data?.[0]?.id
  const planQ = useOptimizerPlan(selectedVppId)

  const loading = sitesQ.isPending || alertsQ.isPending || pricesQ.isPending
  const refreshing = sitesQ.isFetching || alertsQ.isFetching || pricesQ.isFetching
  const onRefresh = () => { sitesQ.refetch(); alertsQ.refetch(); pricesQ.refetch(); savingsQ.refetch() }

  const sites = sitesQ.data || []
  const alerts = alertsQ.data || []
  const hourKey = `${String(new Date().getHours()).padStart(2, "0")}:00`
  const gridPrice = pricesQ.data?.prices?.find(p => p.hour === hourKey)?.price ?? null

  const online = sites.filter(s => s.status === "active").length
  const other = sites.length - online

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
      refreshControl={<RefreshControl refreshing={refreshing && !loading} onRefresh={onRefresh} tintColor={C.accent} />}>
      <SafeAreaView edges={["top", "left", "right"]}>
        {/* Header */}
        <LinearGradient colors={["#0a1628", "#070d19"]} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.sub, fontSize: FONT.sm }}>{greeting},</Text>
              <Text style={{ color: C.text, fontSize: FONT.xl, fontWeight: "800", marginTop: 2 }}>
                {auth.user?.name || auth.user?.email?.split("@")[0] || "User"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <PulseIndicator color={C.accent} />
              <Badge label={displayRole(auth.user?.role)} color={isAdminRole(auth.user?.role) ? C.purple : C.blue} />
            </View>
          </View>

          {/* Savings headline + animated energy flow — glass surface */}
          <Card variant="glass">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>{t("home.savingsTitle")}</Text>
                {savingsQ.isPending ? (
                  <SkeletonCard height={44} style={{ marginTop: 6, backgroundColor: "transparent", borderWidth: 0 }} />
                ) : (
                  <>
                    <Text style={{ color: C.accent, fontSize: 34, fontWeight: "900", letterSpacing: -1, marginTop: 4 }}>
                      €{(savingsQ.data?.total_eur ?? 0).toFixed(2)}
                    </Text>
                    <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 3 }}>
                      {savingsQ.data
                        ? t("home.savingsBreakdown", {
                            solar: savingsQ.data.solar_value_eur != null ? `€${savingsQ.data.solar_value_eur.toFixed(2)}` : "—",
                            trading: `€${savingsQ.data.trading_pnl_eur.toFixed(2)}`,
                          })
                        : ""}
                    </Text>
                  </>
                )}
              </View>
              <Badge label={isConnected ? t("home.live") : t("home.offline")} color={isConnected ? C.accent : C.muted} />
            </View>
            {savingsQ.data?.solar_value_is_estimate && (
              <Text style={{ color: C.muted, fontSize: FONT.xs, marginBottom: 8 }}>{t("home.savingsEstimateNote")}</Text>
            )}

            <EnergyFlow solarKw={live?.solar_kw ?? 0} batteryKw={live?.battery_kw ?? 0} />
          </Card>
        </LinearGradient>

        {/* Day-ahead price scrubber */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <SectionHeader title={t("home.priceScrubberTitle")} subtitle={t("home.priceScrubberSub")} />
          {pricesQ.isPending ? (
            <SkeletonCard height={110} />
          ) : (
            <View style={ss.card}>
              <PriceScrubber prices={pricesQ.data?.prices || []} plan={planQ.data} />
            </View>
          )}
        </View>

        {/* KPIs */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          {loading ? (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <SkeletonCard /><SkeletonCard />
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <KPI label={t("home.gridPrice")} value={gridPrice != null ? gridPrice.toFixed(2) : "—"} unit="€/kWh" color={C.amber} />
              <KPI label={t("home.activeAlerts")} value={alerts.length.toString()} unit="" color={alerts.length ? C.red : C.accent} />
            </View>
          )}

          {/* Sites overview */}
          <SectionHeader title={t("home.sites")} subtitle={t("home.sitesSubtitle", { active: online, other })} action={t("common.viewAll")} onAction={() => navigation.navigate("Energy")} />
          {loading ? (
            <SkeletonCard height={64} style={{ marginBottom: 10 }} />
          ) : sites.length === 0 ? (
            <ComingSoon icon="📍" label={t("home.noSitesTitle")} sub={t("home.noSitesSub")} />
          ) : sites.map(site => (
            <View key={site.id} style={[ss.card, { marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
              <StatusDot status={site.status === "active" ? "online" : "warning"} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{site.name}</Text>
                <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>
                  {site.location || "—"} · {site.solar_kw ? `${site.solar_kw}kW solar` : ""}{site.battery_kwh ? ` · ${site.battery_kwh}kWh battery` : ""}
                </Text>
              </View>
              <Badge label={site.status} color={site.status === "active" ? C.accent : C.amber} />
            </View>
          ))}

          {/* Alerts preview */}
          <SectionHeader title={t("home.activeAlerts")} subtitle={t("home.mostRecent")} action={t("common.manage")} onAction={() => navigation.navigate("Ops")} />
          {loading ? (
            <SkeletonCard height={56} />
          ) : alerts.length === 0 ? (
            <View style={[ss.card, { alignItems: "center", padding: 20 }]}>
              <Text style={{ color: C.sub, fontSize: FONT.sm }}>{t("home.noAlerts")}</Text>
            </View>
          ) : alerts.map(a => (
            <View key={a.id} style={[ss.card, { marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }]}>
              <Text style={{ fontSize: 16 }}>{a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.sm }}>{a.title}</Text>
                <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{a.device_name || "—"} · {timeAgo(a.fired_at)}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ height: 32 }} />
      </SafeAreaView>
    </ScrollView>
  )
}

export default HomeScreen
