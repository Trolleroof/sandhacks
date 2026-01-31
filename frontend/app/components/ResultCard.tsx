"use client";

import { useRef, useEffect } from "react";
import { MapPin, Clock, Navigation } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { animations } from "../lib/animations";
import type { ObjectLocation } from "../lib/mockData";

interface ResultCardProps {
  result: ObjectLocation;
  onGuideMe: (result: ObjectLocation) => void;
  isActive?: boolean;
  className?: string;
}

export function ResultCard({
  result,
  onGuideMe,
  isActive = false,
  className,
}: ResultCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      animations.resultCardEntrance(cardRef.current);
    }
  }, []);

  const confidencePercent = Math.round(result.confidence * 100);

  return (
    <Card
      ref={cardRef}
      className={cn(
        "overflow-hidden transition-all",
        isActive && "ring-2 ring-denim",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Snapshot or icon */}
          <div className="flex-shrink-0 w-16 h-16 rounded-[14px] bg-slateblue/30 flex items-center justify-center">
            {result.snapshot ? (
              <img
                src={result.snapshot}
                alt={result.name}
                className="w-full h-full object-cover rounded-[14px]"
              />
            ) : (
              <MapPin className="h-8 w-8 text-denim" />
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            {/* Name and confidence */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-eggshell capitalize truncate">
                {result.name}
              </h3>
              <span className="text-sm text-green-400 flex-shrink-0">
                {confidencePercent}%
              </span>
            </div>

            {/* Confidence bar */}
            <Progress value={confidencePercent} className="h-1.5 mt-1 mb-2" />

            {/* Location details */}
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2 text-denim">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">{result.lastSeen}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{result.timestamp.toLocaleString()}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex items-center gap-2 text-eggshell">
                <Navigation className="h-3.5 w-3.5 flex-shrink-0 text-denim" />
                <span>
                  {result.distance} &middot; {result.direction}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Guide me button */}
        <Button
          onClick={() => onGuideMe(result)}
          className="w-full mt-4"
          variant={isActive ? "secondary" : "default"}
        >
          <Navigation className="h-4 w-4 mr-2" />
          {isActive ? "Guiding..." : "Guide me"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default ResultCard;
