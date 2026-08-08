/**
 * config.js — Centralized configuration for VoltarisOS mobile app.
 * 
 * All configuration values are read from app.json extra or environment.
 * No hardcoded secrets or URLs in component code.
 */
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

// API Configuration
export const API_BASE_URL = extra.apiUrl || 'https://voltarisos-production.up.railway.app';
export const API_TIMEOUT = extra.apiTimeout || 30000; // 30 seconds

// WebSocket Configuration
export const WS_BASE_URL = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
export const WS_RECONNECT_INTERVAL = 5000; // 5 seconds
export const WS_MAX_RECONNECT_ATTEMPTS = 5;

// Sentry Configuration
export const SENTRY_DSN = extra.sentryDsn || '';
export const SENTRY_ENABLED = !!SENTRY_DSN && __DEV__ === false; // Only in production

// Feature Flags
export const FEATURES = {
  WEBSOCKET_ENABLED: true,
  SENTRY_ENABLED: SENTRY_ENABLED,
  OFFLINE_MODE: extra.offlineMode || false,
};

// App Info
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
export const BUILD_NUMBER = extra.buildNumber || '1';

export default {
  API_BASE_URL,
  API_TIMEOUT,
  WS_BASE_URL,
  WS_RECONNECT_INTERVAL,
  WS_MAX_RECONNECT_ATTEMPTS,
  SENTRY_DSN,
  SENTRY_ENABLED,
  FEATURES,
  APP_VERSION,
  BUILD_NUMBER,
};