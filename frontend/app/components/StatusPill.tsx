"use client";

import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus } from "../store/appStore";

interface StatusPillProps {
  status: ConnectionStatus;
  className?: string;
}

const statusConfig: Record<
  ConnectionStatus,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  connected: { label: "Connected", variant: "success" },
  mock: { label: "Mock", variant: "warning" },
  offline: { label: "Offline", variant: "destructive" },
};

export function StatusPill({ status, className }: StatusPillProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      <span className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            status === "connected"
              ? "bg-green-400 animate-pulse"
              : status === "mock"
                ? "bg-amber-400"
                : "bg-red-400"
          }`}
        />
        {config.label}
      </span>
    </Badge>
  );
}

export default StatusPill;
