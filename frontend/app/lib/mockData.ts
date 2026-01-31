// Mock data for demonstration - in production, this comes from backend

export interface ObjectLocation {
  id: string;
  name: string;
  lastSeen: string;
  timestamp: Date;
  distance: string;
  distanceMeters: number;
  direction: string;
  bearing: number;
  confidence: number;
  snapshot?: string;
}

export interface GuidanceData {
  targetId: string;
  targetName: string;
  distance: number;
  bearing: number;
  instruction: string;
  arrived: boolean;
}

export interface Detection {
  id: string;
  label: string;
  confidence: number;
  timestamp: Date;
}

export interface DebugData {
  detections: Detection[];
  lastResponseTime: number;
  errors: string[];
  memoryCount: number;
}

// Mock objects database (preserved from VoiceInterface)
export const mockObjects: ObjectLocation[] = [
  {
    id: "water_bottle_001",
    name: "water bottle",
    lastSeen: "2 minutes ago",
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    distance: "3.2 meters",
    distanceMeters: 3.2,
    direction: "to your left, near the window",
    bearing: -45,
    confidence: 0.94,
  },
  {
    id: "keys_001",
    name: "keys",
    lastSeen: "15 minutes ago",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    distance: "5.1 meters",
    distanceMeters: 5.1,
    direction: "behind you, on the desk",
    bearing: 180,
    confidence: 0.87,
  },
  {
    id: "backpack_001",
    name: "backpack",
    lastSeen: "1 hour ago",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    distance: "2.0 meters",
    distanceMeters: 2.0,
    direction: "to your right, by the chair",
    bearing: 90,
    confidence: 0.91,
  },
  {
    id: "laptop_001",
    name: "laptop",
    lastSeen: "5 minutes ago",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    distance: "1.5 meters",
    distanceMeters: 1.5,
    direction: "in front of you, on the table",
    bearing: 0,
    confidence: 0.98,
  },
  {
    id: "phone_001",
    name: "phone",
    lastSeen: "30 seconds ago",
    timestamp: new Date(Date.now() - 30 * 1000),
    distance: "0.8 meters",
    distanceMeters: 0.8,
    direction: "to your right, on the couch",
    bearing: 45,
    confidence: 0.95,
  },
];

// Mock guidance generator
export function getMockGuidance(target: ObjectLocation): GuidanceData {
  return {
    targetId: target.id,
    targetName: target.name,
    distance: target.distanceMeters,
    bearing: target.bearing,
    instruction: `Turn ${Math.abs(target.bearing)}° to your ${target.bearing < 0 ? "left" : "right"} and walk ${target.distanceMeters.toFixed(1)} meters`,
    arrived: false,
  };
}

// Mock detections for debug panel
export const mockDetections: Detection[] = [
  { id: "det_001", label: "water bottle", confidence: 0.94, timestamp: new Date() },
  { id: "det_002", label: "keys", confidence: 0.87, timestamp: new Date(Date.now() - 5000) },
  { id: "det_003", label: "laptop", confidence: 0.98, timestamp: new Date(Date.now() - 10000) },
];

// Find object in mock database (preserved from VoiceInterface)
export function findObject(query: string): ObjectLocation | null {
  const normalizedQuery = query.toLowerCase().trim();

  // Common query patterns
  const patterns = [
    /(?:find|where(?:'s| is)?|locate|look for|search for)\s+(?:my\s+)?(.+)/i,
    /(?:my\s+)?(.+)\s+(?:is\s+)?(?:where|location)/i,
    /(.+)/i, // Fallback to full query
  ];

  let objectName = normalizedQuery;

  for (const pattern of patterns) {
    const match = normalizedQuery.match(pattern);
    if (match && match[1]) {
      objectName = match[1].trim();
      break;
    }
  }

  // Remove common articles and possessives
  objectName = objectName.replace(/^(the|a|an|my)\s+/i, "").trim();

  return (
    mockObjects.find(
      (obj) =>
        obj.name.toLowerCase().includes(objectName) ||
        objectName.includes(obj.name.toLowerCase())
    ) || null
  );
}

// Search mock objects and return all matches
export function searchObjects(query: string): ObjectLocation[] {
  const normalizedQuery = query.toLowerCase().trim();

  // Remove common prefixes
  const objectName = normalizedQuery
    .replace(/^(?:find|where(?:'s| is)?|locate|look for|search for)\s+(?:my\s+)?/i, "")
    .replace(/^(the|a|an|my)\s+/i, "")
    .trim();

  if (!objectName) return [];

  return mockObjects.filter(
    (obj) =>
      obj.name.toLowerCase().includes(objectName) ||
      objectName.includes(obj.name.toLowerCase())
  );
}
