"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
    OrbitControls,
    PerspectiveCamera,
    Text,
    Html,
    Grid,
    Environment
} from "@react-three/drei";
import * as THREE from "three";

// Types matching the camera API response
export interface Position3D {
    x: number;
    y: number;
    z: number;
}

export interface SpatialObject {
    id: string;
    name: string;
    position: Position3D;
    confidence: number;
    timestamp: string;
}

export interface SpatialData {
    objects: SpatialObject[];
    cameraPosition: Position3D;
    mapPoints?: Position3D[];
    path?: Position3D[];
}

export interface GuidanceState {
    active: boolean;
    targetObjectId: string | null;
}

// Mock data for demonstration
export const mockSpatialData: SpatialData = {
    objects: [
        {
            id: "water_bottle_001",
            name: "water bottle",
            position: { x: 2.5, y: 0, z: 1.0 },
            confidence: 0.94,
            timestamp: "2024-01-31T11:55:00Z",
        },
        {
            id: "keys_001",
            name: "keys",
            position: { x: -1.5, y: 0, z: 2.5 },
            confidence: 0.87,
            timestamp: "2024-01-31T11:50:00Z",
        },
        {
            id: "backpack_001",
            name: "backpack",
            position: { x: 1.0, y: 0, z: -1.5 },
            confidence: 0.91,
            timestamp: "2024-01-31T11:45:00Z",
        },
        {
            id: "laptop_001",
            name: "laptop",
            position: { x: -2.0, y: 0, z: -2.0 },
            confidence: 0.98,
            timestamp: "2024-01-31T11:52:00Z",
        },
        {
            id: "phone_001",
            name: "phone",
            position: { x: 0.5, y: 0, z: 0.8 },
            confidence: 0.95,
            timestamp: "2024-01-31T11:58:00Z",
        },
    ],
    cameraPosition: { x: 0, y: 1.5, z: 0 },
    mapPoints: [
        { x: 0.1, y: 0, z: 0.1 },
        { x: 4.0, y: 0, z: 0.1 },
        { x: 4.0, y: 0, z: 5.0 },
        { x: 0.1, y: 0, z: 5.0 },
        { x: 2.0, y: 0, z: 2.5 },
        { x: 1.5, y: 0, z: 3.5 },
    ],
};

// Object marker component
function ObjectMarker({
    object,
    isSelected,
    onClick
}: {
    object: SpatialObject;
    isSelected: boolean;
    onClick: () => void;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    // Animate selected/hovered markers
    useFrame((state) => {
        if (meshRef.current) {
            if (isSelected) {
                meshRef.current.position.y = 0.15 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
            } else {
                meshRef.current.position.y = 0.15;
            }
        }
    });

    // Color based on confidence
    const color = useMemo(() => {
        if (isSelected) return "#7c3aed"; // Purple for selected
        if (object.confidence > 0.9) return "#22c55e"; // Green for high confidence
        if (object.confidence > 0.7) return "#eab308"; // Yellow for medium
        return "#ef4444"; // Red for low
    }, [object.confidence, isSelected]);

    return (
        <group position={[object.position.x, 0, object.position.z]}>
            {/* Object marker sphere */}
            <mesh
                ref={meshRef}
                position={[0, 0.15, 0]}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={hovered || isSelected ? 0.6 : 0.3}
                />
            </mesh>

            {/* Pulse ring effect for selected */}
            {isSelected && (
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.2, 0.25, 32]} />
                    <meshBasicMaterial color="#7c3aed" transparent opacity={0.6} />
                </mesh>
            )}

            {/* Ground indicator */}
            <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.06, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.4} />
            </mesh>

            {/* Label */}
            <Html
                position={[0, 0.4, 0]}
                center
                distanceFactor={6}
                style={{
                    pointerEvents: 'none',
                }}
            >
                <div
                    className={`
            px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
            ${isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-black/70 text-white backdrop-blur-sm'
                        }
          `}
                >
                    {object.name}
                    <span className="ml-1 opacity-60">
                        {Math.round(object.confidence * 100)}%
                    </span>
                </div>
            </Html>
        </group>
    );
}

// Camera position marker
function CameraMarker({ position }: { position: Position3D }) {
    return (
        <group position={[position.x, position.z, position.y]}>
            {/* Camera cone */}
            <mesh rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.3, 0.5, 4]} />
                <meshStandardMaterial color="#3b82f6" />
            </mesh>

            {/* Camera body */}
            <mesh position={[0, 0.35, 0]}>
                <boxGeometry args={[0.3, 0.2, 0.3]} />
                <meshStandardMaterial color="#1e40af" />
            </mesh>

            {/* Label */}
            <Html position={[0, 0.8, 0]} center>
                <div className="px-2 py-1 rounded-md text-xs font-medium bg-blue-600 text-white whitespace-nowrap">
                    You are here
                </div>
            </Html>
        </group>
    );
}

// Guidance Path Component - Red arrow and line from user to target
function GuidancePath({
    startPos,
    endPos,
    objectName
}: {
    startPos: Position3D;
    endPos: Position3D;
    objectName: string;
}) {
    const lineRef = useRef<THREE.Line>(null);
    const arrowRef = useRef<THREE.Group>(null);

    // Animate the guidance path
    useFrame((state) => {
        if (lineRef.current) {
            // Subtle pulsing effect on the line
            const material = lineRef.current.material as THREE.LineBasicMaterial;
            material.opacity = 0.7 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
        }
        if (arrowRef.current) {
            // Gentle bobbing animation on the arrow
            arrowRef.current.position.y = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
        }
    });

    // Calculate path points - smooth curve from start to end
    const pathPoints = useMemo(() => {
        const start = new THREE.Vector3(startPos.x, 0.1, startPos.z);
        const end = new THREE.Vector3(endPos.x, 0.1, endPos.z);

        // Create a slight arc for visual appeal
        const midPoint = new THREE.Vector3()
            .addVectors(start, end)
            .multiplyScalar(0.5);
        midPoint.y = 0.3; // Raise the middle point slightly

        // Create smooth curve
        const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
        return curve.getPoints(50);
    }, [startPos, endPos]);

    // Calculate arrow rotation to point at target
    const arrowRotation = useMemo(() => {
        const dx = endPos.x - startPos.x;
        const dz = endPos.z - startPos.z;
        return Math.atan2(dx, dz);
    }, [startPos, endPos]);

    // Calculate distance for voice guidance
    const distance = useMemo(() => {
        const dx = endPos.x - startPos.x;
        const dz = endPos.z - startPos.z;
        return Math.sqrt(dx * dx + dz * dz);
    }, [startPos, endPos]);

    const lineObject = useMemo(() => {
        const positions = new Float32Array(pathPoints.flatMap(p => [p.x, p.y, p.z]));
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({
            color: 0xef4444,
            linewidth: 2,
            transparent: true,
            opacity: 0.8,
        });
        return new THREE.Line(geometry, material);
    }, [pathPoints]);

    return (
        <group>
            {/* Guidance line */}
            <primitive ref={lineRef} object={lineObject} />

            {/* Directional arrow at destination */}
            <group
                ref={arrowRef}
                position={[endPos.x, 0.3, endPos.z]}
                rotation={[0, arrowRotation, 0]}
            >
                {/* Arrow cone */}
                <mesh rotation={[0, 0, 0]}>
                    <coneGeometry args={[0.15, 0.4, 8]} />
                    <meshStandardMaterial
                        color="#ef4444"
                        emissive="#ef4444"
                        emissiveIntensity={0.5}
                    />
                </mesh>

                {/* Arrow tail */}
                <mesh position={[0, -0.3, 0]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.2, 8]} />
                    <meshStandardMaterial
                        color="#dc2626"
                        emissive="#dc2626"
                        emissiveIntensity={0.3}
                    />
                </mesh>

                {/* Glowing ring at base */}
                <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.25, 0.3, 32]} />
                    <meshBasicMaterial color="#ef4444" transparent opacity={0.4} />
                </mesh>
            </group>

            {/* Distance marker */}
            <Html
                position={[
                    (startPos.x + endPos.x) / 2,
                    0.5,
                    (startPos.z + endPos.z) / 2
                ]}
                center
                distanceFactor={6}
            >
                <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-red-600 text-white whitespace-nowrap shadow-lg">
                    {distance.toFixed(1)}m to {objectName}
                </div>
            </Html>
        </group>
    );
}

// Scene component
function Scene({
    data,
    selectedObjectId,
    onObjectClick,
    guidanceState
}: {
    data: SpatialData;
    selectedObjectId: string | null;
    onObjectClick: (id: string) => void;
    guidanceState: GuidanceState;
}) {
    // Refs to track Three.js geometries for cleanup
    const prevPointGeometryRef = useRef<THREE.BufferGeometry | null>(null);
    const prevPathGeometryRef = useRef<THREE.BufferGeometry | null>(null);
    const prevPathMaterialRef = useRef<THREE.Material | null>(null);

    const pointPositions = useMemo(() => {
        if (!data.mapPoints || data.mapPoints.length === 0) return null;
        const positions = new Float32Array(data.mapPoints.length * 3);
        data.mapPoints.forEach((point, index) => {
            positions[index * 3] = point.x;
            positions[index * 3 + 1] = point.y;
            positions[index * 3 + 2] = point.z;
        });
        return positions;
    }, [data.mapPoints]);

    const pathPositions = useMemo(() => {
        if (!data.path || data.path.length < 2) return null;
        const positions = new Float32Array(data.path.length * 3);
        data.path.forEach((point, index) => {
            positions[index * 3] = point.x;
            positions[index * 3 + 1] = point.y;
            positions[index * 3 + 2] = point.z;
        });
        return positions;
    }, [data.path]);

    const pathLineObject = useMemo(() => {
        // Dispose previous geometry and material
        if (prevPathGeometryRef.current) {
            prevPathGeometryRef.current.dispose();
        }
        if (prevPathMaterialRef.current) {
            prevPathMaterialRef.current.dispose();
        }

        if (!pathPositions) return null;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(pathPositions, 3));
        const material = new THREE.LineDashedMaterial({
            color: 0x7bdff2,
            dashSize: 0.2,
            gapSize: 0.12,
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();

        prevPathGeometryRef.current = geometry;
        prevPathMaterialRef.current = material;
        return line;
    }, [pathPositions]);

    // Cleanup effect to dispose geometries on unmount
    useEffect(() => {
        return () => {
            if (prevPointGeometryRef.current) {
                prevPointGeometryRef.current.dispose();
            }
            if (prevPathGeometryRef.current) {
                prevPathGeometryRef.current.dispose();
            }
            if (prevPathMaterialRef.current) {
                prevPathMaterialRef.current.dispose();
            }
        };
    }, []);

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />

            {/* Grid floor */}
            <Grid
                infiniteGrid
                cellSize={1}
                cellThickness={0.5}
                cellColor="#334155"
                sectionSize={5}
                sectionThickness={1}
                sectionColor="#475569"
                fadeDistance={30}
                fadeStrength={1}
                followCamera={false}
            />

            {/* Camera position marker */}
            <CameraMarker position={data.cameraPosition} />

            {/* Object markers */}
            {data.objects.map((obj) => (
                <ObjectMarker
                    key={obj.id}
                    object={obj}
                    isSelected={selectedObjectId === obj.id}
                    onClick={() => onObjectClick(obj.id)}
                />
            ))}

            {/* Guidance path - red arrow and line to target */}
            {guidanceState.active && guidanceState.targetObjectId && (() => {
                const targetObject = data.objects.find(obj => obj.id === guidanceState.targetObjectId);
                if (targetObject) {
                    return (
                        <GuidancePath
                            startPos={data.cameraPosition}
                            endPos={targetObject.position}
                            objectName={targetObject.name}
                        />
                    );
                }
                return null;
            })()}

            {/* Point cloud */}
            {pointPositions && (
                <points>
                    <bufferGeometry>
                        <bufferAttribute
                            args={[pointPositions, 3]}
                            attach="attributes-position"
                            array={pointPositions}
                            itemSize={3}
                            count={pointPositions.length / 3}
                        />
                    </bufferGeometry>
                    <pointsMaterial color="#ffffff" size={0.03} opacity={0.6} transparent />
                </points>
            )}

            {/* Guidance path */}
            {pathLineObject && <primitive object={pathLineObject} />}

            {/* Camera controls */}
            <OrbitControls
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                maxPolarAngle={Math.PI / 2.1}
                minDistance={2}
                maxDistance={20}
            />

            {/* Environment for reflections */}
            <Environment preset="city" />
        </>
    );
}

// Voice guidance helper function
function speakGuidance(objectName: string, distance: number, isUpdate = false) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        let message: string;
        if (isUpdate) {
            message = `${objectName} is ${distance.toFixed(1)} meters away.`;
        } else {
            message = `Guiding you to ${objectName}. It is approximately ${distance.toFixed(1)} meters away. Follow the red path.`;
        }

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        window.speechSynthesis.speak(utterance);
    }
}

// Stop voice guidance
function stopVoiceGuidance() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

// Utility function to find object by name (fuzzy matching)
export function findObjectByQuery(objects: SpatialObject[], query: string): SpatialObject | null {
    const lowerQuery = query.toLowerCase().trim();

    // Exact match first
    let match = objects.find(obj => obj.name.toLowerCase() === lowerQuery);
    if (match) return match;

    // Partial match
    match = objects.find(obj => obj.name.toLowerCase().includes(lowerQuery));
    if (match) return match;

    // Word match
    match = objects.find(obj =>
        lowerQuery.split(' ').some(word => obj.name.toLowerCase().includes(word))
    );

    return match || null;
}

// Main component
interface SpatialMapProps {
    data?: SpatialData;
    selectedObjectId?: string | null;
    onObjectSelect?: (id: string | null) => void;
    onGuideRequest?: (objectId: string) => void; // Callback for when user requests guidance
    guidanceQuery?: string | null; // External query to trigger guidance (e.g., from voice/text input)
    guidanceVoiceEnabled?: boolean; // Whether to speak guidance when triggered externally
    className?: string;
}

export function SpatialMap({
    data = mockSpatialData,
    selectedObjectId = null,
    onObjectSelect,
    onGuideRequest,
    guidanceQuery = null,
    guidanceVoiceEnabled = true,
    className = ""
}: SpatialMapProps) {
    const [guidanceState, setGuidanceState] = useState<GuidanceState>({
        active: false,
        targetObjectId: null
    });

    // Handle external guidance queries (from voice/text input)
    useEffect(() => {
        if (guidanceQuery) {
            const targetObject = findObjectByQuery(data.objects, guidanceQuery);
            if (targetObject) {
                // Select the object
                if (onObjectSelect) {
                    onObjectSelect(targetObject.id);
                }

                // Calculate distance
                const dx = targetObject.position.x - data.cameraPosition.x;
                const dz = targetObject.position.z - data.cameraPosition.z;
                const distance = Math.sqrt(dx * dx + dz * dz);

                // Activate guidance
                setGuidanceState({
                    active: true,
                    targetObjectId: targetObject.id
                });

                // Speak guidance (optional)
                if (guidanceVoiceEnabled) {
                    speakGuidance(targetObject.name, distance);
                }

                // Notify parent
                if (onGuideRequest) {
                    onGuideRequest(targetObject.id);
                }
            }
        }
    }, [
        guidanceQuery,
        data.objects,
        data.cameraPosition,
        onObjectSelect,
        onGuideRequest,
        guidanceVoiceEnabled
    ]);

    const handleObjectClick = (id: string) => {
        if (onObjectSelect) {
            onObjectSelect(selectedObjectId === id ? null : id);
        }
        // Stop guidance when clicking on a different object
        if (guidanceState.active && guidanceState.targetObjectId !== id) {
            setGuidanceState({ active: false, targetObjectId: null });
        }
    };

    return (
        <div className={`relative w-full h-full min-h-[300px] rounded-lg overflow-hidden bg-slate-900 ${className}`}>
            <Canvas shadows>
                <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
                <Scene
                    data={data}
                    selectedObjectId={selectedObjectId}
                    onObjectClick={handleObjectClick}
                    guidanceState={guidanceState}
                />
            </Canvas>

            {/* Legend overlay */}
            <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-xs text-white">
                <div className="font-medium mb-2">Object Confidence</div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span>&gt; 90%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span>70-90%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span>&lt; 70%</span>
                    </div>
                </div>
            </div>

            {/* Controls hint */}
            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white/70">
                Drag to rotate • Scroll to zoom
            </div>
        </div>
    );
}

export default SpatialMap;
