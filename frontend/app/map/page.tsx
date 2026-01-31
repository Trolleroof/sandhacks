"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpatialMap, mockSpatialData } from "../components/SpatialMap";

export default function MapPage() {
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const selectedObject = selectedObjectId
        ? mockSpatialData.objects.find(o => o.id === selectedObjectId)
        : null;

    return (
        <div className="min-h-screen bg-ink">
            {/* Background */}
            <div className="background-gradient" />

            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-slateblue/30 bg-space/80 backdrop-blur-sm">
                <div className="container flex items-center justify-between h-14 px-4">
                    <div className="flex items-center gap-4">
                        <Link href="/app">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-lg font-semibold text-eggshell">Spatial Map</h1>
                            <p className="text-xs text-denim">3D visualization of detected objects</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                            {mockSpatialData.objects.length} objects
                        </Badge>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="h-4 w-4" />
                            ) : (
                                <Maximize2 className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className={`relative z-10 ${isFullscreen ? 'p-0' : 'p-4 lg:p-6'}`}>
                <div className={`
          ${isFullscreen
                        ? 'fixed inset-0 z-50'
                        : 'grid gap-4 lg:grid-cols-[1fr_300px]'
                    }
        `}>
                    {/* 3D Map */}
                    <div className={isFullscreen ? 'w-full h-full' : 'h-[500px] lg:h-[calc(100vh-140px)]'}>
                        <SpatialMap
                            data={mockSpatialData}
                            selectedObjectId={selectedObjectId}
                            onObjectSelect={setSelectedObjectId}
                            className="w-full h-full"
                        />
                    </div>

                    {/* Sidebar */}
                    {!isFullscreen && (
                        <div className="space-y-4">
                            {/* Selected object details */}
                            {selectedObject ? (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base flex items-center justify-between">
                                            <span>{selectedObject.name}</span>
                                            <Badge
                                                variant={selectedObject.confidence > 0.9 ? "success" : "secondary"}
                                            >
                                                {Math.round(selectedObject.confidence * 100)}%
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <div className="text-center p-2 bg-space/50 rounded-lg">
                                                <div className="text-denim text-xs">X</div>
                                                <div className="text-eggshell font-mono">
                                                    {selectedObject.position.x.toFixed(1)}m
                                                </div>
                                            </div>
                                            <div className="text-center p-2 bg-space/50 rounded-lg">
                                                <div className="text-denim text-xs">Y</div>
                                                <div className="text-eggshell font-mono">
                                                    {selectedObject.position.y.toFixed(1)}m
                                                </div>
                                            </div>
                                            <div className="text-center p-2 bg-space/50 rounded-lg">
                                                <div className="text-denim text-xs">Z</div>
                                                <div className="text-eggshell font-mono">
                                                    {selectedObject.position.z.toFixed(1)}m
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-denim">
                                            Last seen: {new Date(selectedObject.timestamp).toLocaleString()}
                                        </div>
                                        <Button
                                            className="w-full"
                                            size="sm"
                                            onClick={() => setSelectedObjectId(null)}
                                        >
                                            <RotateCcw className="h-3 w-3 mr-2" />
                                            Deselect
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                    <CardContent className="py-8 text-center text-denim text-sm">
                                        Click an object in the map to see details
                                    </CardContent>
                                </Card>
                            )}

                            {/* Objects list */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Detected Objects</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {mockSpatialData.objects.map((obj) => (
                                            <button
                                                key={obj.id}
                                                onClick={() => setSelectedObjectId(obj.id)}
                                                className={`
                          w-full text-left p-2 rounded-lg transition-colors text-sm
                          ${selectedObjectId === obj.id
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

                            {/* Camera info */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Camera Position</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                        <div className="text-center p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                                            <div className="text-blue-400 text-xs">X</div>
                                            <div className="text-eggshell font-mono">
                                                {mockSpatialData.cameraPosition.x.toFixed(1)}m
                                            </div>
                                        </div>
                                        <div className="text-center p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                                            <div className="text-blue-400 text-xs">Y</div>
                                            <div className="text-eggshell font-mono">
                                                {mockSpatialData.cameraPosition.y.toFixed(1)}m
                                            </div>
                                        </div>
                                        <div className="text-center p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                                            <div className="text-blue-400 text-xs">Z</div>
                                            <div className="text-eggshell font-mono">
                                                {mockSpatialData.cameraPosition.z.toFixed(1)}m
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
