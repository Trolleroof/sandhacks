"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { animations } from "../../lib/animations";
import { HiOutlineMap } from "react-icons/hi2";
import { IoMdSave } from "react-icons/io";
import { MdSearch } from "react-icons/md";
import type { IconType } from "react-icons";

// Pre-generated point cloud positions to avoid hydration mismatch
// (Math.random() produces different values on server vs client)
const POINT_CLOUD_DOTS = [
  { cx: 45, cy: 23 }, { cx: 167, cy: 98 }, { cx: 12, cy: 67 }, { cx: 189, cy: 42 },
  { cx: 78, cy: 134 }, { cx: 134, cy: 15 }, { cx: 56, cy: 89 }, { cx: 23, cy: 112 },
  { cx: 156, cy: 67 }, { cx: 89, cy: 45 }, { cx: 34, cy: 78 }, { cx: 178, cy: 123 },
  { cx: 67, cy: 34 }, { cx: 145, cy: 89 }, { cx: 12, cy: 145 }, { cx: 98, cy: 12 },
  { cx: 123, cy: 67 }, { cx: 45, cy: 123 }, { cx: 189, cy: 78 }, { cx: 67, cy: 56 },
  { cx: 156, cy: 134 }, { cx: 23, cy: 45 }, { cx: 112, cy: 98 }, { cx: 78, cy: 23 },
  { cx: 34, cy: 134 }, { cx: 145, cy: 45 }, { cx: 89, cy: 112 }, { cx: 167, cy: 34 },
  { cx: 56, cy: 67 }, { cx: 123, cy: 145 },
];

const steps: { title: string; description: string; Icon: IconType }[] = [
  {
    title: "Map your space",
    description: "Walk through your environment while our AI learns and catalogs object locations in real-time.",
    Icon: HiOutlineMap,
  },
  {
    title: "We remember",
    description: "Every object is stored with precise spatial coordinates, a persistent memory for your space.",
    Icon: IoMdSave,
  },
  {
    title: "Ask & find",
    description: '"Where are my keys?" Get instant voice-guided directions to any remembered object.',
    Icon: MdSearch,
  },
];

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && sectionRef.current) {
            const cards = sectionRef.current.querySelectorAll(".step-card");
            animations.staggerCards(Array.from(cards));

            // Animate breadcrumb line
            const line = sectionRef.current.querySelector(".breadcrumb-line");
            if (line) {
              animations.breadcrumbDraw(line);
            }

            observer.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="min-h-screen py-20 px-4 flex flex-col items-center justify-center">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-semibold text-eggshell mb-4 font-serif">
            How It Works
          </h2>
          <p className="text-xl text-denim/80">
            Three steps to persistent spatial memory.
          </p>
        </div>

        {/* Steps - larger cards with V-SLAM visualization on Step 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.Icon;
            return (
              <Card
                key={step.title}
                className="step-card opacity-0 hover:border-slateblue/60 transition-all hover:-translate-y-2 relative overflow-hidden"
              >
                {/* V-SLAM Point Cloud visualization for Step 1 */}
              {index === 0 && (
                <svg
                  className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
                  viewBox="0 0 200 150"
                  preserveAspectRatio="xMidYMid slice"
                >
                  <defs>
                    <clipPath id="step1-bg-clip">
                      <rect x="0" y="0" width="200" height="100" />
                    </clipPath>
                  </defs>
                  {/* Grid lines - technical background */}
                  <g className="grid-lines" stroke="#3E5C76" strokeWidth="0.5" opacity="0.3" clipPath="url(#step1-bg-clip)">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <line key={`h${i}`} x1="0" y1={i * 15} x2="200" y2={i * 15} />
                    ))}
                    {Array.from({ length: 8 }).map((_, i) => (
                      <line key={`v${i}`} x1={i * 25} y1="0" x2={i * 25} y2="150" />
                    ))}
                  </g>

                  {/* Point cloud dots - appearing effect */}
                  <g clipPath="url(#step1-bg-clip)">
                    {POINT_CLOUD_DOTS.map((dot, i) => (
                    <circle
                      key={`dot-${i}`}
                      cx={dot.cx}
                      cy={dot.cy}
                      r="1.5"
                      fill="#D4A574"
                      className="point-cloud-dot"
                      style={{ animationDelay: `${i * 50}ms` }}
                    />
                    ))}
                  </g>
                </svg>
              )}

              {/* Knowledge graph visualization for Step 2 */}
              {index === 1 && (
                <svg
                  className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
                  viewBox="0 0 200 150"
                  preserveAspectRatio="xMidYMid slice"
                >
                  <g className="neural-lines" stroke="#D4A574" strokeWidth="1">
                    {[
                      { x1: 30, y1: 30, x2: 70, y2: 20, delay: 0 },
                      { x1: 70, y1: 20, x2: 120, y2: 35, delay: 150 },
                      { x1: 120, y1: 35, x2: 160, y2: 25, delay: 300 },
                      { x1: 30, y1: 30, x2: 50, y2: 75, delay: 450 },
                      { x1: 50, y1: 75, x2: 100, y2: 90, delay: 600 },
                      { x1: 100, y1: 90, x2: 150, y2: 80, delay: 750 },
                      { x1: 120, y1: 35, x2: 100, y2: 90, delay: 900 },
                    ].map((line, i) => (
                      <line
                        key={`line-${i}`}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        className="neural-line-draw"
                        style={{ animationDelay: `${line.delay}ms` }}
                      />
                    ))}
                  </g>
                </svg>
              )}

                {/* Knowledge graph visualization for Step 2 */}
                {index === 1 && (
                  <svg
                    className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
                    viewBox="0 0 200 150"
                    preserveAspectRatio="xMidYMid slice"
                  >
                    <defs>
                      <clipPath id="step2-bg-clip">
                        <rect x="0" y="0" width="200" height="100" />
                      </clipPath>
                    </defs>
                    <g className="neural-lines" stroke="#D4A574" strokeWidth="1" clipPath="url(#step2-bg-clip)">
                      {[
                        { x1: 30, y1: 30, x2: 70, y2: 20, delay: 0 },
                        { x1: 70, y1: 20, x2: 120, y2: 35, delay: 150 },
                        { x1: 120, y1: 35, x2: 160, y2: 25, delay: 300 },
                        { x1: 30, y1: 30, x2: 50, y2: 75, delay: 450 },
                        { x1: 50, y1: 75, x2: 100, y2: 90, delay: 600 },
                        { x1: 100, y1: 90, x2: 150, y2: 80, delay: 750 },
                        { x1: 120, y1: 35, x2: 100, y2: 90, delay: 900 },
                      ].map((line, i) => (
                        <line
                          key={`line-${i}`}
                          x1={line.x1}
                          y1={line.y1}
                          x2={line.x2}
                          y2={line.y2}
                          className="neural-line-draw"
                          style={{ animationDelay: `${line.delay}ms` }}
                        />
                      ))}
                    </g>

                    <g clipPath="url(#step2-bg-clip)">
                      {[
                        { cx: 30, cy: 30, delay: 0 },
                        { cx: 70, cy: 20, delay: 120 },
                        { cx: 120, cy: 35, delay: 240 },
                        { cx: 160, cy: 25, delay: 360 },
                        { cx: 50, cy: 75, delay: 480 },
                        { cx: 100, cy: 90, delay: 600 },
                        { cx: 150, cy: 80, delay: 720 },
                        { cx: 80, cy: 120, delay: 840 },
                      ].map((node, i) => (
                        <circle
                          key={`node-${i}`}
                          cx={node.cx}
                          cy={node.cy}
                          r="4"
                          fill="#D4A574"
                          className="neural-node-pop"
                          style={{ animationDelay: `${node.delay}ms` }}
                        />
                      ))}
                    </g>
                  </svg>
                )}

                {/* Pathfinding visualization for Step 3 */}
                {index === 2 && (
                  <svg
                    className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
                    viewBox="0 0 200 150"
                    preserveAspectRatio="xMidYMid slice"
                  >
                    <defs>
                      <clipPath id="step3-bg-clip">
                        <rect x="0" y="0" width="200" height="100" />
                      </clipPath>
                    </defs>
                    <g className="floor-grid" stroke="#3E5C76" strokeWidth="1" opacity="0.6" clipPath="url(#step3-bg-clip)">
                      <rect x="15" y="20" width="70" height="40" fill="none" />
                      <rect x="95" y="20" width="90" height="30" fill="none" />
                      <rect x="15" y="70" width="60" height="55" fill="none" />
                      <rect x="85" y="60" width="100" height="65" fill="none" />
                      <line x1="45" y1="20" x2="45" y2="60" />
                      <line x1="120" y1="20" x2="120" y2="50" />
                      <line x1="85" y1="90" x2="185" y2="90" />
                    </g>

                    <g clipPath="url(#step3-bg-clip)">
                      <path
                        d="M 30 45 L 60 45 L 60 90 L 115 90 L 115 70 L 160 70"
                        fill="none"
                        stroke="#D4A574"
                        strokeWidth="2"
                        className="path-draw"
                      />

                      <circle cx="30" cy="45" r="4" fill="#D4A574" className="start-pulse" />
                      <circle cx="160" cy="70" r="5" fill="#D4A574" className="target-glow" />

                      <g className="radar-pulse">
                        <circle cx="160" cy="70" r="8" fill="none" stroke="#D4A574" strokeWidth="1.5" className="radar-ripple" />
                        <circle cx="160" cy="70" r="14" fill="none" stroke="#D4A574" strokeWidth="1.2" className="radar-ripple delay-1" />
                        <circle cx="160" cy="70" r="20" fill="none" stroke="#D4A574" strokeWidth="1" className="radar-ripple delay-2" />
                      </g>
                    </g>
                  </svg>
                )}

                <CardContent className="p-10 text-center relative z-10">
                  {/* Icon from react-icons (same pack as ProblemSection) */}
                  <div className="flex justify-center mb-4">
                    <step.Icon
                      className="w-11 h-11 text-eggshell drop-shadow-[0_0_12px_rgba(240,235,216,0.35)]"
                      aria-hidden
                    />
                  </div>
                  <div className="text-xs uppercase tracking-[0.3em] text-eggshell/70 drop-shadow-[0_0_8px_rgba(240,235,216,0.25)] mb-4">
                    Step {index + 1}
                  </div>
                  <h3 className="text-xl font-semibold text-eggshell mb-3 font-serif">
                    {step.title}
                  </h3>
                  <p className="text-base text-eggshell/90 leading-relaxed">{step.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Breadcrumb line connector (desktop only) - animated SVG */}
        <div className="hidden md:block relative mt-12 h-2">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 10"
            preserveAspectRatio="none"
          >
            {/* Background line - faint reference */}
            <line
              x1="0"
              y1="5"
              x2="100"
              y2="5"
              stroke="#3E5C76"
              strokeWidth="2"
              strokeOpacity="0.3"
            />

            {/* Animated progress line */}
            <line
              x1="0"
              y1="5"
              x2="100"
              y2="5"
              stroke="#D4A574"
              strokeWidth="2"
              strokeDasharray="100"
              strokeDashoffset="100"
              className="breadcrumb-line"
            />

            {/* Arrow markers at progress points */}
            <polygon points="32,5 35,3 35,7" fill="#D4A574" className="arrow-1" opacity="0" />
            <polygon points="65,5 68,3 68,7" fill="#D4A574" className="arrow-2" opacity="0" />
          </svg>
        </div>
      </div>
    </section>
  );
}

export default HowItWorksSection;
