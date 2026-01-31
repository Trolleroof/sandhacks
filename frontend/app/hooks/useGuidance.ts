"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, mockApi } from "../lib/api";
import type { GuidanceData, ObjectLocation } from "../lib/mockData";

interface UseGuidanceOptions {
  /** Polling interval in ms (default: 800) */
  pollInterval?: number;
  /** Whether to use mock data (default: false) */
  useMock?: boolean;
  /** Threshold in meters to consider "arrived" (default: 0.5) */
  arrivalThreshold?: number;
  /** Callback when guidance updates */
  onUpdate?: (guidance: GuidanceData) => void;
  /** Callback when user arrives */
  onArrival?: (target: ObjectLocation) => void;
}

export function useGuidance(options: UseGuidanceOptions = {}) {
  const {
    pollInterval = 800,
    useMock = false,
    arrivalThreshold = 0.5,
    onUpdate,
    onArrival,
  } = options;

  const [guidance, setGuidance] = useState<GuidanceData | null>(null);
  const [target, setTarget] = useState<ObjectLocation | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetRef = useRef<ObjectLocation | null>(null);

  // Update ref when target changes
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  const fetchGuidance = useCallback(async () => {
    if (!targetRef.current) return;

    const apiClient = useMock ? mockApi : api;

    try {
      const result = await apiClient.navigation.getGuidance(targetRef.current.id);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.guidance) {
        // Check if arrived
        const arrived = result.guidance.distance <= arrivalThreshold;
        const updatedGuidance = { ...result.guidance, arrived };

        setGuidance(updatedGuidance);
        setError(null);
        onUpdate?.(updatedGuidance);

        if (arrived && targetRef.current) {
          onArrival?.(targetRef.current);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Guidance error");
    }
  }, [useMock, arrivalThreshold, onUpdate, onArrival]);

  const startGuidance = useCallback(
    (targetObject: ObjectLocation) => {
      // Stop any existing guidance
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      setTarget(targetObject);
      setIsActive(true);
      setError(null);

      // Fetch immediately
      targetRef.current = targetObject;
      fetchGuidance();

      // Then poll at interval
      intervalRef.current = setInterval(fetchGuidance, pollInterval);
    },
    [fetchGuidance, pollInterval]
  );

  const stopGuidance = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
    setGuidance(null);
    setTarget(null);
    setError(null);
  }, []);

  const markFound = useCallback(() => {
    if (target) {
      onArrival?.(target);
    }
    stopGuidance();
  }, [target, onArrival, stopGuidance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    guidance,
    target,
    isActive,
    error,
    startGuidance,
    stopGuidance,
    markFound,
  };
}

export default useGuidance;
