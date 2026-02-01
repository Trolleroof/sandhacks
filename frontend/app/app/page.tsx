"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppProvider, useAppState } from "../store/appStore";
import { useElevenLabsTTS, useRosbridgeSpatial } from "../hooks";
import { useObjectSearch, useGuidance, useApiStatus } from "../hooks";
import { api, mockApi } from "../lib/api";
import { canCallChat, recordChatError, recordChatSuccess, isPaymentErrorBlocked } from "../lib/chatGuard";
import { mockObjects, mockDetections, findNearbyObjects3D } from "../lib/mockData";
import {
  TopNav,
  MappingControls,
  ConversationalAgent,
  GuidancePanel,
  ModeToggle,
  SpatialMap,
} from "../components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { ObjectLocation } from "../lib/mockData";
import { mockSpatialData, type Position3D } from "../components/SpatialMap";

function rosToThree(point: Position3D): Position3D {
  return { x: point.x, y: point.z, z: -point.y };
}

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

  const [externalAgentMessages, setExternalAgentMessages] = useState<Array<{ id: string; content: string }>>([]);

  // TTS hook (preserved from VoiceInterface)
  const {
    speak,
    isSpeaking,
    isLoading: ttsLoading,
  } = useElevenLabsTTS();

  const addExternalAgentMessage = useCallback((content: string) => {
    setExternalAgentMessages((prev) => [
      ...prev,
      { id: `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`, content },
    ]);
  }, []);

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
    startGuidance,
    stopGuidance,
    markFound,
  } = useGuidance({
    useMock: state.useMockData,
    onUpdate: (newGuidance) => {
      setGuidance(newGuidance);
    },
    onArrival: (target) => {
      addExternalAgentMessage(`You've arrived! Your ${target.name} should be right here.`);
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
      console.log("[AppPage] Starting search for:", query);
      setQuery(query);
      const results = await search(query);
      console.log("[AppPage] Search results:", results);
    },
    [search, setQuery]
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
  const rosbridge = useRosbridgeSpatial({
    url: process.env.NEXT_PUBLIC_ROSBRIDGE_URL ?? "ws://localhost:9090",
    enabled: true,
  });

  const spatialData = useMemo(() => {
    const cameraPosition = rosbridge.pose
      ? rosToThree(rosbridge.pose.position)
      : mockSpatialData.cameraPosition;

    const mapPoints = rosbridge.pointCloud.length
      ? rosbridge.pointCloud.map(rosToThree)
      : mockSpatialData.mapPoints;

    const path = rosbridge.path.length
      ? rosbridge.path.map(rosToThree)
      : undefined;

    // Use real detected objects from ROSbridge if available
    const objects = rosbridge.objects.length > 0
      ? rosbridge.objects.map((obj) => ({
        ...obj,
        position: rosToThree(obj.position),
      }))
      : mockSpatialData.objects;

    return {
      ...mockSpatialData,
      cameraPosition,
      mapPoints,
      path,
      objects,
    };
  }, [rosbridge.pose, rosbridge.pointCloud, rosbridge.path, rosbridge.objects]);

  // Handle guide me
  const handleGuideMe = useCallback(
    async (result: ObjectLocation) => {
      setActiveTarget(result);
      startGuidance(result);

      const queryForLlm = state.query.trim().length > 0
        ? state.query
        : `find ${result.name}`;

      // Find the corresponding SpatialObject and calculate nearby objects
      const targetSpatialObject = spatialData.objects.find((obj) => obj.id === result.id);
      const nearbyObjects = targetSpatialObject
        ? findNearbyObjects3D(targetSpatialObject, spatialData.objects, 1.5)
        : [];

      try {
        // Avoid spamming Cerebras on errors: cooldown after failures, stop on payment error
        if (!canCallChat()) {
          if (isPaymentErrorBlocked()) {
            addExternalAgentMessage(
              "The assistant is temporarily unavailable due to a billing issue. Please check your account."
            );
          } else {
            addExternalAgentMessage(
              `Found your ${result.name}! It's ${result.distance} away, ${result.direction}.`
            );
          }
          return;
        }

        // Call Cerebras API for intelligent response
        console.log("[AppPage] Calling /api/chat with:", {
          query: queryForLlm,
          objectData: {
            name: result.name,
            lastSeen: result.lastSeen,
            distance: result.distance,
            direction: result.direction,
            confidence: result.confidence,
            nearbyObjects,
          },
        });
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: queryForLlm,
            objectData: {
              name: result.name,
              lastSeen: result.lastSeen,
              distance: result.distance,
              direction: result.direction,
              confidence: result.confidence,
              nearbyObjects,
            },
          }),
        });

        console.log("[AppPage] API response status:", response.status, response.ok);

        if (response.ok) {
          recordChatSuccess();
          const data = await response.json();
          console.log("[AppPage] Cerebras response:", data);
          addExternalAgentMessage(data.response);
        } else {
          const errorBody = await response.json().catch(() => ({}));
          recordChatError(response.status, errorBody as { code?: string });
          const errorText = JSON.stringify(errorBody);
          console.error("[AppPage] API error:", errorText);
          addExternalAgentMessage(
            `Found your ${result.name}! It's ${result.distance} away, ${result.direction}.`
          );
        }
      } catch (error) {
        recordChatError(500);
        console.error("[AppPage] Fetch error:", error);
        addExternalAgentMessage(
          `Found your ${result.name}! It's ${result.distance} away, ${result.direction}.`
        );
      }
    },
    [setActiveTarget, startGuidance, addExternalAgentMessage, state.query, spatialData.objects]
  );

  // State for selected object in map (only used in recall mode)
  const [selectedMapObjectId, setSelectedMapObjectId] = useState<string | null>(null);

  // Debug data with mock values
  const debugData = {
    detections: mockDetections,
    lastResponseTime: 45,
    errors: state.debug.errors,
    memoryCount: mockObjects.length,
  };

  return (
    <div className="min-h-screen bg-ink flex flex-col font-serif">
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
          {/* Spatial Map */}
          <SpatialMap
            data={spatialData}
            selectedObjectId={state.mode === "recall" ? selectedMapObjectId : null}
            onObjectSelect={state.mode === "recall" ? setSelectedMapObjectId : undefined}
            guidanceQuery={guidanceTarget?.id || null}
            guidanceVoiceEnabled={false}
            className="w-full h-full"
          />

          {/* Control Panel */}
          <div className="flex flex-col gap-4 overflow-y-auto pr-2">
            {/* Mode toggle for mobile nav visibility */}
            <div className="lg:hidden">
              <ModeToggle mode={state.mode} onModeChange={setMode} />
            </div>

            {/* Mock mode toggle - commented out
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
            */}

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
                {/* Conversational Agent */}
                <div className="h-[calc(100vh-200px)]">
                  <ConversationalAgent
                    onSearch={handleSearch}
                    searchResults={state.results}
                    isSearching={isSearching}
                    guidance={guidance}
                    target={guidanceTarget}
                    onSpeak={handleSpeak}
                    onMarkFound={handleMarkFound}
                    onCancel={handleCancelGuidance}
                    isSpeaking={isSpeaking || ttsLoading}
                    onGuideMe={handleGuideMe}
                    externalAgentMessages={externalAgentMessages}
                    onExternalMessagesHandled={(ids) => {
                      setExternalAgentMessages((prev) => prev.filter((message) => !ids.includes(message.id)));
                    }}
                  />
                </div>

              </>
            )}

            {/* Demo script hint */}
            {/*
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
            */}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden p-4">
          <Tabs defaultValue="map" className="w-full">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="map">Map</TabsTrigger>
              <TabsTrigger value="controls">Agent</TabsTrigger>
              <TabsTrigger value="debug">Debug</TabsTrigger>
            </TabsList>

            <TabsContent value="map">
              <SpatialMap
                data={spatialData}
                selectedObjectId={state.mode === "recall" ? selectedMapObjectId : null}
                onObjectSelect={state.mode === "recall" ? setSelectedMapObjectId : undefined}
                guidanceQuery={guidanceTarget?.id || null}
                guidanceVoiceEnabled={false}
                className="w-full h-[380px]"
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
                <div className="h-[500px]">
                  <ConversationalAgent
                    onSearch={handleSearch}
                    searchResults={state.results}
                    isSearching={isSearching}
                    guidance={guidance}
                    target={guidanceTarget}
                    onSpeak={handleSpeak}
                    onMarkFound={handleMarkFound}
                    onCancel={handleCancelGuidance}
                    isSpeaking={isSpeaking || ttsLoading}
                    onGuideMe={handleGuideMe}
                    externalAgentMessages={externalAgentMessages}
                    onExternalMessagesHandled={(ids) => {
                      setExternalAgentMessages((prev) => prev.filter((message) => !ids.includes(message.id)));
                    }}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              <div className="text-sm text-denim text-center py-8">
                Use the Controls tab to interact with the conversational agent
              </div>
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
                      <span className="text-sm text-denim">ROS Spatial</span>
                      <Badge variant={rosbridge.status === "connected" ? "success" : rosbridge.status === "error" ? "destructive" : "secondary"}>
                        {rosbridge.status}
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

      {/* Guidance Panel Modal - appears when guidance is active */}
      {guidance && guidanceTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
          <div className="w-full max-w-md p-4 pb-6 pointer-events-auto">
            <GuidancePanel
              guidance={guidance}
              target={guidanceTarget}
              onMarkFound={handleMarkFound}
              onCancel={handleCancelGuidance}
            />
          </div>
        </div>
      )}
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
