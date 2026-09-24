import { QueryClient } from "@tanstack/react-query"

// staleTime > 0 means a screen paints instantly from cache on remount/relaunch
// without an immediate refetch flash; gcTime is how long a query survives in
// memory (and, combined with maxAge on the persister, on disk) after no
// component uses it anymore.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30s — live energy data ages fast
      gcTime: 24 * 60 * 60 * 1000, // 24h — keep yesterday's cache for instant cold-start
      retry: 2,
      refetchOnReconnect: true,
    },
  },
})

// How long persisted cache entries are trusted before being discarded outright
// (separate from staleTime — this is "too old to even show" not "needs refresh").
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000
