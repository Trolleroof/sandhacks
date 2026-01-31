"use client";

import { useState, useCallback } from "react";
import { VideoOff, RefreshCw, Eye, EyeOff, Crosshair } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CameraStreamPanelProps {
  streamUrl: string;
  isConnected: boolean;
  showBoundingBoxes: boolean;
  onToggleBoundingBoxes: (show: boolean) => void;
  onReconnect: () => void;
  className?: string;
}

export function CameraStreamPanel({
  streamUrl,
  isConnected,
  showBoundingBoxes,
  onToggleBoundingBoxes,
  onReconnect,
  className,
}: CameraStreamPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleReconnect = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    onReconnect();
  }, [onReconnect]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-0 relative aspect-video bg-ink">
        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="w-full h-full absolute inset-0" />
            <div className="z-10 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-denim mx-auto mb-2" />
              <p className="text-sm text-denim">Connecting to camera...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space">
            <VideoOff className="h-12 w-12 text-denim/50 mb-4" />
            <p className="text-eggshell mb-2">Camera not available</p>
            <p className="text-sm text-denim mb-4">
              {isConnected
                ? "Failed to load camera stream"
                : "Backend is offline. Using mock mode."}
            </p>
            <Button onClick={handleReconnect} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconnect
            </Button>
          </div>
        )}

        {/* Camera stream */}
        {!hasError && (
          <img
            src={streamUrl}
            alt="Camera stream"
            className={cn(
              "w-full h-full object-cover",
              isLoading && "opacity-0"
            )}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}

        {/* Crosshair overlay */}
        {showCrosshair && !hasError && !isLoading && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <Crosshair className="h-16 w-16 text-eggshell/50" />
          </div>
        )}

        {/* Bounding boxes placeholder */}
        {showBoundingBoxes && !hasError && !isLoading && (
          <div className="absolute inset-0 pointer-events-none">
            {/* This would be dynamically rendered based on detection data */}
          </div>
        )}

        {/* Controls overlay */}
        {!hasError && !isLoading && (
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            {/* Left controls */}
            <div className="flex items-center gap-3 bg-ink/80 backdrop-blur-sm rounded-[14px] px-3 py-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={showBoundingBoxes}
                  onCheckedChange={onToggleBoundingBoxes}
                  id="bounding-boxes"
                />
                <label
                  htmlFor="bounding-boxes"
                  className="text-xs text-eggshell cursor-pointer flex items-center gap-1"
                >
                  {showBoundingBoxes ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  Boxes
                </label>
              </div>

              <div className="w-px h-4 bg-slateblue/40" />

              <div className="flex items-center gap-2">
                <Switch
                  checked={showCrosshair}
                  onCheckedChange={setShowCrosshair}
                  id="crosshair"
                />
                <label
                  htmlFor="crosshair"
                  className="text-xs text-eggshell cursor-pointer flex items-center gap-1"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  Center
                </label>
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2 bg-ink/80 backdrop-blur-sm rounded-[14px] px-3 py-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isConnected
                    ? "bg-green-400 animate-pulse"
                    : "bg-amber-400"
                )}
              />
              <span className="text-xs text-eggshell">
                {isConnected ? "Live" : "Mock"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CameraStreamPanel;
