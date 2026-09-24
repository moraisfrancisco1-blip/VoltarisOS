import { MMKV } from "react-native-mmkv"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"

// Non-sensitive local cache/prefs (the JWT itself stays in expo-secure-store,
// see api.js — this is only for cached query results and small UI prefs
// like "last selected VPP group" or a locale override).
export const storage = new MMKV({ id: "voltarisos-cache" })

// Adapts MMKV's sync string API to the getItem/setItem/removeItem shape
// TanStack Query's sync persister expects.
const mmkvStorageAdapter = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}

export const queryPersister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  key: "voltarisos-query-cache",
})
