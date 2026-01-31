"use client";

import Link from "next/link";
import { Brain, Settings, HelpCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { StatusPill } from "./StatusPill";
import { ModeToggle } from "./ModeToggle";
import { DebugDrawer } from "./DebugDrawer";
import type { ConnectionStatus, AppMode, MappingState } from "../store/appStore";
import type { DebugData } from "../lib/mockData";

interface TopNavProps {
  status: ConnectionStatus;
  mode: AppMode;
  mappingState: MappingState;
  debug: DebugData;
  isDebugOpen: boolean;
  onModeChange: (mode: AppMode) => void;
  onDebugOpenChange: (open: boolean) => void;
  onReset: () => void;
  className?: string;
}

export function TopNav({
  status,
  mode,
  mappingState,
  debug,
  isDebugOpen,
  onModeChange,
  onDebugOpenChange,
  onReset,
  className,
}: TopNavProps) {
  return (
    <TooltipProvider>
      <nav
        className={cn(
          "flex items-center justify-between px-4 py-3 bg-space/50 backdrop-blur-sm border-b border-slateblue/30",
          className
        )}
      >
        {/* Left: Logo + Status */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-slateblue to-denim flex items-center justify-center">
              <Brain className="h-6 w-6 text-eggshell" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-eggshell leading-tight">
                Reality Memory
              </h1>
              <p className="text-xs text-denim">Spatial object finder</p>
            </div>
          </Link>

          <StatusPill status={status} />
        </div>

        {/* Center: Mode Toggle */}
        <ModeToggle
          mode={mode}
          onModeChange={onModeChange}
          className="hidden sm:flex"
        />

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden sm:flex">
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          {/* Help */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Help</TooltipContent>
          </Tooltip>

          {/* Reset */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset</TooltipContent>
          </Tooltip>

          {/* Debug */}
          <DebugDrawer
            isOpen={isDebugOpen}
            onOpenChange={onDebugOpenChange}
            debug={debug}
            status={status}
            mode={mode}
            mappingState={mappingState}
          />
        </div>
      </nav>
    </TooltipProvider>
  );
}

export default TopNav;
