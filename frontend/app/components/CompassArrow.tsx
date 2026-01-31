"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { animations } from "../lib/animations";

interface CompassArrowProps {
  /** Bearing in degrees (-180 to 180, where 0 is forward, negative is left, positive is right) */
  bearing: number;
  /** Size of the compass (default: 120) */
  size?: number;
  /** Whether to show the pulse animation */
  showPulse?: boolean;
  className?: string;
}

export function CompassArrow({
  bearing,
  size = 120,
  showPulse = true,
  className,
}: CompassArrowProps) {
  const arrowRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (arrowRef.current) {
      animations.rotateCompass(arrowRef.current, bearing);
    }
  }, [bearing]);

  useEffect(() => {
    if (showPulse && arrowRef.current) {
      animations.guidanceArrowPulse(arrowRef.current);
    }
  }, [showPulse]);

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Compass background ring */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        className="absolute inset-0"
      >
        {/* Outer ring */}
        <circle
          cx="60"
          cy="60"
          r="56"
          fill="none"
          stroke="var(--slateblue)"
          strokeWidth="2"
          opacity="0.3"
        />

        {/* Cardinal direction marks */}
        <g stroke="var(--denim)" strokeWidth="2" opacity="0.6">
          {/* N - forward */}
          <line x1="60" y1="8" x2="60" y2="16" />
          {/* S - behind */}
          <line x1="60" y1="104" x2="60" y2="112" />
          {/* E - right */}
          <line x1="104" y1="60" x2="112" y2="60" />
          {/* W - left */}
          <line x1="8" y1="60" x2="16" y2="60" />
        </g>

        {/* Direction labels */}
        <g fill="var(--denim)" fontSize="10" textAnchor="middle">
          <text x="60" y="30">N</text>
          <text x="60" y="98">S</text>
          <text x="92" y="64">E</text>
          <text x="28" y="64">W</text>
        </g>

        {/* Arrow group */}
        <g
          ref={arrowRef}
          style={{ transformOrigin: "60px 60px", transform: `rotate(${bearing}deg)` }}
        >
          {/* Arrow shape */}
          <polygon
            points="60,18 72,70 60,58 48,70"
            fill="var(--eggshell)"
            stroke="var(--slateblue)"
            strokeWidth="2"
          />
          {/* Center dot */}
          <circle cx="60" cy="60" r="6" fill="var(--slateblue)" />
        </g>
      </svg>

      {/* Glow effect when pointing direction */}
      {showPulse && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(116, 140, 171, 0.2) 0%, transparent 70%)",
          }}
        />
      )}
    </div>
  );
}

export default CompassArrow;
