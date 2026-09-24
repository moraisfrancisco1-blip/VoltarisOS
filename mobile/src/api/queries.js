import { useQuery } from "@tanstack/react-query"
import * as api from "../../api"

// Phase 1 migrates the Home screen's fetching to TanStack Query (cached +
// persisted via MMKV, see src/lib/queryClient.js) as the reference
// implementation. Other screens still fetch with plain useEffect for now —
// see the Phase 1 plan's stated scope boundary; they can adopt these same
// hooks incrementally without changing this file's shape.

export function useSites() {
  return useQuery({
    queryKey: ["sites"],
    queryFn: api.getSites,
  })
}

export function useAlerts(limit = 50) {
  return useQuery({
    queryKey: ["alerts", limit],
    queryFn: () => api.getAlerts(limit),
  })
}

export function useDayAheadPrices() {
  return useQuery({
    queryKey: ["prices", "day-ahead"],
    queryFn: api.getDayAheadPrices,
    staleTime: 10 * 60 * 1000, // day-ahead prices are set once per day
  })
}

export function useVppGroups() {
  return useQuery({
    queryKey: ["vpp-groups"],
    queryFn: api.getVPPGroups,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSavingsToday() {
  return useQuery({
    queryKey: ["savings", "today"],
    queryFn: api.getSavingsToday,
    staleTime: 5 * 60 * 1000,
  })
}

// Runs the real MILP optimizer for a VPP group (POST, but idempotent-ish
// against the same day's prices) — staleTime kept long so scrubbing the
// price chart doesn't re-trigger the solver on every render.
export function useOptimizerPlan(vppId) {
  return useQuery({
    queryKey: ["vpp", vppId, "optimize"],
    queryFn: () => api.optimizeVpp(vppId),
    enabled: !!vppId,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  })
}
