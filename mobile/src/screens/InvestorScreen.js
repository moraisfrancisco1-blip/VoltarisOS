import { View, Text, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { C, FONT, ss } from "../theme/tokens"
import { ComingSoon } from "../ui"

function InvestorScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1, justifyContent: "center" }}>
          <View style={{ marginBottom: 24 }}>
            <Text style={ss.pageTitle}>Investor Dashboard</Text>
            <Text style={ss.pageSubtitle}>Portfolio performance</Text>
          </View>
          <ComingSoon icon="💼" label="Investor reporting is in development"
            sub="Portfolio value, IRR and asset-breakdown metrics need real financial data behind them — nothing is shown until that's built." />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}


export default InvestorScreen
