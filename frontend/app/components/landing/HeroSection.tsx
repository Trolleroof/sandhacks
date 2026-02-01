"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { animations } from "../../lib/animations";

interface HeroSectionProps {
  onWatchHowItWorks?: () => void;
}

export function HeroSection({ onWatchHowItWorks }: HeroSectionProps) {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (heroRef.current) {
      const elements = heroRef.current.querySelectorAll(".animate-in");
      animations.heroReveal(Array.from(elements));
    }
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center px-6 md:px-12 lg:px-20 py-24"
    >
      {/* Subtle background - less generic than centered glowing orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-slateblue/8 to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-amber/5 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left side - Copy */}
          <div className="text-left">
            {/* Small label - more grounded than floating icons */}
            {/*
            <div className="animate-in opacity-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-space/60 border border-slateblue/30 mb-8">
              <span className="w-2 h-2 rounded-full bg-sage animate-pulse" />
              <span className="text-sm text-denim">For people & caregivers</span>
            </div>
            */}

            {/* Headline - left-aligned, more human */}
            <h1 className="animate-in text-4xl sm:text-5xl lg:text-6xl font-semibold text-eggshell mb-6 opacity-0 leading-[1.1] font-serif">
              Your home now
              <br />
              <span className="text-amber">has a memory</span>
            </h1>

            {/* Subheadline - warmer, more direct */}
            <p className="animate-in text-lg sm:text-xl text-denim max-w-lg mb-8 opacity-0 leading-relaxed">
            Reality Memory gives spaces persistent memory—so you don't have to.
            </p>

            {/* CTA Buttons - solid primary, subtle secondary */}
            <div className="animate-in flex flex-col sm:flex-row items-start gap-4 opacity-0">
              <Button
                asChild
                size="lg"
                className="text-base px-7 py-6 bg-amber hover:bg-amber-muted text-ink font-semibold shadow-lg shadow-amber/20"
              >
                <Link href="/app">Try it now</Link>
              </Button>

              <Button
                variant="ghost"
                size="lg"
                className="text-base px-6 py-6 text-denim hover:text-eggshell"
                onClick={onWatchHowItWorks}
              >
                See how it works
              </Button>
            </div>
          </div>

          {/* Right side - Product visual (not generic floating shapes) */}
          <div className="animate-in opacity-0 relative">
            {/* Mockup container */}
            <div className="relative bg-space/50 backdrop-blur-sm rounded-3xl border border-slateblue/30 p-6 shadow-2xl shadow-ink/50">
              {/* Simulated interface */}
              <div className="space-y-4">
                {/* Query example */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 bg-space/70 rounded-2xl rounded-tl-md px-4 py-3 border border-slateblue/20">
                    <p className="text-eggshell text-sm">"Where did I put my reading glasses?"</p>
                  </div>
                </div>

                {/* Response example */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 bg-ink/60 rounded-2xl rounded-tl-md px-4 py-3 border border-slateblue/25">
                    <p className="text-eggshell text-sm mb-2">
                      Your reading glasses are on the kitchen counter, near the coffee maker.
                    </p>
                    <div className="text-xs text-denim">Last seen 2 hours ago</div>
                  </div>
                </div>

                {/* Architectural floor plan mockup - unified SVG system */}
                <div className="mt-4 h-36 rounded-xl border border-slateblue/20 overflow-hidden relative floor-plan-grid bg-ink/30">
                  {/* SVG Floor Plan + All Visual Elements */}
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 200 100"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      {/* Blue glow filter for "You" marker */}
                      <filter id="blue-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
                      </filter>

                      {/* Amber glow filter for "Object" marker */}
                      <filter id="amber-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
                      </filter>
                    </defs>

                    {/* Outer walls - scaled to fill 92% width, 80% height */}
                    <rect
                      x="8"
                      y="10"
                      width="184"
                      height="80"
                      fill="none"
                      stroke="#4a5568"
                      strokeWidth="0.6"
                      strokeOpacity="0.9"
                    />

                    {/* Room divider - vertical wall with doorway */}
                    <line x1="89" y1="10" x2="89" y2="39" stroke="#4a5568" strokeWidth="0.6" strokeOpacity="0.9" />
                    <line x1="89" y1="56" x2="89" y2="90" stroke="#4a5568" strokeWidth="0.6" strokeOpacity="0.9" />

                    {/* Kitchen counter (L-shape) */}
                    <polyline
                      points="135,90 135,61 175,61"
                      fill="none"
                      stroke="#4a5568"
                      strokeWidth="0.6"
                      strokeOpacity="0.9"
                    />
                    {/* Counter surface hint */}
                    <line x1="135" y1="75" x2="171" y2="75" stroke="#4a5568" strokeWidth="0.4" strokeOpacity="0.6" />

                    {/* Small table in living room */}
                    <rect
                      x="25"
                      y="50"
                      width="23"
                      height="14"
                      fill="none"
                      stroke="#4a5568"
                      strokeWidth="0.4"
                      strokeOpacity="0.6"
                    />

                    {/* Curved path - starts exactly at YOU position (31, 87) */}
                    <path
                      d="M 31 87 Q 60 61, 89 44 Q 123 27, 164 61"
                      fill="none"
                      stroke="#D4A574"
                      strokeOpacity="0.5"
                      strokeWidth="1.2"
                      strokeDasharray="4 2"
                      strokeLinecap="round"
                      className="path-glow"
                    />

                    {/* POI marker line - vertical pin from glasses dot (164, 61) */}
                    <line
                      x1="164"
                      y1="61"
                      x2="164"
                      y2="47"
                      stroke="#D4A574"
                      strokeWidth="0.5"
                      strokeOpacity="0.6"
                    />

                    {/* Room labels - uppercase, subtle, with letter spacing */}
                    <text
                      x="48"
                      y="20"
                      fontSize="4.5"
                      fill="#888888"
                      fillOpacity="0.6"
                      textAnchor="middle"
                      fontWeight="500"
                      letterSpacing="1"
                    >
                      LIVING ROOM
                    </text>
                    <text
                      x="152"
                      y="20"
                      fontSize="4.5"
                      fill="#888888"
                      fillOpacity="0.6"
                      textAnchor="middle"
                      fontWeight="500"
                      letterSpacing="1"
                    >
                      KITCHEN
                    </text>

                    {/* "You" marker - blue pulsing dot - EXACT center at (31, 87) */}
                    <circle
                      cx="31"
                      cy="87"
                      r="2.5"
                      fill="#748cab"
                      filter="url(#blue-glow)"
                      className="svg-pulse-blue"
                    />

                    {/* "Reading Glasses" label - positioned 14 units above dot (20px visual offset) */}
                    <text
                      x="164"
                      y="40"
                      fontSize="5"
                      fill="#D4A574"
                      fillOpacity="0.9"
                      textAnchor="middle"
                      fontWeight="500"
                      letterSpacing="0.5"
                    >
                      READING GLASSES
                    </text>

                    {/* Object marker - amber pulsing dot at (164, 61) */}
                    <circle
                      cx="164"
                      cy="61"
                      r="2.5"
                      fill="#D4A574"
                      filter="url(#amber-glow)"
                      className="svg-pulse-amber"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Subtle decoration - not a perfect circle */}
            <div className="absolute -z-10 -top-8 -right-8 w-64 h-64 bg-amber/10 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] blur-3xl" />
          </div>
        </div>
      </div>

      {/* Scroll indicator - simpler */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="flex flex-col items-center gap-2 text-denim/50">
          <span className="text-xs tracking-wider uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-denim/50 to-transparent" />
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
