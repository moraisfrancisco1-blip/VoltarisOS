import { registerWidgetTaskHandler } from "react-native-android-widget"
import { SavingsWidget } from "./SavingsWidget"
import { readCachedSnapshot } from "../lib/backgroundSync"

// Called by the OS (via react-native-android-widget's native bridge) any time
// the "Savings" widget is added, resized, or the system requests a repaint --
// independent of our own background sync tick (src/lib/backgroundSync.js),
// which is what actually refreshes the underlying data. This handler only
// ever renders whatever was last cached; it never calls the backend itself.
export function widgetTaskHandler(props) {
  const data = readCachedSnapshot()

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      props.renderWidget(<SavingsWidget data={data} />)
      return
    default:
      return
  }
}

export function registerSavingsWidgetHandler() {
  registerWidgetTaskHandler(widgetTaskHandler)
}
