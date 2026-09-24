import * as Sentry from "@sentry/react-native"
import { SENTRY_DSN, SENTRY_ENABLED, APP_VERSION } from "../../config"

let initialized = false

/** Call once from App.js before rendering. No-ops when no DSN is configured
 * (config.js's SENTRY_ENABLED is already false in that case) so local/dev
 * builds never try to report anywhere. */
export function initSentry() {
  if (initialized || !SENTRY_ENABLED) return
  Sentry.init({
    dsn: SENTRY_DSN,
    release: APP_VERSION,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
  })
  initialized = true
}

export const isSentryReady = () => initialized
export { Sentry }
