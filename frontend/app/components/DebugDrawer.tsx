"use client";

import { Bug, AlertCircle, Box, Clock, Wifi } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DebugData, Detection } from "../lib/mockData";
import type { ConnectionStatus, AppMode, MappingState } from "../store/appStore";

interface DebugDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  debug: DebugData;
  status: ConnectionStatus;
  mode: AppMode;
  mappingState: MappingState;
  className?: string;
}

function DetectionItem({ detection }: { detection: Detection }) {
  const confidencePercent = Math.round(detection.confidence * 100);
  const timeAgo = getTimeAgo(detection.timestamp);

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Box className="h-4 w-4 text-denim" />
        <span className="text-sm text-eggshell capitalize">{detection.label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-16">
          <Progress value={confidencePercent} className="h-1.5" />
        </div>
        <span className="text-xs text-denim w-10 text-right">{confidencePercent}%</span>
        <span className="text-xs text-denim/60">{timeAgo}</span>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function DebugDrawer({
  isOpen,
  onOpenChange,
  debug,
  status,
  mode,
  mappingState,
  className,
}: DebugDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("", className)}
          title="Debug panel"
        >
          <Bug className="h-4 w-4" />
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug Panel
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* System Status */}
          <section>
            <h3 className="text-sm font-medium text-denim mb-3">System Status</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-space/50 rounded-[14px] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wifi className="h-4 w-4 text-denim" />
                  <span className="text-xs text-denim">Connection</span>
                </div>
                <Badge
                  variant={
                    status === "connected"
                      ? "success"
                      : status === "mock"
                        ? "warning"
                        : "destructive"
                  }
                >
                  {status}
                </Badge>
              </div>

              <div className="bg-space/50 rounded-[14px] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-denim">Mode</span>
                </div>
                <Badge variant="secondary">{mode}</Badge>
              </div>

              <div className="bg-space/50 rounded-[14px] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-denim">Mapping</span>
                </div>
                <Badge
                  variant={mappingState === "active" ? "success" : "secondary"}
                >
                  {mappingState}
                </Badge>
              </div>

              <div className="bg-space/50 rounded-[14px] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Box className="h-4 w-4 text-denim" />
                  <span className="text-xs text-denim">Memory</span>
                </div>
                <span className="text-lg font-semibold text-eggshell">
                  {debug.memoryCount}
                </span>
                <span className="text-xs text-denim ml-1">objects</span>
              </div>
            </div>
          </section>

          <Separator />

          {/* Response Time */}
          <section>
            <h3 className="text-sm font-medium text-denim mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last Response Time
            </h3>
            <div className="bg-space/50 rounded-[14px] p-3">
              <span className="text-2xl font-semibold text-eggshell">
                {debug.lastResponseTime}
              </span>
              <span className="text-sm text-denim ml-1">ms</span>
            </div>
          </section>

          <Separator />

          {/* Recent Detections */}
          <section>
            <h3 className="text-sm font-medium text-denim mb-3">
              Recent Detections ({debug.detections.length})
            </h3>
            <div className="bg-space/50 rounded-[14px] p-3 max-h-48 overflow-y-auto">
              {debug.detections.length === 0 ? (
                <p className="text-sm text-denim text-center py-4">
                  No detections yet
                </p>
              ) : (
                <div className="divide-y divide-slateblue/30">
                  {debug.detections.map((detection) => (
                    <DetectionItem key={detection.id} detection={detection} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* Errors */}
          <section>
            <h3 className="text-sm font-medium text-denim mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Errors ({debug.errors.length})
            </h3>
            <div className="bg-space/50 rounded-[14px] p-3 max-h-32 overflow-y-auto">
              {debug.errors.length === 0 ? (
                <p className="text-sm text-green-400 text-center py-2">
                  No errors
                </p>
              ) : (
                <ul className="space-y-2">
                  {debug.errors.map((error, index) => (
                    <li
                      key={index}
                      className="text-sm text-red-400 flex items-start gap-2"
                    >
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      {error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default DebugDrawer;
