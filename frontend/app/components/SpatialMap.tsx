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
                    📷 You are here
                </div>
            </Html>
        </group>
    );
}

// Scene component
function Scene({
    data,
    selectedObjectId,
    onObjectClick
}: {
    data: SpatialData;
    selectedObjectId: string | null;
    onObjectClick: (id: string) => void;
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

// Main component
interface SpatialMapProps {
    data?: SpatialData;
    selectedObjectId?: string | null;
    onObjectSelect?: (id: string | null) => void;
    className?: string;
}

export function SpatialMap({
    data = mockSpatialData,
    selectedObjectId = null,
    onObjectSelect,
    className = ""
}: SpatialMapProps) {
    const handleObjectClick = (id: string) => {
        if (onObjectSelect) {
            onObjectSelect(selectedObjectId === id ? null : id);
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
                🖱️ Drag to rotate • Scroll to zoom
            </div>
        </div>
    );
}

export default SpatialMap;
