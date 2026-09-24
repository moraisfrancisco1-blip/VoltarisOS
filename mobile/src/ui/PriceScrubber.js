import { useState, useRef } from "react"
import { View, Text, PanResponder, StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"
import { C, FONT, RADIUS } from "../theme/tokens"
import { selection } from "../lib/haptics"

const BAR_GAP = 2

function actionForDispatch(dispatchKw) {
  if (dispatchKw == null) return null
  if (dispatchKw > 0.1) return "discharge"
  if (dispatchKw < -0.1) return "charge"
  return "hold"
}

const ACTION_COLOR = { charge: C.accent, discharge: C.amber, hold: C.muted }

/**
 * PriceScrubber — 24h day-ahead price bars; drag a finger across to scrub
 * hour by hour (haptic tick per hour crossed). If an optimizer `plan` is
 * supplied (see useOptimizerPlan), the scrubbed hour also shows the real
 * MILP-derived action for that hour (vpp_dispatch sign: charge/discharge/
 * hold) — otherwise it shows a "no plan yet" state instead of a blank chart.
 */
function PriceScrubber({ prices = [], plan, height = 90 }) {
  const { t } = useTranslation()
  const [selectedIdx, setSelectedIdx] = useState(null)
  const widthRef = useRef(0)
  const lastIdxRef = useRef(null)

  if (!prices.length) return null

  const values = prices.map(p => p.price)
  const maxP = Math.max(...values)
  const minP = Math.min(...values)

  const indexFromX = (x) => {
    const w = widthRef.current || 1
    const idx = Math.floor((x / w) * prices.length)
    return Math.max(0, Math.min(prices.length - 1, idx))
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const idx = indexFromX(e.nativeEvent.locationX)
        lastIdxRef.current = idx
        setSelectedIdx(idx)
      },
      onPanResponderMove: (e) => {
        const idx = indexFromX(e.nativeEvent.locationX)
        if (idx !== lastIdxRef.current) {
          lastIdxRef.current = idx
          selection()
          setSelectedIdx(idx)
        }
      },
      onPanResponderRelease: () => {},
    })
  ).current

  const active = selectedIdx != null ? prices[selectedIdx] : null
  const activeDispatch = plan?.vpp_dispatch && selectedIdx != null ? plan.vpp_dispatch[selectedIdx] : null
  const action = actionForDispatch(activeDispatch)

  return (
    <View>
      <View
        style={{ height, flexDirection: "row", alignItems: "flex-end", gap: BAR_GAP }}
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width }}
        {...panResponder.panHandlers}
      >
        {prices.map((p, i) => {
          const h = maxP > minP ? ((p.price - minP) / (maxP - minP)) * (height - 8) + 8 : height / 2
          const isSelected = i === selectedIdx
          const barAction = actionForDispatch(plan?.vpp_dispatch?.[i])
          return (
            <View key={i} style={{ flex: 1, height, justifyContent: "flex-end" }}>
              <View
                style={{
                  height: h,
                  borderRadius: RADIUS.sm / 2,
                  backgroundColor: isSelected ? C.text : barAction ? ACTION_COLOR[barAction] + "88" : C.amber + "66",
                }}
              />
            </View>
          )
        })}
      </View>

      <View style={styles.readout}>
        {active ? (
          <>
            <Text style={styles.hour}>{active.hour}</Text>
            <Text style={styles.price}>{active.price.toFixed(2)} €/kWh</Text>
            {action ? (
              <View style={[styles.actionPill, { backgroundColor: ACTION_COLOR[action] + "22", borderColor: ACTION_COLOR[action] + "44" }]}>
                <Text style={{ color: ACTION_COLOR[action], fontSize: FONT.xs, fontWeight: "700" }}>
                  {t(`home.plan${action.charAt(0).toUpperCase()}${action.slice(1)}`)}
                </Text>
              </View>
            ) : (
              <Text style={styles.noPlan}>{t("home.noOptimizerPlan")}</Text>
            )}
          </>
        ) : (
          <Text style={styles.hint}>{t("home.scrubberHint")}</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  readout: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
  hour: { color: C.text, fontWeight: "800", fontSize: FONT.md },
  price: { color: C.amber, fontWeight: "700", fontSize: FONT.sm },
  actionPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, borderWidth: 1 },
  noPlan: { color: C.muted, fontSize: FONT.xs },
  hint: { color: C.muted, fontSize: FONT.xs },
})

export default PriceScrubber
