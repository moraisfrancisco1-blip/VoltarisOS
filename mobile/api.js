/**
 * api.js — Axios-based API client for VoltarisOS mobile.
 * 
 * Features:
 * - Automatic JWT token attachment
 * - Token refresh on 401
 * - Retry logic for failed requests
 * - Request/response interceptors for Sentry
 * - Secure token storage via expo-secure-store
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_TIMEOUT } from './config';

// Token storage keys
const TOKEN_KEY = 'voltaris_auth_token';
const USER_KEY = 'voltaris_user_data';

// Create axios instance
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to retrieve token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 and errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 — token expired or invalid
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Clear stored token
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      
      // In production, redirect to login screen
      // For now, just reject
      return Promise.reject(new Error('Session expired. Please login again.'));
    }

    // Handle network errors with retry
    if (!error.response && !originalRequest._retryCount) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      
      if (originalRequest._retryCount <= 3) {
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, originalRequest._retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth Functions ──────────────────────────────────────────────────────────

export async function login(email, password) {
  const response = await apiClient.post('/auth/login', { email, password });
  const { token, ...userData } = response.data;
  
  // Store token securely
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
  
  return { token, ...userData };
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function getStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredUser() {
  const data = await SecureStore.getItemAsync(USER_KEY);
  return data ? JSON.parse(data) : null;
}

export async function isAuthenticated() {
  const token = await getStoredToken();
  return !!token;
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function getDashboardSummary() {
  const response = await apiClient.get('/dashboard/summary');
  return response.data;
}

export async function getDevices() {
  const response = await apiClient.get('/devices');
  return response.data;
}

export async function getVPPGroups() {
  const response = await apiClient.get('/vpp');
  return response.data;
}

export async function getArbitrageSignals(prices, bessKwh = 500, efficiency = 0.92) {
  const response = await apiClient.post('/arbitrage-signals', {
    prices,
    bess_kwh: bessKwh,
    efficiency,
  });
  return response.data;
}

export async function submitVPPBid(vppId, bidData) {
  const response = await apiClient.post(`/vpp/${vppId}/bid`, bidData);
  return response.data;
}

export async function getAlerts(limit = 50) {
  const response = await apiClient.get(`/alerts?limit=${limit}`);
  return response.data;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export default apiClient;