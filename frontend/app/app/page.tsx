"use client";

import { useCallback, useEffect } from "react";
import { AppProvider, useAppState } from "../store/appStore";
import { useElevenLabsTTS } from "../hooks";
import { useObjectSearch, useGuidance, useApiStatus } from "../hooks";
import { api, mockApi } from "../lib/api";
import { mockObjects, mockDetections } from "../lib/mockData";
import {
  TopNav,
  CameraStreamPanel,
  MappingControls,
  QueryBar,
  ResultsList,
  GuidancePanel,
  ModeToggle,
} from "../components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { ObjectLocation } from "../lib/mockData";

function AppContent() {
  const {
    state,
    setMode,
    setStatus,
    setMappingState,
    setUseMockData,
    setQuery,
    setResults,
    setIsSearching,
    setActiveTarget,
    setGuidance,
    setDebugOpen,
    setShowBoundingBoxes,
    reset,
    addError,
  } = useAppState();

  // TTS hook (preserved from VoiceInterface)
  const {
    speak,
    isSpeaking,
    isLoading: ttsLoading,
  } = useElevenLabsTTS();

  // API status hook
  const { setMockMode } = useApiStatus({
    autoStart: true,
    onStatusChange: (newStatus) => {
      setStatus(newStatus);
      if (newStatus === "offline") {
        setUseMockData(true);
      }
    },
  });

  // Object search hook
  const { search, isSearching } = useObjectSearch({
    useMock: state.useMockData,
    onSearchStart: () => setIsSearching(true),
    onSearchComplete: (results) => {
      setResults(results);
      setIsSearching(false);
    },
    onError: (error) => {
      addError(error);
      setIsSearching(false);
    },
  });

  // Guidance hook
  const {
    guidance,
    target: guidanceTarget,
    isActive: isGuidanceActive,
    startGuidance,
    stopGuidance,
    markFound,
  } = useGuidance({
    useMock: state.useMockData,
    onUpdate: (newGuidance) => {
      setGuidance(newGuidance);
    },
    onArrival: (target) => {
      speak(`You've arrived! Your ${target.name} should be right here.`);
    },
  });

  // Initialize mock data on mount
  useEffect(() => {
    if (state.useMockData) {
      // Set mock memory count
      setDebugOpen(false);
    }
  }, [state.useMockData, setDebugOpen]);

  // Handle mapping start
  const handleStartMapping = useCallback(async () => {
    setMappingState("active");
    const apiClient = state.useMockData ? mockApi : api;
    const result = await apiClient.mapping.start();
    if (!result.success) {
      setMappingState("error");
      if (result.error) addError(result.error);
    }
  }, [state.useMockData, setMappingState, addError]);

  // Handle mapping stop
  const handleStopMapping = useCallback(async () => {
    setMappingState("saving");
    const apiClient = state.useMockData ? mockApi : api;
    const result = await apiClient.mapping.stop();
    if (result.success) {
      setMappingState("saved");
    } else {
      setMappingState("error");
      if (result.error) addError(result.error);
    }
  }, [state.useMockData, setMappingState, addError]);

  // Handle search
  const handleSearch = useCallback(
    async (query: string) => {
      setQuery(query);
      const results = await search(query);

      // If we found results, speak about the first one
      if (results.length > 0) {
        const first = results[0];
        try {
          // Call Cerebras API for intelligent response
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query,
              objectData: {
                name: first.name,
                lastSeen: first.lastSeen,
                distance: first.distance,
                direction: first.direction,
                confidence: first.confidence,
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            speak(data.response);
          } else {
            speak(`Found your ${first.name}! It's ${first.distance} away, ${first.direction}.`);
          }
        } catch {
          speak(`Found your ${first.name}! It's ${first.distance} away, ${first.direction}.`);
        }
      } else {
        speak("I couldn't find that object. Try asking about something else.");
      }
    },
    [search, speak, setQuery]
  );

  // Handle guide me
  const handleGuideMe = useCallback(
    (result: ObjectLocation) => {
      setActiveTarget(result);
      startGuidance(result);
    },
    [setActiveTarget, startGuidance]
  );

  // Handle cancel guidance
  const handleCancelGuidance = useCallback(() => {
    stopGuidance();
    setActiveTarget(null);
    setGuidance(null);
  }, [stopGuidance, setActiveTarget, setGuidance]);

  // Handle mark found
  const handleMarkFound = useCallback(() => {
    markFound();
    setActiveTarget(null);
    setGuidance(null);
  }, [markFound, setActiveTarget, setGuidance]);

  // Handle speak
  const handleSpeak = useCallback(
    (text: string) => {
      speak(text);
    },
    [speak]
  );

  // Handle camera reconnect
  const handleCameraReconnect = useCallback(() => {
    // Re-check API status
    setStatus("offline");
  }, [setStatus]);

  // Get camera stream URL
  const cameraStreamUrl = state.useMockData
    ? "/api/placeholder-camera"
    : api.camera.streamUrl;

  // Debug data with mock values
  const debugData = {
    detections: mockDetections,
    lastResponseTime: 45,
    errors: state.debug.errors,
    memoryCount: mockObjects.length,
  };

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Background */}
      <div className="background-gradient" />

      {/* Top Navigation */}
      <TopNav
        status={state.status}
        mode={state.mode}
        mappingState={state.mappingState}
        debug={debugData}
        isDebugOpen={state.isDebugOpen}
        useMockData={state.useMockData}
        showBoundingBoxes={state.showBoundingBoxes}
        onModeChange={setMode}
        onDebugOpenChange={setDebugOpen}
        onUseMockDataChange={(checked) => {
          setUseMockData(checked);
          if (checked) setMockMode();
        }}
        onShowBoundingBoxesChange={setShowBoundingBoxes}
        onReset={reset}
      />

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_400px] gap-6 p-6 h-[calc(100vh-73px)]">
          {/* Camera Panel */}
          <CameraStreamPanel
            streamUrl={cameraStreamUrl}
            isConnected={state.status === "connected"}
            showBoundingBoxes={state.showBoundingBoxes}
            onToggleBoundingBoxes={setShowBoundingBoxes}
            onReconnect={handleCameraReconnect}
          />

          {/* Control Panel */}
          <div className="flex flex-col gap-4 overflow-y-auto pr-2">
            {/* Mode toggle for mobile nav visibility */}
            <div className="lg:hidden">
              <ModeToggle mode={state.mode} onModeChange={setMode} />
            </div>

            {/* Mock mode toggle */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-eggshell">Demo Mode</span>
                    <p className="text-xs text-denim">Use mock data for demonstration</p>
                  </div>
                  <Switch
                    checked={state.useMockData}
                    onCheckedChange={(checked) => {
                      setUseMockData(checked);
                      if (checked) setMockMode();
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Mode-specific controls */}
            {state.mode === "mapping" ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Mapping Controls</CardTitle>
                </CardHeader>
                <CardContent>
                  <MappingControls
                    state={state.mappingState}
                    onStart={handleStartMapping}
                    onStop={handleStopMapping}
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Query Bar */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Search Objects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <QueryBar
                      onSearch={handleSearch}
                      isSearching={isSearching}
                    />
                  </CardContent>
                </Card>

                {/* Results */}
                <ResultsList
                  results={state.results}
                  activeTargetId={state.activeTarget?.id}
                  onGuideMe={handleGuideMe}
                  isLoading={isSearching}
                  query={state.query}
                />

                {/* Guidance Panel */}
                {isGuidanceActive && (
                  <GuidancePanel
                    guidance={guidance}
                    target={guidanceTarget}
                    onSpeak={handleSpeak}
                    onMarkFound={handleMarkFound}
                    onCancel={handleCancelGuidance}
                    isSpeaking={isSpeaking || ttsLoading}
                  />
                )}
              </>
            )}

            {/* Demo script hint */}
            {state.useMockData && (
              <Card className="bg-slateblue/10 border-slateblue/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="secondary">Demo</Badge>
                    Run the Script
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="text-sm text-denim space-y-1 list-decimal list-inside">
                    <li className={state.mode === "mapping" ? "text-eggshell" : ""}>
                      Switch to Mapping mode
                    </li>
                    <li className={state.mappingState === "active" ? "text-eggshell" : ""}>
                      Click &quot;Start Mapping&quot;
                    </li>
                    <li>Watch objects appear (simulated)</li>
                    <li className={state.mappingState === "saved" ? "text-eggshell" : ""}>
                      Click &quot;Stop&quot; to save
                    </li>
                    <li className={state.mode === "recall" ? "text-eggshell" : ""}>
                      Switch to Recall mode
                    </li>
                    <li className={state.results.length > 0 ? "text-eggshell" : ""}>
                      Ask &quot;Find my water bottle&quot;
                    </li>
                  </ol>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden p-4">
          <Tabs defaultValue="camera" className="w-full">
            <TabsList className="w-full grid grid-cols-4 mb-4">
              <TabsTrigger value="camera">Camera</TabsTrigger>
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="debug">Debug</TabsTrigger>
            </TabsList>

            <TabsContent value="camera">
              <CameraStreamPanel
                streamUrl={cameraStreamUrl}
                isConnected={state.status === "connected"}
                showBoundingBoxes={state.showBoundingBoxes}
                onToggleBoundingBoxes={setShowBoundingBoxes}
                onReconnect={handleCameraReconnect}
              />
            </TabsContent>

            <TabsContent value="controls" className="space-y-4">
              <ModeToggle mode={state.mode} onModeChange={setMode} className="w-full justify-center" />

              {state.mode === "mapping" ? (
                <Card>
                  <CardContent className="p-4">
                    <MappingControls
                      state={state.mappingState}
                      onStart={handleStartMapping}
                      onStop={handleStopMapping}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <QueryBar
                      onSearch={handleSearch}
                      isSearching={isSearching}
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              <ResultsList
                results={state.results}
                activeTargetId={state.activeTarget?.id}
                onGuideMe={handleGuideMe}
                isLoading={isSearching}
                query={state.query}
              />

              {isGuidanceActive && (
                <GuidancePanel
                  guidance={guidance}
                  target={guidanceTarget}
                  onSpeak={handleSpeak}
                  onMarkFound={handleMarkFound}
                  onCancel={handleCancelGuidance}
                  isSpeaking={isSpeaking || ttsLoading}
                />
              )}
            </TabsContent>

            <TabsContent value="debug">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-denim">Status</span>
                      <Badge variant={state.status === "connected" ? "success" : state.status === "mock" ? "warning" : "destructive"}>
                        {state.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-denim">Mode</span>
                      <Badge variant="secondary">{state.mode}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-denim">Memory</span>
                      <span className="text-sm text-eggshell">{debugData.memoryCount} objects</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-denim">Demo Mode</span>
                      <Switch
                        checked={state.useMockData}
                        onCheckedChange={(checked) => {
                          setUseMockData(checked);
                          if (checked) setMockMode();
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

export default function AppPage() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
