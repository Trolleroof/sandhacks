"use client";

import { useRef, useEffect } from "react";
import { Map, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { animations } from "../lib/animations";
import type { AppMode } from "../store/appStore";

interface ModeToggleProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  className?: string;
}

export function ModeToggle({ mode, onModeChange, className }: ModeToggleProps) {
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (indicatorRef.current) {
      animations.modeToggle(indicatorRef.current, mode === "mapping" ? "left" : "right");
    }
  }, [mode]);

  return (
    <div
      className={cn(
        "relative flex items-center gap-1 rounded-[14px] bg-space p-1 border border-slateblue/30",
        className
      )}
    >
      {/* Animated indicator */}
      <div
        ref={indicatorRef}
        className="absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-[10px] bg-slateblue transition-transform"
        style={{ transform: mode === "mapping" ? "translateX(0)" : "translateX(100%)" }}
      />

      {/* Mapping button */}
      <button
        onClick={() => onModeChange("mapping")}
        className={cn(
          "relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-[10px] transition-colors",
          mode === "mapping" ? "text-eggshell" : "text-denim hover:text-eggshell"
        )}
      >
        <Map className="h-4 w-4" />
        Mapping
      </button>

      {/* Recall button */}
      <button
        onClick={() => onModeChange("recall")}
        className={cn(
          "relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-[10px] transition-colors",
          mode === "recall" ? "text-eggshell" : "text-denim hover:text-eggshell"
        )}
      >
        <Search className="h-4 w-4" />
        Recall
      </button>
    </div>
  );
}

export default ModeToggle;
