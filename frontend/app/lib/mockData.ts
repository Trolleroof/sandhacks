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
    id: "wallet_001",
    name: "wallet",
    lastSeen: "8 minutes ago",
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    distance: "2.6 meters",
    distanceMeters: 2.6,
    direction: "to your left, on the hallway table",
    bearing: -70,
    confidence: 0.89,
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
    id: "earbuds_001",
    name: "earbuds",
    lastSeen: "12 minutes ago",
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    distance: "4.4 meters",
    distanceMeters: 4.4,
    direction: "behind you, on the shelf",
    bearing: 160,
    confidence: 0.86,
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
  {
    id: "glasses_001",
    name: "glasses",
    lastSeen: "25 minutes ago",
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    distance: "3.9 meters",
    distanceMeters: 3.9,
    direction: "in front of you, on the side table",
    bearing: 15,
    confidence: 0.88,
  },
  {
    id: "watch_001",
    name: "watch",
    lastSeen: "40 minutes ago",
    timestamp: new Date(Date.now() - 40 * 60 * 1000),
    distance: "1.9 meters",
    distanceMeters: 1.9,
    direction: "to your right, by the lamp",
    bearing: 60,
    confidence: 0.84,
  },
  {
    id: "charger_001",
    name: "phone charger",
    lastSeen: "55 minutes ago",
    timestamp: new Date(Date.now() - 55 * 60 * 1000),
    distance: "2.2 meters",
    distanceMeters: 2.2,
    direction: "to your left, near the outlet",
    bearing: -30,
    confidence: 0.82,
  },
  {
    id: "id_card_001",
    name: "ID card",
    lastSeen: "1 hour ago",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    distance: "5.6 meters",
    distanceMeters: 5.6,
    direction: "behind you, on the counter",
    bearing: 175,
    confidence: 0.8,
  },
  {
    id: "umbrella_001",
    name: "umbrella",
    lastSeen: "2 hours ago",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    distance: "6.3 meters",
    distanceMeters: 6.3,
    direction: "to your right, near the door",
    bearing: 95,
    confidence: 0.83,
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
  { id: "det_002", label: "wallet", confidence: 0.89, timestamp: new Date(Date.now() - 5000) },
  { id: "det_003", label: "keys", confidence: 0.87, timestamp: new Date(Date.now() - 10000) },
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

// Calculate 3D Euclidean distance between two points
export function calculateDistance3D(
  pos1: { x: number; y: number; z: number },
  pos2: { x: number; y: number; z: number }
): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export interface NearbyObjectInfo {
  name: string;
  distance: number;
}

// Find nearby objects within a threshold distance
export function findNearbyObjects(
  targetObject: ObjectLocation,
  allObjects: ObjectLocation[],
  threshold: number = 1.5
): NearbyObjectInfo[] {
  return allObjects
    .filter((obj) => obj.id !== targetObject.id) // Exclude the target object itself
    .map((obj) => ({
      name: obj.name,
      distance: Math.abs(obj.distanceMeters - targetObject.distanceMeters), // Approximate distance between objects
    }))
    .filter((obj) => obj.distance <= threshold) // Only objects within threshold
    .sort((a, b) => a.distance - b.distance) // Sort by distance ascending
    .slice(0, 2); // Return top 2 nearest objects
}

// Find nearby objects using 3D positions
export function findNearbyObjects3D<T extends { id: string; name: string; position: { x: number; y: number; z: number } }>(
  targetObject: T,
  allObjects: T[],
  threshold: number = 1.5
): NearbyObjectInfo[] {
  return allObjects
    .filter((obj) => obj.id !== targetObject.id) // Exclude the target object itself
    .map((obj) => ({
      name: obj.name,
      distance: calculateDistance3D(targetObject.position, obj.position),
    }))
    .filter((obj) => obj.distance <= threshold) // Only objects within threshold
    .sort((a, b) => a.distance - b.distance) // Sort by distance ascending
    .slice(0, 2); // Return top 2 nearest objects
}
