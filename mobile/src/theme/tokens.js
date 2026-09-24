import { StyleSheet } from "react-native"

// ─── Design tokens ──────────────────────────────────────────────────
// Dark-first palette (this app has no light mode). Kept the same identity
// (electric teal accent on near-black) that shipped before Phase 1 — this
// is a refinement pass, not a rebrand.
export const C = {
  bg:      "#070d19",
  card:    "#0d1629",
  card2:   "#111f35",
  border:  "#1a2d4a",
  accent:  "#00e5a0",   // electric teal-green
  blue:    "#3b82f6",
  purple:  "#a855f7",
  amber:   "#f59e0b",
  red:     "#ef4444",
  orange:  "#f97316",
  muted:   "#4b6185",
  text:    "#e8f0fe",
  sub:     "#7a99c2",
  white:   "#ffffff",
  glass:   "rgba(255,255,255,0.04)",
  glassB:  "rgba(255,255,255,0.08)",
  accentD: "#00b37a",
  accentL: "rgba(0,229,160,0.12)",
  // Glass-surface tokens for the expo-blur Card variant (Liquid-Glass-ish panels)
  glassTint: "rgba(13,22,41,0.55)",   // tinted blur overlay color
  glassBorder: "rgba(255,255,255,0.10)",
}

export const FONT = {
  xs:   11,
  sm:   12,
  md:   14,
  base: 15,
  lg:   17,
  xl:   20,
  "2xl": 24,
  "3xl": 30,
}

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 28 }
export const RADIUS = { sm: 8, md: 12, lg: 14, xl: 18, "2xl": 24, pill: 50 }

// ─── Shared styles ──────────────────────────────────────────────────
// Kept as the same `ss.card`/`ss.btn`/etc. shape every screen already
// references, so existing screen bodies don't need touching just to move
// files. New code should prefer the components in src/ui instead.
export const ss = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  pageTitle: { color: C.text, fontSize: FONT["2xl"], fontWeight: "900", letterSpacing: -0.6 },
  pageSubtitle: { color: C.sub, fontSize: FONT.sm, marginTop: 4 },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    color: C.text,
    fontSize: FONT.base,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    color: C.sub,
    fontSize: FONT.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tabPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 50,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabPillActive: {
    backgroundColor: C.accentL,
    borderColor: C.accent + "44",
  },
  tabPillText: {
    color: C.sub,
    fontSize: FONT.sm,
    fontWeight: "700",
  },
  tabPillTextActive: {
    color: C.accent,
  },
})
