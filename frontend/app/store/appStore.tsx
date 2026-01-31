"use client";

import React, { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";
import type { ObjectLocation, GuidanceData, DebugData, Detection } from "../lib/mockData";

// State types
export type AppMode = "mapping" | "recall";
export type ConnectionStatus = "connected" | "mock" | "offline";
export type MappingState = "idle" | "active" | "saving" | "saved" | "error";

export interface AppState {
  // Core state
  mode: AppMode;
  status: ConnectionStatus;
  mappingState: MappingState;
  useMockData: boolean;

  // Search state
  query: string;
  results: ObjectLocation[];
  isSearching: boolean;

  // Navigation state
  activeTarget: ObjectLocation | null;
  guidance: GuidanceData | null;

  // Debug state
  debug: DebugData;

  // UI state
  isDebugOpen: boolean;
  showBoundingBoxes: boolean;
}

// Action types
type AppAction =
  | { type: "SET_MODE"; payload: AppMode }
  | { type: "SET_STATUS"; payload: ConnectionStatus }
  | { type: "SET_MAPPING_STATE"; payload: MappingState }
  | { type: "SET_USE_MOCK_DATA"; payload: boolean }
  | { type: "SET_QUERY"; payload: string }
  | { type: "SET_RESULTS"; payload: ObjectLocation[] }
  | { type: "SET_IS_SEARCHING"; payload: boolean }
  | { type: "SET_ACTIVE_TARGET"; payload: ObjectLocation | null }
  | { type: "SET_GUIDANCE"; payload: GuidanceData | null }
  | { type: "ADD_DETECTION"; payload: Detection }
  | { type: "SET_DEBUG"; payload: Partial<DebugData> }
  | { type: "ADD_ERROR"; payload: string }
  | { type: "CLEAR_ERRORS" }
  | { type: "SET_DEBUG_OPEN"; payload: boolean }
  | { type: "SET_SHOW_BOUNDING_BOXES"; payload: boolean }
  | { type: "CLEAR_SEARCH" }
  | { type: "CLEAR_GUIDANCE" }
  | { type: "RESET" };

// Initial state
const initialState: AppState = {
  mode: "recall",
  status: "mock",
  mappingState: "idle",
  useMockData: true,

  query: "",
  results: [],
  isSearching: false,

  activeTarget: null,
  guidance: null,

  debug: {
    detections: [],
    lastResponseTime: 0,
    errors: [],
    memoryCount: 0,
  },

  isDebugOpen: false,
  showBoundingBoxes: false,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.payload };

    case "SET_STATUS":
      return { ...state, status: action.payload };

    case "SET_MAPPING_STATE":
      return { ...state, mappingState: action.payload };

    case "SET_USE_MOCK_DATA":
      return {
        ...state,
        useMockData: action.payload,
        status: action.payload ? "mock" : state.status,
      };

    case "SET_QUERY":
      return { ...state, query: action.payload };

    case "SET_RESULTS":
      return { ...state, results: action.payload };

    case "SET_IS_SEARCHING":
      return { ...state, isSearching: action.payload };

    case "SET_ACTIVE_TARGET":
      return { ...state, activeTarget: action.payload };

    case "SET_GUIDANCE":
      return { ...state, guidance: action.payload };

    case "ADD_DETECTION":
      return {
        ...state,
        debug: {
          ...state.debug,
          detections: [action.payload, ...state.debug.detections].slice(0, 50),
        },
      };

    case "SET_DEBUG":
      return {
        ...state,
        debug: { ...state.debug, ...action.payload },
      };

    case "ADD_ERROR":
      return {
        ...state,
        debug: {
          ...state.debug,
          errors: [action.payload, ...state.debug.errors].slice(0, 20),
        },
      };

    case "CLEAR_ERRORS":
      return {
        ...state,
        debug: { ...state.debug, errors: [] },
      };

    case "SET_DEBUG_OPEN":
      return { ...state, isDebugOpen: action.payload };

    case "SET_SHOW_BOUNDING_BOXES":
      return { ...state, showBoundingBoxes: action.payload };

    case "CLEAR_SEARCH":
      return {
        ...state,
        query: "",
        results: [],
        isSearching: false,
      };

    case "CLEAR_GUIDANCE":
      return {
        ...state,
        activeTarget: null,
        guidance: null,
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// Context types
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Convenience actions
  setMode: (mode: AppMode) => void;
  setStatus: (status: ConnectionStatus) => void;
  setMappingState: (state: MappingState) => void;
  setUseMockData: (useMock: boolean) => void;
  setQuery: (query: string) => void;
  setResults: (results: ObjectLocation[]) => void;
  setIsSearching: (isSearching: boolean) => void;
  setActiveTarget: (target: ObjectLocation | null) => void;
  setGuidance: (guidance: GuidanceData | null) => void;
  addDetection: (detection: Detection) => void;
  addError: (error: string) => void;
  clearErrors: () => void;
  setDebugOpen: (open: boolean) => void;
  setShowBoundingBoxes: (show: boolean) => void;
  clearSearch: () => void;
  clearGuidance: () => void;
  reset: () => void;
}

// Create context
const AppContext = createContext<AppContextType | null>(null);

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Convenience action creators
  const setMode = useCallback((mode: AppMode) => {
    dispatch({ type: "SET_MODE", payload: mode });
  }, []);

  const setStatus = useCallback((status: ConnectionStatus) => {
    dispatch({ type: "SET_STATUS", payload: status });
  }, []);

  const setMappingState = useCallback((mappingState: MappingState) => {
    dispatch({ type: "SET_MAPPING_STATE", payload: mappingState });
  }, []);

  const setUseMockData = useCallback((useMock: boolean) => {
    dispatch({ type: "SET_USE_MOCK_DATA", payload: useMock });
  }, []);

  const setQuery = useCallback((query: string) => {
    dispatch({ type: "SET_QUERY", payload: query });
  }, []);

  const setResults = useCallback((results: ObjectLocation[]) => {
    dispatch({ type: "SET_RESULTS", payload: results });
  }, []);

  const setIsSearching = useCallback((isSearching: boolean) => {
    dispatch({ type: "SET_IS_SEARCHING", payload: isSearching });
  }, []);

  const setActiveTarget = useCallback((target: ObjectLocation | null) => {
    dispatch({ type: "SET_ACTIVE_TARGET", payload: target });
  }, []);

  const setGuidance = useCallback((guidance: GuidanceData | null) => {
    dispatch({ type: "SET_GUIDANCE", payload: guidance });
  }, []);

  const addDetection = useCallback((detection: Detection) => {
    dispatch({ type: "ADD_DETECTION", payload: detection });
  }, []);

  const addError = useCallback((error: string) => {
    dispatch({ type: "ADD_ERROR", payload: error });
  }, []);

  const clearErrors = useCallback(() => {
    dispatch({ type: "CLEAR_ERRORS" });
  }, []);

  const setDebugOpen = useCallback((open: boolean) => {
    dispatch({ type: "SET_DEBUG_OPEN", payload: open });
  }, []);

  const setShowBoundingBoxes = useCallback((show: boolean) => {
    dispatch({ type: "SET_SHOW_BOUNDING_BOXES", payload: show });
  }, []);

  const clearSearch = useCallback(() => {
    dispatch({ type: "CLEAR_SEARCH" });
  }, []);

  const clearGuidance = useCallback(() => {
    dispatch({ type: "CLEAR_GUIDANCE" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const value: AppContextType = {
    state,
    dispatch,
    setMode,
    setStatus,
    setMappingState,
    setUseMockData,
    setQuery,
    setResults,
    setIsSearching,
    setActiveTarget,
    setGuidance,
    addDetection,
    addError,
    clearErrors,
    setDebugOpen,
    setShowBoundingBoxes,
    clearSearch,
    clearGuidance,
    reset,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook to use app state
export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppProvider");
  }
  return context;
}

export default AppProvider;
