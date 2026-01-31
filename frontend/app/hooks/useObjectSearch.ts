"use client";

import { useState, useCallback } from "react";
import { api, mockApi } from "../lib/api";
import type { ObjectLocation } from "../lib/mockData";

interface UseObjectSearchOptions {
  /** Whether to use mock data (default: false) */
  useMock?: boolean;
  /** Callback when search starts */
  onSearchStart?: () => void;
  /** Callback when search completes */
  onSearchComplete?: (results: ObjectLocation[]) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export function useObjectSearch(options: UseObjectSearchOptions = {}) {
  const { useMock = false, onSearchStart, onSearchComplete, onError } = options;

  const [results, setResults] = useState<ObjectLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return [];
      }

      setIsSearching(true);
      setError(null);
      setLastQuery(query);
      onSearchStart?.();

      const apiClient = useMock ? mockApi : api;

      try {
        const result = await apiClient.objects.search(query);

        if (result.error) {
          setError(result.error);
          onError?.(result.error);
          setResults([]);
          return [];
        }

        setResults(result.results);
        onSearchComplete?.(result.results);
        return result.results;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Search failed";
        setError(errorMessage);
        onError?.(errorMessage);
        setResults([]);
        return [];
      } finally {
        setIsSearching(false);
      }
    },
    [useMock, onSearchStart, onSearchComplete, onError]
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setLastQuery("");
  }, []);

  return {
    results,
    isSearching,
    error,
    lastQuery,
    search,
    clearResults,
  };
}

export default useObjectSearch;
