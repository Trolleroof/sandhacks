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

// Detected object from YOLO/camera
export interface DetectedObject {
  id: string;
  name: string;
  position: VslamVector3;
  confidence: number;
  timestamp: string;
}

interface RosbridgeSpatialState {
  pose: RosPose | null;
  pointCloud: VslamVector3[];
  path: VslamVector3[];
  objects: DetectedObject[];
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
  objects: [],
  status: "idle",
  error: null,
};

// Throttle configuration to prevent excessive React re-renders
const POINT_CLOUD_THROTTLE_MS = 1000;  // 1 second for point clouds
const POSE_THROTTLE_MS = 500;           // 0.5 seconds for pose
const PATH_THROTTLE_MS = 1000;          // 1 second for path
const OBJECTS_THROTTLE_MS = 500;        // 0.5 seconds for objects

// Maximum point cloud size to prevent memory issues
const MAX_POINT_CLOUD_SIZE = 50000;

// Rosbridge delivers std_msgs/String as { data: "<json>" }.
// Peel that wrapper so downstream parsers see the actual payload.
function unwrapStringMsg(msg: unknown): unknown {
  if (
    msg &&
    typeof msg === "object" &&
    "data" in msg &&
    typeof (msg as { data: unknown }).data === "string"
  ) {
    try {
      return JSON.parse((msg as { data: string }).data);
    } catch {
      return msg;
    }
  }
  return msg;
}

function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface PointCloudMsg {
  point_step: number;
  fields: { name: string; offset: number; datatype: number }[];
  points_b64: string;
}

function isPointCloudMsg(value: unknown): value is PointCloudMsg {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.point_step === "number" &&
    Array.isArray(obj.fields) &&
    typeof obj.points_b64 === "string"
  );
}

// Decode the base64 raw buffer using the field descriptors from the
// PointCloud2 envelope.  Supports FLOAT32 (datatype 7) and FLOAT64 (8).
function decodePointCloud(msg: PointCloudMsg): VslamVector3[] {
  const buffer = base64Decode(msg.points_b64);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const xField = msg.fields.find((f) => f.name === "x");
  const yField = msg.fields.find((f) => f.name === "y");
  const zField = msg.fields.find((f) => f.name === "z");
  if (!xField || !yField || !zField) return [];

  const numPoints = Math.floor(buffer.length / msg.point_step);
  const points: VslamVector3[] = new Array(numPoints);
  // PointField datatype 7 = FLOAT32, 8 = FLOAT64
  const isDouble = xField.datatype === 8;
  const read = isDouble
    ? (offset: number) => view.getFloat64(offset, true)
    : (offset: number) => view.getFloat32(offset, true);

  for (let i = 0; i < numPoints; i++) {
    const base = i * msg.point_step;
    points[i] = {
      x: read(base + xField.offset),
      y: read(base + yField.offset),
      z: read(base + zField.offset),
    };
  }

  // Add size limiting to prevent memory issues
  if (points.length > MAX_POINT_CLOUD_SIZE) {
    const step = Math.ceil(points.length / MAX_POINT_CLOUD_SIZE);
    const sampled = points.filter((_, index) => index % step === 0);
    console.warn(
      `[Rosbridge] Point cloud too large (${points.length} points). ` +
      `Sampled down to ${sampled.length} points.`
    );
    return sampled;
  }

  return points;
}

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
    if (Array.isArray(record.poses)) {
      return parsePoints(record.poses);
    }
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

  // Refs for throttling state updates
  const lastUpdateTimeRef = useRef({
    pointCloud: 0,
    pose: 0,
    path: 0,
    objects: 0,
  });

  const pendingUpdatesRef = useRef<Partial<RosbridgeSpatialState>>({});
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      socket.send(JSON.stringify({ op: "subscribe", topic: "/web/objects" }));
    };

    socket.onerror = () => {
      if (!isActive) return;
      setState((prev) => ({ ...prev, status: "error", error: "Rosbridge connection error" }));
    };

    socket.onclose = () => {
      if (!isActive) return;
      setState((prev) => ({ ...prev, status: "error", error: "Rosbridge disconnected" }));
    };

    // Throttle helper functions
    const shouldUpdate = (
      lastUpdateTime: number,
      throttleMs: number
    ): boolean => {
      return Date.now() - lastUpdateTime >= throttleMs;
    };

    const scheduleFlush = () => {
      if (flushTimeoutRef.current) return;

      flushTimeoutRef.current = setTimeout(() => {
        if (Object.keys(pendingUpdatesRef.current).length > 0) {
          setState((prev) => ({ ...prev, ...pendingUpdatesRef.current }));
          pendingUpdatesRef.current = {};
        }
        flushTimeoutRef.current = null;
      }, 16); // One animation frame
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

      // std_msgs/String arrives as { data: "<json>" } — unwrap it.
      const payload = unwrapStringMsg(parsed.msg);

      if (parsed.topic === "/web/pose") {
        const pose = parsePose(payload);
        if (pose && shouldUpdate(lastUpdateTimeRef.current.pose, POSE_THROTTLE_MS)) {
          lastUpdateTimeRef.current.pose = Date.now();
          pendingUpdatesRef.current.pose = pose;
          scheduleFlush();
        }
      }

      if (parsed.topic === "/web/pointcloud") {
        if (isPointCloudMsg(payload) && shouldUpdate(lastUpdateTimeRef.current.pointCloud, POINT_CLOUD_THROTTLE_MS)) {
          const points = decodePointCloud(payload);
          if (points.length > 0) {
            lastUpdateTimeRef.current.pointCloud = Date.now();
            pendingUpdatesRef.current.pointCloud = points;
            scheduleFlush();
          }
        }
      }

      if (parsed.topic === "/web/path") {
        const points = parsePoints(payload);
        if (points.length > 0 && shouldUpdate(lastUpdateTimeRef.current.path, PATH_THROTTLE_MS)) {
          lastUpdateTimeRef.current.path = Date.now();
          pendingUpdatesRef.current.path = points;
          scheduleFlush();
        }
      }

      // Handle detected objects and camera position from YOLO/camera
      if (parsed.topic === "/web/objects") {
        const objPayload = payload as {
          objects?: DetectedObject[];
          cameraPosition?: VslamVector3;
        };
        const objects = objPayload?.objects;
        const cameraPos = objPayload?.cameraPosition;

        if (objects && Array.isArray(objects) && shouldUpdate(lastUpdateTimeRef.current.objects, OBJECTS_THROTTLE_MS)) {
          console.log("[Rosbridge] Received objects:", objects.length);
          lastUpdateTimeRef.current.objects = Date.now();
          pendingUpdatesRef.current.objects = objects;

          // Also update pose with camera position if provided
          if (cameraPos && isVector3(cameraPos)) {
            console.log("[Rosbridge] Received camera position:", cameraPos);
            lastUpdateTimeRef.current.pose = Date.now();
            pendingUpdatesRef.current.pose = {
              position: cameraPos,
              orientation: state.pose?.orientation ?? { x: 0, y: 0, z: 0, w: 1 },
            };
          }

          scheduleFlush();
        }
      }
    };

    return () => {
      isActive = false;
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ op: "unsubscribe", topic: "/web/pose" }));
        socket.send(JSON.stringify({ op: "unsubscribe", topic: "/web/pointcloud" }));
        socket.send(JSON.stringify({ op: "unsubscribe", topic: "/web/path" }));
        socket.send(JSON.stringify({ op: "unsubscribe", topic: "/web/objects" }));
      }
      socket.close();
    };
  }, [url, enabled]);

  return {
    pose: state.pose,
    pointCloud: state.pointCloud,
    path: state.path,
    objects: state.objects,
    status: state.status,
    error: state.error,
  };
}

export default useRosbridgeSpatial;
