import { FlexWidget, TextWidget } from "react-native-android-widget"
import { C } from "../theme/tokens"
import i18n from "../i18n"

// Renders the Android home-screen "Savings" widget. Pure presentational --
// it never fetches data itself, only draws whatever snapshot it's given (see
// src/lib/backgroundSync.js, which is the only writer of that snapshot).
// `data` is null until the first successful background sync ever completes.
export function SavingsWidget({ data }) {
  if (!data) {
    return (
      <FlexWidget
        style={{
          height: "match_parent", width: "match_parent",
          backgroundColor: C.bg, borderRadius: 16, padding: 12,
          justifyContent: "center", alignItems: "center",
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget text="VoltarisOS" style={{ color: C.text, fontSize: 14, fontWeight: "700" }} />
        <TextWidget text={i18n.t("common.loading")} style={{ color: C.sub, fontSize: 11, marginTop: 4 }} />
      </FlexWidget>
    )
  }

  const { solarKw, batteryKw, totalEur, labels } = data

  return (
    <FlexWidget
      style={{
        height: "match_parent", width: "match_parent",
        backgroundColor: C.bg, borderRadius: 16, padding: 14,
        flexDirection: "column", justifyContent: "space-between",
      }}
      clickAction="OPEN_APP"
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <TextWidget text="VoltarisOS" style={{ color: C.sub, fontSize: 11, fontWeight: "600" }} />
        <TextWidget text={labels.savingsTitle} style={{ color: C.sub, fontSize: 10 }} />
      </FlexWidget>

      <TextWidget
        text={`€${totalEur.toFixed(2)}`}
        style={{ color: C.accent, fontSize: 30, fontWeight: "900", marginTop: 2 }}
      />

      <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <TextWidget text={`☀ ${solarKw.toFixed(1)}kW`} style={{ color: C.amber, fontSize: 13, fontWeight: "700" }} />
        <TextWidget text={`⚡ ${batteryKw.toFixed(1)}kW`} style={{ color: C.blue, fontSize: 13, fontWeight: "700" }} />
      </FlexWidget>
    </FlexWidget>
  )
}
