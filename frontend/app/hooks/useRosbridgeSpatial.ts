"use client";

import { useEffect, useRef, useState } from "react";

interface VslamVector3 {
  x: number;
  y: number;
  z: number;
}

interface VslamQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface RosbridgeSpatialOptions {
  url: string;
  enabled?: boolean;
}

interface RosPose {
  position: VslamVector3;
  orientation: VslamQuaternion;
}

interface RosbridgeSpatialState {
  pose: RosPose | null;
  pointCloud: VslamVector3[];
  path: VslamVector3[];
  status: ConnectionStatus;
  error: string | null;
}

interface RosbridgeMessage {
  topic?: string;
  msg?: unknown;
}

const DEFAULT_STATE: RosbridgeSpatialState = {
  pose: null,
  pointCloud: [],
  path: [],
  status: "idle",
  error: null,
};

function isVector3(value: unknown): value is VslamVector3 {
  if (!value || typeof value !== "object") return false;
  const point = value as VslamVector3;
  return (
    typeof point.x === "number" &&
    typeof point.y === "number" &&
    typeof point.z === "number"
  );
}

function parsePoints(payload: unknown): VslamVector3[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    if (payload.length === 0) return [];
    if (typeof payload[0] === "number") {
      const numbers = payload as number[];
      const points: VslamVector3[] = [];
      for (let i = 0; i < numbers.length; i += 3) {
        if (numbers[i + 2] === undefined) break;
        points.push({ x: numbers[i], y: numbers[i + 1], z: numbers[i + 2] });
      }
      return points;
    }
    return payload.filter(isVector3);
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.points)) {
      return parsePoints(record.points);
    }
    if (Array.isArray(record.data)) {
      return parsePoints(record.data);
    }
  }

  return [];
}

function parsePose(payload: unknown): RosPose | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const pose = (record.pose ?? payload) as Record<string, unknown>;
  const position = pose.position;
  const orientation = pose.orientation;

  if (!isVector3(position) || !orientation || typeof orientation !== "object") {
    return null;
  }
  const quat = orientation as VslamQuaternion;
  if (
    typeof quat.x !== "number" ||
    typeof quat.y !== "number" ||
    typeof quat.z !== "number" ||
    typeof quat.w !== "number"
  ) {
    return null;
  }
  return { position, orientation: quat };
}

export function useRosbridgeSpatial({ url, enabled = true }: RosbridgeSpatialOptions) {
  const [state, setState] = useState<RosbridgeSpatialState>(DEFAULT_STATE);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let isActive = true;
    const socket = new WebSocket(url);
    socketRef.current = socket;
    setState((prev) => ({ ...prev, status: "connecting", error: null }));

    socket.onopen = () => {
      if (!isActive) return;
      setState((prev) => ({ ...prev, status: "connected", error: null }));
      socket.send(JSON.stringify({ op: "subscribe", topic: "/web/pose" }));
      socket.send(JSON.stringify({ op: "subscribe", topic: "/web/pointcloud" }));
      socket.send(JSON.stringify({ op: "subscribe", topic: "/web/path" }));
    };

    socket.onerror = () => {
      if (!isActive) return;
      setState((prev) => ({ ...prev, status: "error", error: "Rosbridge connection error" }));
    };

    socket.onclose = () => {
      if (!isActive) return;
      setState((prev) => ({ ...prev, status: "error", error: "Rosbridge disconnected" }));
    };

    socket.onmessage = (event) => {
      if (!isActive) return;
      let parsed: RosbridgeMessage | null = null;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!parsed?.topic) return;

      if (parsed.topic === "/web/pose") {
        const pose = parsePose(parsed.msg);
        if (pose) {
          setState((prev) => ({ ...prev, pose }));
        }
      }

      if (parsed.topic === "/web/pointcloud") {
        const points = parsePoints(parsed.msg);
        if (points.length > 0) {
          setState((prev) => ({ ...prev, pointCloud: points }));
        }
      }

      if (parsed.topic === "/web/path") {
        const points = parsePoints(parsed.msg);
        if (points.length > 0) {
          setState((prev) => ({ ...prev, path: points }));
        }
      }
    };

    return () => {
      isActive = false;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ op: "unsubscribe", topic: "/web/pose" }));
        socket.send(JSON.stringify({ op: "unsubscribe", topic: "/web/pointcloud" }));
        socket.send(JSON.stringify({ op: "unsubscribe", topic: "/web/path" }));
      }
      socket.close();
    };
  }, [url, enabled]);

  return {
    pose: state.pose,
    pointCloud: state.pointCloud,
    path: state.path,
    status: state.status,
    error: state.error,
  };
}

export default useRosbridgeSpatial;
