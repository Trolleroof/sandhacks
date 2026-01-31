"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import type { ConnectionStatus } from "../store/appStore";

interface UseApiStatusOptions {
  /** Polling interval in ms (default: 10000) */
  pollInterval?: number;
  /** Whether to start polling immediately (default: true) */
  autoStart?: boolean;
  /** Callback when status changes */
  onStatusChange?: (status: ConnectionStatus) => void;
}

export function useApiStatus(options: UseApiStatusOptions = {}) {
  const {
    pollInterval = 10000,
    autoStart = true,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      const isHealthy = await api.checkHealth();
      const newStatus: ConnectionStatus = isHealthy ? "connected" : "offline";

      setStatus((prevStatus) => {
        if (prevStatus !== newStatus) {
          onStatusChange?.(newStatus);
        }
        return newStatus;
      });
    } catch {
      setStatus((prevStatus) => {
        if (prevStatus !== "offline") {
          onStatusChange?.("offline");
        }
        return "offline";
      });
    } finally {
      setIsChecking(false);
      setLastChecked(new Date());
    }
  }, [onStatusChange]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    // Check immediately
    checkStatus();

    // Then poll at interval
    intervalRef.current = setInterval(checkStatus, pollInterval);
  }, [checkStatus, pollInterval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const setMockMode = useCallback(() => {
    stopPolling();
    setStatus("mock");
    onStatusChange?.("mock");
  }, [stopPolling, onStatusChange]);

  // Start polling on mount if autoStart is true
  useEffect(() => {
    if (autoStart) {
      startPolling();
    }
    return () => stopPolling();
  }, [autoStart, startPolling, stopPolling]);

  return {
    status,
    isChecking,
    lastChecked,
    checkStatus,
    startPolling,
    stopPolling,
    setMockMode,
  };
}

export default useApiStatus;
