import { useEffect } from "react"
import { View, Text, StyleSheet } from "react-native"
import { Canvas, Line, Circle, vec } from "@shopify/react-native-skia"
import { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing } from "react-native-reanimated"
import { useTranslation } from "react-i18next"
import { C, FONT } from "../theme/tokens"

const W = 300
const H = 210

// Casa sits at the hub; Sol/Bateria/Rede/Carro sit around it. Only Sol and
// Bateria have real per-device telemetry (backend/dashboard_metrics.py) — see
// the Phase 2 plan for why Casa/Rede are a disclosed estimate and Carro has
// no live line at all.
const NODES = {
  casa:    { x: W / 2, y: H / 2, icon: "🏠" },
  sol:     { x: W / 2, y: 22, icon: "☀️" },
  bateria: { x: 34, y: H - 30, icon: "🔋" },
  rede:    { x: W - 34, y: H - 30, icon: "🔌" },
  carro:   { x: W - 34, y: H / 2, icon: "🚗" },
}

// Maps a kW magnitude to an orbit duration (ms) for the flow particle — more
// power flowing = faster particle, clamped to a sane visual range.
function speedForKw(kw) {
  const mag = Math.min(Math.abs(kw), 10)
  return 2200 - mag * 150 // 2200ms idle-ish down to ~700ms at 10kW
}

function strokeForKw(kw) {
  return Math.min(2 + Math.abs(kw) * 0.8, 9)
}

function FlowParticle({ from, to, active, speedMs, color }) {
  const progress = useSharedValue(0)

  useEffect(() => {
    if (active) {
      progress.value = withRepeat(withTiming(1, { duration: speedMs, easing: Easing.linear }), -1, false)
    } else {
      progress.value = 0
    }
  }, [active, speedMs])

  const cx = useDerivedValue(() => from.x + (to.x - from.x) * progress.value)
  const cy = useDerivedValue(() => from.y + (to.y - from.y) * progress.value)

  if (!active) return null
  return <Circle cx={cx} cy={cy} r={4} color={color} />
}

function FlowLine({ from, to, strokeWidth, color, dashed }) {
  return (
    <Line
      p1={vec(from.x, from.y)}
      p2={vec(to.x, to.y)}
      color={color}
      style="stroke"
      strokeWidth={strokeWidth}
      strokeCap="round"
      {...(dashed ? { strokeDash: [4, 6] } : {})}
    />
  )
}

function NodeLabel({ node, label, value, dim }) {
  return (
    <View style={[styles.nodeLabel, { left: node.x - 34, top: node.y - 30, opacity: dim ? 0.4 : 1 }]}>
      <Text style={{ fontSize: 20 }}>{node.icon}</Text>
      <Text style={styles.nodeName}>{label}</Text>
      {value != null && <Text style={styles.nodeValue}>{value}</Text>}
    </View>
  )
}

/**
 * EnergyFlow — animated Sol/Casa/Bateria/Rede/Carro diagram.
 * solarKw / batteryKw: real, live (from /ws/dashboard, see useWebSocket).
 * Casa/Rede are computed here as a single disclosed estimate (net = solar -
 * battery draw); Carro has no telemetry anywhere in the backend yet, so it
 * renders dimmed with no animated line, same as the EV tab's "coming soon".
 */
function EnergyFlow({ solarKw = 0, batteryKw = 0 }) {
  const { t } = useTranslation()

  const netKw = solarKw - batteryKw
  const homeEstKw = Math.max(netKw, 0)
  const gridEstKw = Math.max(-netKw, 0)
  const batteryCharging = batteryKw < 0
  const batteryDischarging = batteryKw > 0

  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <Canvas style={{ width: W, height: H }}>
        {/* Static dimmed line to the car — no telemetry to animate */}
        <FlowLine from={NODES.casa} to={NODES.carro} strokeWidth={2} color={C.border} dashed />

        <FlowLine from={NODES.sol} to={NODES.casa} strokeWidth={strokeForKw(solarKw)} color={C.amber + "55"} />
        <FlowParticle from={NODES.sol} to={NODES.casa} active={solarKw > 0.05} speedMs={speedForKw(solarKw)} color={C.amber} />

        <FlowLine from={NODES.bateria} to={NODES.casa} strokeWidth={strokeForKw(batteryKw)} color={C.blue + "55"} />
        <FlowParticle
          from={batteryDischarging ? NODES.bateria : NODES.casa}
          to={batteryDischarging ? NODES.casa : NODES.bateria}
          active={batteryCharging || batteryDischarging}
          speedMs={speedForKw(batteryKw)}
          color={C.blue}
        />

        <FlowLine from={NODES.casa} to={NODES.rede} strokeWidth={strokeForKw(netKw)} color={C.purple + "55"} />
        <FlowParticle
          from={gridEstKw > 0.05 ? NODES.rede : NODES.casa}
          to={gridEstKw > 0.05 ? NODES.casa : NODES.rede}
          active={Math.abs(netKw) > 0.05}
          speedMs={speedForKw(netKw)}
          color={C.purple}
        />
      </Canvas>

      <NodeLabel node={NODES.sol} label={t("home.nodeSol")} value={`${solarKw.toFixed(1)} kW`} />
      <NodeLabel node={NODES.bateria} label={t("home.nodeBateria")} value={`${Math.abs(batteryKw).toFixed(1)} kW`} />
      <NodeLabel node={NODES.rede} label={t("home.nodeRede")} value={`~${gridEstKw.toFixed(1)} kW`} dim />
      <NodeLabel node={NODES.carro} label={t("home.nodeCarro")} value={t("home.noLiveData")} dim />
      <NodeLabel node={NODES.casa} label={t("home.nodeCasa")} value={`~${homeEstKw.toFixed(1)} kW`} dim />

      <Text style={styles.estimateNote}>{t("home.flowEstimateNote")}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  nodeLabel: { position: "absolute", width: 68, alignItems: "center" },
  nodeName: { color: C.sub, fontSize: FONT.xs, fontWeight: "700", marginTop: 2 },
  nodeValue: { color: C.text, fontSize: FONT.xs, fontWeight: "800", marginTop: 1 },
  estimateNote: { color: C.muted, fontSize: FONT.xs, marginTop: 10, textAlign: "center" },
})

export default EnergyFlow
