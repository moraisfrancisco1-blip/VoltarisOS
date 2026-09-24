import { useState, useEffect, useCallback } from "react"
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Switch, TextInput, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import * as api from "../../api"
import { useAuth } from "../auth/AuthContext"
import { APP_VERSION } from "../../config"
import { C, FONT, ss } from "../theme/tokens"
import { KPI, SectionHeader, Badge, ComingSoon } from "../ui"
import { displayRole } from "../lib/roles"
import { timeAgo } from "../lib/format"
import { success, error as errorHaptic } from "../lib/haptics"

function AdminScreen({ navigation }) {
  const auth = useAuth()
  const [tab, setTab] = useState("users")

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={ss.pageTitle}>Admin Panel</Text>
          <Text style={ss.pageSubtitle}>Tenant management & system config</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
          {[
            { id: "users", label: "Users" },
            { id: "system", label: "System" },
            { id: "api", label: "API Keys" },
            { id: "audit", label: "Audit" },
          ].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
              style={[ss.tabPill, tab === t.id && ss.tabPillActive]}>
              <Text style={[ss.tabPillText, tab === t.id && ss.tabPillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {tab === "users" && <UsersAdminTab />}
          {tab === "system" && <SystemTab />}
          {tab === "api" && <APIKeysTab />}
          {tab === "audit" && <AuditTab />}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function UsersAdminTab() {
  const [users, setUsers] = useState(null)

  useEffect(() => {
    api.getUsers().then(data => setUsers(data?.users || data || [])).catch(() => setUsers([]))
  }, [])

  const roleColor = (r) => (r === "SUPER_ADMIN" ? C.purple : r === "TENANT_ADMIN" ? C.blue : C.muted)

  if (!users) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <KPI label="Total Users" value={users.length.toString()} unit="" color={C.accent} />
        <KPI label="Active" value={users.filter(u => u.active !== false).length.toString()} unit="" color={C.blue} />
      </View>
      {users.map((u, i) => (
        <View key={u.id || i} style={[ss.card, { marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: roleColor(u.role) + "22", borderWidth: 1, borderColor: roleColor(u.role) + "44", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
            <Text style={{ color: roleColor(u.role), fontWeight: "800", fontSize: FONT.md }}>{(u.name || u.email || "?")[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{u.name || u.email}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{u.email}</Text>
          </View>
          <Badge label={displayRole(u.role)} color={roleColor(u.role)} />
        </View>
      ))}
    </View>
  )
}

function SystemTab() {
  const [settingsData, setSettingsData] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getTenantSettings().then(setSettingsData).catch(() => setSettingsData({}))
  }, [])

  const toggle = async (block, key, value) => {
    const next = { ...settingsData, [block]: { ...(settingsData[block] || {}), [key]: value } }
    setSettingsData(next)
    setSaving(true)
    try {
      await api.updateTenantSettings({ [block]: next[block] })
    } catch (e) {
      Alert.alert("Couldn't save setting", e.message || "")
    } finally {
      setSaving(false)
    }
  }

  if (!settingsData) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  const settings = [
    { label: "Push Notifications", sub: "Real-time alerts on mobile", value: !!settingsData.notifications?.pushAlerts, onChange: (v) => toggle("notifications", "pushAlerts", v), color: C.accent },
    { label: "Autonomous Trading", sub: "AI-driven market execution", value: !!settingsData.trading?.autoTradingEnabled, onChange: (v) => toggle("trading", "autoTradingEnabled", v), color: C.blue },
  ]

  return (
    <View>
      <SectionHeader title="System Settings" subtitle={saving ? "Saving…" : "Platform configuration"} />
      {settings.map((s, i) => (
        <View key={i} style={[ss.card, { marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{s.label}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{s.sub}</Text>
          </View>
          <Switch value={s.value} onValueChange={s.onChange} trackColor={{ false: C.border, true: s.color + "66" }} thumbColor={s.value ? s.color : C.muted} />
        </View>
      ))}

      <SectionHeader title="Platform Info" />
      {[
        { label: "App Version", value: APP_VERSION },
        { label: "API", value: "Railway · production" },
      ].map((item, i) => (
        <View key={i} style={[ss.card, { marginBottom: 8, flexDirection: "row", alignItems: "center" }]}>
          <Text style={{ color: C.sub, fontSize: FONT.md, flex: 1 }}>{item.label}</Text>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{item.value}</Text>
        </View>
      ))}
    </View>
  )
}

function APIKeysTab() {
  const [keys, setKeys] = useState(null)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [justCreated, setJustCreated] = useState(null)

  const load = useCallback(() => {
    api.getApiKeys().then(setKeys).catch(() => setKeys([]))
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await api.createApiKey({ name: newName.trim() })
      success()
      setJustCreated(created.key)
      setNewName("")
      load()
    } catch (e) {
      errorHaptic()
      Alert.alert("Couldn't create key", e.message || "")
    } finally {
      setCreating(false)
    }
  }

  const revoke = (id) => {
    Alert.alert("Revoke key?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Revoke", style: "destructive", onPress: async () => {
        try { await api.revokeApiKey(id); success(); load() }
        catch (e) { errorHaptic(); Alert.alert("Couldn't revoke key", e.message || "") }
      }},
    ])
  }

  if (!keys) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  return (
    <View>
      <SectionHeader title="API Keys" subtitle="Manage access tokens" />
      {justCreated && (
        <View style={[ss.card, { marginBottom: 12, borderColor: C.accent + "44" }]}>
          <Text style={{ color: C.accent, fontWeight: "700", fontSize: FONT.sm, marginBottom: 6 }}>New key — copy it now, it won't be shown again</Text>
          <Text style={{ color: C.text, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: FONT.xs }}>{justCreated}</Text>
        </View>
      )}
      {keys.length === 0 && (
        <View style={[ss.card, { alignItems: "center", padding: 20, marginBottom: 12 }]}>
          <Text style={{ color: C.sub, fontSize: FONT.sm }}>No API keys yet</Text>
        </View>
      )}
      {keys.map(k => (
        <View key={k.id} style={[ss.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{k.name}</Text>
              <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{k.key_prefix}••••••••</Text>
            </View>
            <TouchableOpacity onPress={() => revoke(k.id)}>
              <Text style={{ color: C.red, fontWeight: "700", fontSize: FONT.xs }}>Revoke</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: C.muted, fontSize: FONT.xs }}>
            Created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at ? ` · last used ${timeAgo(k.last_used_at)}` : " · never used"}
          </Text>
        </View>
      ))}
      <View style={[ss.card, { marginTop: 8, flexDirection: "row", gap: 8, alignItems: "center" }]}>
        <TextInput style={[ss.input, { flex: 1, paddingVertical: 10 }]} value={newName} onChangeText={setNewName}
          placeholder="Key name" placeholderTextColor={C.muted} />
        <TouchableOpacity onPress={create} disabled={creating || !newName.trim()}
          style={[ss.btn, { backgroundColor: C.accentL, borderColor: C.accent + "44" }]}>
          {creating ? <ActivityIndicator color={C.accent} size="small" /> : <Text style={{ color: C.accent, fontWeight: "700" }}>Create</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function AuditTab() {
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    api.getAuditLog({ limit: 50 }).then(d => setEntries(d?.entries || [])).catch(() => setEntries([]))
  }, [])

  if (!entries) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
  if (!entries.length) return <ComingSoon icon="📜" label="No audit entries yet" />

  return (
    <View>
      <SectionHeader title="Audit Log" subtitle="Security & compliance trail" />
      {entries.map(l => (
        <View key={l.id} style={[ss.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: C.accent }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md, flex: 1 }}>{l.action}</Text>
            {l.target_resource && <Badge label={l.target_resource} color={C.blue} />}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.sub, fontSize: FONT.xs }}>{l.user_email || "—"}</Text>
            <Text style={{ color: C.muted, fontSize: FONT.xs }}>{timeAgo(l.timestamp)}</Text>
          </View>
          {l.ip_address && (
            <Text style={{ color: C.muted, fontSize: FONT.xs, marginTop: 4, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{l.ip_address}</Text>
          )}
        </View>
      ))}
    </View>
  )
}


export default AdminScreen
