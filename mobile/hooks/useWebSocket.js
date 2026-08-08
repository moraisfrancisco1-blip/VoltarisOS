/**
 * useWebSocket.js — React hook for WebSocket connections to VoltarisOS backend.
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - JWT token authentication
 * - Connection state management
 * - Message parsing and callbacks
 * - Cleanup on unmount
 * 
 * Usage:
 *   const { lastMessage, connectionStatus, sendMessage } = useWebSocket('/ws/dashboard');
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_BASE_URL, WS_RECONNECT_INTERVAL, WS_MAX_RECONNECT_ATTEMPTS } from '../config';
import { getStoredToken } from '../api';

// Connection states
export const CONNECTION_STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
};

export function useWebSocket(endpoint, options = {}) {
  const {
    onMessage = null,
    onOpen = null,
    onClose = null,
    onError = null,
    enabled = true,
  } = options;

  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Build WebSocket URL
  const buildWsUrl = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    return `${WS_BASE_URL}${endpoint}?token=${token}`;
  }, [endpoint]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!enabled) return;

    try {
      setConnectionStatus(CONNECTION_STATUS.CONNECTING);
      setError(null);

      const url = await buildWsUrl();
      const ws = new WebSocket(url);

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus(CONNECTION_STATUS.CONNECTED);
        reconnectAttemptsRef.current = 0;
        onOpen?.();
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          onMessage?.(data);
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;
        setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
        onClose?.(event);
        
        // Attempt reconnection if not manually closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < WS_MAX_RECONNECT_ATTEMPTS) {
          scheduleReconnect();
        }
      };

      ws.onerror = (event) => {
        if (!isMountedRef.current) return;
        setConnectionStatus(CONNECTION_STATUS.ERROR);
        setError('WebSocket connection error');
        onError?.(event);
      };

      wsRef.current = ws;
    } catch (e) {
      setError(e.message);
      setConnectionStatus(CONNECTION_STATUS.ERROR);
      scheduleReconnect();
    }
  }, [enabled, buildWsUrl, onOpen, onMessage, onClose, onError]);

  // Schedule reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (!isMountedRef.current) return;
    
    reconnectAttemptsRef.current += 1;
    const delay = Math.min(
      WS_RECONNECT_INTERVAL * Math.pow(2, reconnectAttemptsRef.current - 1),
      30000 // Max 30 seconds
    );
    
    setConnectionStatus(CONNECTION_STATUS.RECONNECTING);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, delay);
  }, [connect]);

  // Send message through WebSocket
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
  }, []);

  // Initial connection
  useEffect(() => {
    isMountedRef.current = true;
    
    if (enabled) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [enabled]); // Only reconnect when enabled changes

  return {
    connectionStatus,
    lastMessage,
    error,
    sendMessage,
    connect,
    disconnect,
    isConnected: connectionStatus === CONNECTION_STATUS.CONNECTED,
  };
}

export default useWebSocket;