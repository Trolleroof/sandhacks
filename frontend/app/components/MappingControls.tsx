"use client";

import { useCallback, useRef, useEffect } from "react";
import { Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { animations } from "../lib/animations";
import type { MappingState } from "../store/appStore";

interface MappingControlsProps {
  state: MappingState;
  onStart: () => void;
  onStop: () => void;
  className?: string;
}

const stateConfig: Record<
  MappingState,
  { label: string; color: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
> = {
  idle: { label: "Ready to map", color: "text-denim", variant: "secondary" },
  active: { label: "Mapping...", color: "text-green-400", variant: "success" },
  saving: { label: "Saving...", color: "text-amber-400", variant: "warning" },
  saved: { label: "Map saved", color: "text-green-400", variant: "success" },
  error: { label: "Error", color: "text-red-400", variant: "destructive" },
};

export function MappingControls({
  state,
  onStart,
  onStop,
  className,
}: MappingControlsProps) {
  const pulseRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<ReturnType<typeof animations.mappingPulse>>();

  useEffect(() => {
    if (state === "active" && pulseRef.current) {
      animationRef.current = animations.mappingPulse(pulseRef.current);
    } else if (animationRef.current) {
      // Stop animation when not active
      animations.stop(pulseRef.current as Element);
    }
  }, [state]);

  const handleStart = useCallback(() => {
    onStart();
  }, [onStart]);

  const handleStop = useCallback(() => {
    onStop();
  }, [onStop]);

  const config = stateConfig[state];
  const isActive = state === "active";
  const isLoading = state === "saving";
  const canStart = state === "idle" || state === "saved" || state === "error";
  const canStop = state === "active";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-denim">Mapping Status</span>
        <Badge variant={config.variant} className="flex items-center gap-2">
          {isActive && (
            <div
              ref={pulseRef}
              className="h-2 w-2 rounded-full bg-green-400"
            />
          )}
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          <span className={config.color}>{config.label}</span>
        </Badge>
      </div>

      {/* Control buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleStart}
          disabled={!canStart}
          className="flex-1"
          variant={canStart ? "default" : "secondary"}
        >
          <Play className="h-4 w-4 mr-2" />
          Start Mapping
        </Button>

        <Button
          onClick={handleStop}
          disabled={!canStop}
          className="flex-1"
          variant={canStop ? "destructive" : "secondary"}
        >
          <Square className="h-4 w-4 mr-2" />
          Stop
        </Button>
      </div>

      {/* Instructions */}
      <p className="text-xs text-denim">
        {isActive
          ? "Walk around your space. Objects will be detected and remembered."
          : "Start mapping to detect and catalog objects in your environment."}
      </p>
    </div>
  );
}

export default MappingControls;
