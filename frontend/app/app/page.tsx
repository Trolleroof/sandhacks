"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppProvider, useAppState } from "../store/appStore";
import { useElevenLabsTTS, useRosbridgeSpatial } from "../hooks";
import { useObjectSearch, useGuidance, useApiStatus } from "../hooks";
import { api, mockApi } from "../lib/api";
import { mockObjects, mockDetections, findNearbyObjects3D } from "../lib/mockData";
import {
  TopNav,
  MappingControls,
  QueryBar,
  ResultsList,
  GuidancePanel,
  ModeToggle,
  SpatialMap,
} from "../components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Navigation } from "lucide-react";
import type { ObjectLocation } from "../lib/mockData";
import { mockSpatialData, type Position3D, type SpatialObject } from "../components/SpatialMap";

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

  const toObjectLocation = useCallback(
    (obj: SpatialObject): ObjectLocation => {
      const cameraPos = spatialData.cameraPosition;
      const dx = obj.position.x - cameraPos.x;
      const dz = obj.position.z - cameraPos.z;
      const distanceMeters = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz) * (180 / Math.PI);
      const absAngle = Math.abs(angle);
      const direction =
        absAngle <= 45
          ? "in front of you"
          : absAngle >= 135
            ? "behind you"
            : angle > 0
              ? "to your right"
              : "to your left";

      return {
        id: obj.id,
        name: obj.name,
        lastSeen: new Date(obj.timestamp).toLocaleString(),
        timestamp: new Date(obj.timestamp),
        distance: `${distanceMeters.toFixed(1)} meters`,
        distanceMeters,
        direction,
        bearing: angle,
        confidence: obj.confidence,
      };
    },
    [spatialData.cameraPosition]
  );

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
          const data = await response.json();
          console.log("[AppPage] Cerebras response:", data);
          speak(data.response);
        } else {
          const errorText = await response.text();
          console.error("[AppPage] API error:", errorText);
          speak(`Found your ${result.name}! It's ${result.distance} away, ${result.direction}.`);
        }
      } catch (error) {
        console.error("[AppPage] Fetch error:", error);
        speak(`Found your ${result.name}! It's ${result.distance} away, ${result.direction}.`);
      }
    },
    [setActiveTarget, startGuidance, speak, state.query, spatialData.objects]
  );

  // State for selected object in map (only used in recall mode)
  const [selectedMapObjectId, setSelectedMapObjectId] = useState<string | null>(null);
  const [guidingToObjectId, setGuidingToObjectId] = useState<string | null>(null);
  const [guidanceQuery, setGuidanceQuery] = useState<string | null>(null);
  const selectedMapObject = selectedMapObjectId
    ? spatialData.objects.find((o) => o.id === selectedMapObjectId)
    : null;

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
            guidanceQuery={guidanceQuery}
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

                {/* Selected Object Details (from map click) */}
                {selectedMapObject && (
                  <Card className="border-slateblue/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{selectedMapObject.name}</span>
                        <Badge
                          variant={selectedMapObject.confidence > 0.9 ? "success" : "secondary"}
                        >
                          {Math.round(selectedMapObject.confidence * 100)}%
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center p-2 bg-space/50 rounded-lg">
                          <div className="text-denim text-xs">X</div>
                          <div className="text-eggshell font-mono">
                            {selectedMapObject.position.x.toFixed(1)}m
                          </div>
                        </div>
                        <div className="text-center p-2 bg-space/50 rounded-lg">
                          <div className="text-denim text-xs">Y</div>
                          <div className="text-eggshell font-mono">
                            {selectedMapObject.position.y.toFixed(1)}m
                          </div>
                        </div>
                        <div className="text-center p-2 bg-space/50 rounded-lg">
                          <div className="text-denim text-xs">Z</div>
                          <div className="text-eggshell font-mono">
                            {selectedMapObject.position.z.toFixed(1)}m
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-denim">
                        Last seen: {new Date(selectedMapObject.timestamp).toLocaleString()}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedMapObjectId(null);
                            setGuidingToObjectId(null);
                            setGuidanceQuery(null);
                          }}
                        >
                          <RotateCcw className="h-3 w-3 mr-2" />
                          Deselect
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          variant={guidingToObjectId === selectedMapObjectId ? "default" : "secondary"}
                          onClick={() => {
                            if (!selectedMapObject) return;
                            setGuidingToObjectId(selectedMapObjectId);

                            // Set the query so the LLM gets the proper context
                            const searchQuery = `find my ${selectedMapObject.name}`;
                            setQuery(searchQuery);

                            // Trigger visual guidance path using the specific object ID
                            setGuidanceQuery(selectedMapObject.id);
                            setTimeout(() => setGuidanceQuery(null), 100);

                            // Trigger LLM guidance (same as search results)
                            handleGuideMe(toObjectLocation(selectedMapObject));
                          }}
                        >
                          <Navigation className="h-3 w-3 mr-2" />
                          {guidingToObjectId === selectedMapObjectId ? "Guiding" : "Guide Me"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Detected Objects List */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Detected Objects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {spatialData.objects.map((obj) => (
                        <button
                          key={obj.id}
                          onClick={() => setSelectedMapObjectId(obj.id)}
                          className={`
                            w-full text-left p-2 rounded-lg transition-colors text-sm
                            ${selectedMapObjectId === obj.id
                              ? 'bg-slateblue/30 border border-slateblue'
                              : 'bg-space/30 hover:bg-space/50 border border-transparent'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-eggshell">{obj.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(obj.confidence * 100)}%
                            </Badge>
                          </div>
                          <div className="text-xs text-denim mt-1">
                            ({obj.position.x.toFixed(1)}, {obj.position.y.toFixed(1)}, {obj.position.z.toFixed(1)})
                          </div>
                        </button>
                      ))}
                    </div>
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
            <TabsList className="w-full grid grid-cols-4 mb-4">
              <TabsTrigger value="map">Map</TabsTrigger>
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="debug">Debug</TabsTrigger>
            </TabsList>

            <TabsContent value="map">
              <SpatialMap
                data={spatialData}
                selectedObjectId={state.mode === "recall" ? selectedMapObjectId : null}
                onObjectSelect={state.mode === "recall" ? setSelectedMapObjectId : undefined}
                guidanceQuery={guidanceQuery}
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
