"use client";

import { useState } from "react";
import Link from "next/link";
import { Brain, Settings, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ModeToggle } from "./ModeToggle";
import { DebugDrawer } from "./DebugDrawer";
import { SettingsDialog } from "./SettingsDialog";
import type { ConnectionStatus, AppMode, MappingState } from "../store/appStore";
import type { DebugData } from "../lib/mockData";

interface TopNavProps {
  status: ConnectionStatus;
  mode: AppMode;
  mappingState: MappingState;
  debug: DebugData;
  isDebugOpen: boolean;
  useMockData: boolean;
  showBoundingBoxes: boolean;
  onModeChange: (mode: AppMode) => void;
  onDebugOpenChange: (open: boolean) => void;
  onUseMockDataChange: (value: boolean) => void;
  onShowBoundingBoxesChange: (value: boolean) => void;
  onReset: () => void;
  className?: string;
}

export function TopNav({
  status,
  mode,
  mappingState,
  debug,
  isDebugOpen,
  useMockData,
  showBoundingBoxes,
  onModeChange,
  onDebugOpenChange,
  onUseMockDataChange,
  onShowBoundingBoxesChange,
  onReset,
  className,
}: TopNavProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
            <img
              src="/images/logo.png"
              alt="Recall logo"
              className="w-30 h-30 object-contain -my-6"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-eggshell leading-tight">
                Recall
              </h1>
            </div>
          </Link>

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
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:flex"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
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

      {/* Dialogs */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        useMockData={useMockData}
        onUseMockDataChange={onUseMockDataChange}
        showBoundingBoxes={showBoundingBoxes}
        onShowBoundingBoxesChange={onShowBoundingBoxesChange}
        onReset={onReset}
      />
    </TooltipProvider>
  );
}

export default TopNav;
