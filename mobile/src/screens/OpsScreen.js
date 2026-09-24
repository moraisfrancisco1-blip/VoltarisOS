import { useState, useEffect, useCallback } from "react"
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import * as api from "../../api"
import { C, FONT, ss } from "../theme/tokens"
import { KPI, Badge, ComingSoon } from "../ui"
import { timeAgo } from "../lib/format"
import { success, error as errorHaptic } from "../lib/haptics"

function OpsScreen() {
  const [tab, setTab] = useState("alerts")

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={ss.pageTitle}>Operations</Text>
          <Text style={ss.pageSubtitle}>Monitoring · Maintenance · Compliance</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
          {[
            { id: "alerts", label: "Alerts" },
            { id: "maintenance", label: "Maintenance" },
            { id: "anomaly", label: "Anomaly" },
            { id: "reports", label: "Reports" },
          ].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
              style={[ss.tabPill, tab === t.id && ss.tabPillActive]}>
              <Text style={[ss.tabPillText, tab === t.id && ss.tabPillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {tab === "alerts" && <AlertsTab />}
          {tab === "maintenance" && <MaintenanceTab />}
          {tab === "anomaly" && <AnomalyTab />}
          {tab === "reports" && <ReportsTab />}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function AlertsTab() {
  const [filter, setFilter] = useState("all")
  const [alerts, setAlerts] = useState(null)

  const load = useCallback(() => {
    api.getAlerts(50).then(setAlerts).catch(() => setAlerts([]))
  }, [])
  useEffect(() => { load() }, [load])

  const ack = async (id) => {
    try {
      await api.ackAlert(id)
      success()
      load()
    } catch (e) {
      errorHaptic()
      Alert.alert("Couldn't acknowledge alert", e.message || "")
    }
  }

  if (!alerts) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  const filtered = filter === "all" ? alerts : alerts.filter(a => a.severity === filter)

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {["all", "critical", "warning", "info"].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[ss.tabPill, filter === f && ss.tabPillActive, { flex: 1 }]}>
            <Text style={[ss.tabPillText, filter === f && ss.tabPillTextActive, { textTransform: "capitalize", fontSize: FONT.xs }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Critical" value={alerts.filter(a => a.severity === "critical").length.toString()} unit="" color={C.red} />
        <KPI label="Warning" value={alerts.filter(a => a.severity === "warning").length.toString()} unit="" color={C.amber} />
        <KPI label="Info" value={alerts.filter(a => a.severity === "info").length.toString()} unit="" color={C.blue} />
      </View>
      {filtered.length === 0 && (
        <View style={[ss.card, { alignItems: "center", padding: 20 }]}>
          <Text style={{ color: C.sub, fontSize: FONT.sm }}>No alerts 🎉</Text>
        </View>
      )}
      {filtered.map(a => (
        <TouchableOpacity key={a.id} disabled={a.acknowledged} onPress={() => ack(a.id)}
          style={[ss.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: a.severity === "critical" ? C.red : a.severity === "warning" ? C.amber : C.blue, opacity: a.acknowledged ? 0.5 : 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontSize: 14, marginRight: 8 }}>{a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵"}</Text>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md, flex: 1 }}>{a.title}</Text>
            <Badge label={a.acknowledged ? "acked" : a.severity} color={a.acknowledged ? C.muted : a.severity === "critical" ? C.red : a.severity === "warning" ? C.amber : C.blue} />
          </View>
          {a.message && <Text style={{ color: C.sub, fontSize: FONT.xs }}>{a.message}</Text>}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>{a.device_name || "—"}</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>{timeAgo(a.fired_at)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function MaintenanceTab() {
  const [schedule, setSchedule] = useState(null)

  useEffect(() => {
    api.getMaintenanceSchedule().then(d => setSchedule(d?.schedule || [])).catch(() => setSchedule([]))
  }, [])

  if (!schedule) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  const corrective = schedule.filter(t => t.type === "corrective").length
  const inspection = schedule.filter(t => t.type === "inspection").length
  const scheduled = schedule.filter(t => t.type === "scheduled").length

  if (!schedule.length) return <ComingSoon icon="🛠️" label="Nothing due" sub="No maintenance items right now — great sign." />

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Corrective" value={corrective.toString()} unit="" color={C.red} />
        <KPI label="Inspection" value={inspection.toString()} unit="" color={C.amber} />
        <KPI label="Scheduled" value={scheduled.toString()} unit="" color={C.blue} />
      </View>
      {schedule.map(t => (
        <View key={t.id} style={[ss.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{t.asset_name || "Unknown asset"}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{t.site || "—"} · {t.type}</Text>
            </View>
            <Badge label={t.severity} color={t.severity === "critical" ? C.red : t.severity === "warning" ? C.amber : C.muted} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.sub, fontSize: FONT.xs }}>Due: {t.due_date}</Text>
            <Text style={{ color: t.days_remaining <= 0 ? C.red : C.blue, fontSize: FONT.xs, fontWeight: "600" }}>{t.days_remaining}d remaining</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function AnomalyTab() {
  return (
    <ComingSoon icon="🧠" label="ML anomaly detection — coming soon"
      sub="No anomaly-detection model is wired into the backend yet." />
  )
}

function ReportsTab() {
  return (
    <ComingSoon icon="📄" label="Reports — coming soon"
      sub="Report generation isn't available in the backend yet." />
  )
}

export default OpsScreen
