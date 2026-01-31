"use client";

import { useRef, useEffect, useCallback } from "react";
import { Volume2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { animations } from "../lib/animations";
import { CompassArrow } from "./CompassArrow";
import type { GuidanceData, ObjectLocation } from "../lib/mockData";

interface GuidancePanelProps {
  guidance: GuidanceData | null;
  target: ObjectLocation | null;
  onSpeak: (text: string) => void;
  onMarkFound: () => void;
  onCancel: () => void;
  isSpeaking?: boolean;
  className?: string;
}

export function GuidancePanel({
  guidance,
  target,
  onSpeak,
  onMarkFound,
  onCancel,
  isSpeaking = false,
  className,
}: GuidancePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const distanceRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (panelRef.current && guidance) {
      animations.fadeIn(panelRef.current);
    }
  }, [guidance]);

  useEffect(() => {
    const distance = guidance?.distance;
    if (distanceRef.current && distance !== undefined) {
      animations.countUp(distanceRef.current, distance);
    }
  }, [guidance?.distance]);

  useEffect(() => {
    if (guidance?.arrived && panelRef.current) {
      animations.successGlow(panelRef.current);
    }
  }, [guidance?.arrived]);

  const handleSpeak = useCallback(() => {
    if (guidance) {
      onSpeak(guidance.instruction);
    }
  }, [guidance, onSpeak]);

  if (!guidance || !target) {
    return null;
  }

  return (
    <Card
      ref={panelRef}
      className={cn(
        "overflow-hidden",
        guidance.arrived && "ring-2 ring-green-500",
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {guidance.arrived ? (
              <>
                <Check className="h-5 w-5 text-green-400" />
                You&apos;re here!
              </>
            ) : (
              <>Guiding to {target.name}</>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Compass and distance */}
        <div className="flex items-center justify-center gap-8">
          {/* Compass arrow */}
          <CompassArrow
            bearing={guidance.bearing}
            size={100}
            showPulse={!guidance.arrived}
          />

          {/* Distance display */}
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-1">
              <span
                ref={distanceRef}
                className="text-4xl font-bold text-eggshell"
              >
                {guidance.distance.toFixed(1)}
              </span>
              <span className="text-lg text-denim">m</span>
            </div>
            <p className="text-sm text-denim">distance</p>
          </div>
        </div>

        {/* Instruction */}
        <div className="bg-space/50 rounded-[14px] p-4 text-center">
          <p className="text-eggshell">
            {guidance.arrived
              ? `You've found your ${target.name}!`
              : guidance.instruction}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSpeak}
            disabled={isSpeaking}
            className="flex-1"
          >
            <Volume2 className="h-4 w-4 mr-2" />
            {isSpeaking ? "Speaking..." : "Speak"}
          </Button>

          {guidance.arrived ? (
            <Button onClick={onMarkFound} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Mark Found
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default GuidancePanel;
