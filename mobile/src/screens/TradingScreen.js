import { useState, useEffect } from "react"
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"

import * as api from "../../api"
import { C, FONT, ss } from "../theme/tokens"
import { KPI, SectionHeader, Badge, ComingSoon } from "../ui"

function TradingScreen() {
  const [tab, setTab] = useState("market")
  const [groups, setGroups] = useState(null)

  useEffect(() => {
    api.getVPPGroups().then(setGroups).catch(() => setGroups([]))
  }, [])

  const selectedVppId = groups?.[0]?.id

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={ss.pageTitle}>Trading</Text>
          <Text style={ss.pageSubtitle}>Day-ahead market · VPP bidding</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
          {[{ id: "market", label: "Market" }, { id: "vpp", label: "VPP" }, { id: "bids", label: "Bids" }, { id: "pnl", label: "P&L" }].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
              style={[ss.tabPill, tab === t.id && ss.tabPillActive]}>
              <Text style={[ss.tabPillText, tab === t.id && ss.tabPillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {tab === "market" && <MarketTab vppId={selectedVppId} />}
          {tab === "vpp" && <VPPTab groups={groups} />}
          {tab === "bids" && <BidsTab vppId={selectedVppId} />}
          {tab === "pnl" && <PnLTab vppId={selectedVppId} />}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function MarketTab({ vppId }) {
  const [prices, setPrices] = useState(null)
  const [perf, setPerf] = useState(null)

  useEffect(() => {
    api.getDayAheadPrices().then(d => setPrices(d?.prices || [])).catch(() => setPrices([]))
  }, [])
  useEffect(() => {
    if (vppId) api.getVppPerformance(vppId).then(setPerf).catch(() => setPerf(null))
  }, [vppId])

  if (!prices) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />

  const values = prices.map(p => p.price)
  const maxP = values.length ? Math.max(...values) : 0
  const minP = values.length ? Math.min(...values) : 0
  const nowHour = `${String(new Date().getHours()).padStart(2, "0")}:00`
  const nowIdx = prices.findIndex(p => p.hour === nowHour)
  const currentPrice = nowIdx >= 0 ? prices[nowIdx].price : null

  return (
    <View>
      <LinearGradient colors={["rgba(245,158,11,0.12)", "rgba(245,158,11,0.02)"]}
        style={{ borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.amber + "30", marginBottom: 16 }}>
        <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>Current Spot Price</Text>
        <Text style={{ color: C.amber, fontSize: 52, fontWeight: "900", letterSpacing: -2, marginTop: 6 }}>
          {currentPrice != null ? currentPrice.toFixed(2) : "—"}<Text style={{ fontSize: FONT.lg, color: C.sub }}> €/kWh</Text>
        </Text>
        <Text style={{ color: C.amber + "99", fontSize: FONT.sm, marginTop: 4 }}>{nowHour} · day-ahead</Text>

        {values.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 72 }}>
              {prices.map((p, i) => {
                const h = maxP > minP ? ((p.price - minP) / (maxP - minP)) * 56 + 8 : 30
                const isNow = i === nowIdx
                return (
                  <View key={i} style={{
                    flex: 1, height: h,
                    backgroundColor: isNow ? C.accent : C.amber + "66",
                    borderRadius: 2,
                  }} />
                )
              })}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>{prices[0]?.hour}</Text>
              <Text style={{ color: C.accent, fontSize: FONT.xs }}>NOW</Text>
              <Text style={{ color: C.muted, fontSize: FONT.xs }}>{prices[prices.length - 1]?.hour}</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <KPI label={`P&L (${perf?.period_days ?? 30}d)`} value={perf ? `€${perf.total_pnl_eur.toFixed(0)}` : "—"} unit="" color={C.accent} />
        <KPI label="Total Bids" value={perf ? perf.total_bids.toString() : "—"} unit="" color={C.blue} />
        <KPI label="Accepted" value={perf ? `${perf.acceptance_rate_pct}%` : "—"} unit="" color={C.accent} />
      </View>
    </View>
  )
}

function VPPTab({ groups }) {
  const [aggregates, setAggregates] = useState({})

  useEffect(() => {
    if (!groups?.length) return
    groups.forEach(g => {
      api.getVppAggregate(g.id).then(a => setAggregates(prev => ({ ...prev, [g.id]: a }))).catch(() => {})
    })
  }, [groups])

  if (!groups) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
  if (!groups.length) return <ComingSoon icon="🔗" label="No VPP groups yet" sub="Create a Virtual Power Plant group in VoltarisOS to see it here." />

  return (
    <View>
      <SectionHeader title="VPP Groups" subtitle="Virtual Power Plant aggregation" />
      {groups.map(g => {
        const agg = aggregates[g.id]
        return (
          <View key={g.id} style={[ss.card, { marginBottom: 10 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md }}>{g.name}</Text>
                <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{agg?.site_count ?? 0} sites · {g.market}</Text>
              </View>
              <Badge label={g.active ? "active" : "inactive"} color={g.active ? C.accent : C.muted} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: FONT.xs }}>Power</Text>
                <Text style={{ color: C.accent, fontWeight: "800", fontSize: FONT.lg }}>{agg?.total_power_kw != null ? `${agg.total_power_kw} kW` : "—"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: FONT.xs }}>Min bid</Text>
                <Text style={{ color: C.blue, fontWeight: "800", fontSize: FONT.lg }}>{g.min_bid_kw} kW</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: FONT.xs }}>Can bid</Text>
                <Text style={{ color: agg?.can_bid ? C.accent : C.muted, fontWeight: "800", fontSize: FONT.lg }}>{agg ? (agg.can_bid ? "Yes" : "No") : "—"}</Text>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function BidsTab({ vppId }) {
  const [bids, setBids] = useState(null)

  useEffect(() => {
    if (!vppId) { setBids([]); return }
    api.getVppBids(vppId).then(setBids).catch(() => setBids([]))
  }, [vppId])

  if (!bids) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
  if (!bids.length) return <ComingSoon icon="📋" label="No bids yet" sub="Bids submitted for this VPP group will show up here." />

  return (
    <View>
      <SectionHeader title="Bids" subtitle={`${bids.length} total`} />
      {bids.map(b => (
        <View key={b.id} style={[ss.card, { marginBottom: 8, flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: FONT.md, textTransform: "capitalize" }}>{b.direction} · {b.market}</Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{b.status} · {new Date(b.submitted_at).toLocaleDateString()}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: (b.pnl_eur ?? 0) >= 0 ? C.accent : C.red, fontWeight: "800", fontSize: FONT.md }}>
              {b.pnl_eur != null ? `${b.pnl_eur >= 0 ? "+" : ""}€${b.pnl_eur.toFixed(0)}` : "—"}
            </Text>
            <Text style={{ color: C.sub, fontSize: FONT.xs, marginTop: 2 }}>{b.quantity_kw} kW{b.price_eur_mwh != null ? ` @ €${b.price_eur_mwh}/MWh` : ""}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function PnLTab({ vppId }) {
  const [perf, setPerf] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!vppId) { setLoading(false); return }
    api.getVppPerformance(vppId).then(setPerf).catch(() => {}).finally(() => setLoading(false))
  }, [vppId])

  if (loading) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
  if (!perf) return <ComingSoon icon="💹" label="No P&L data yet" sub="Once this VPP group has accepted bids, P&L shows here." />

  return (
    <View>
      <LinearGradient colors={["rgba(0,229,160,0.10)", "rgba(0,229,160,0.02)"]}
        style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.accent + "25", marginBottom: 16 }}>
        <Text style={{ color: C.sub, fontSize: FONT.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>P&L — last {perf.period_days} days</Text>
        <Text style={{ color: C.accent, fontSize: 42, fontWeight: "900", letterSpacing: -1 }}>€{(perf.total_pnl_eur / 1000).toFixed(1)}K</Text>
        <Text style={{ color: C.sub, fontSize: FONT.sm, marginTop: 4 }}>{perf.accepted} of {perf.total_bids} bids accepted · avg €{perf.avg_pnl_per_bid_eur.toFixed(0)}/bid</Text>
      </LinearGradient>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <KPI label="Total kWh" value={perf.total_kwh.toFixed(0)} unit="kWh" color={C.blue} />
        <KPI label="Acceptance" value={`${perf.acceptance_rate_pct}%`} unit="" color={C.accent} />
      </View>
    </View>
  )
}

export default TradingScreen
