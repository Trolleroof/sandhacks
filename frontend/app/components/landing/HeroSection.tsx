"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
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
      animations.heroReveal(elements);
    }
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-4 py-20"
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-slateblue/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-denim/15 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Badge */}
        {/*
        <div className="animate-in inline-flex items-center gap-2 px-4 py-2 rounded-full bg-space border border-slateblue/40 mb-8 opacity-0">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-denim">AI-Powered Object Memory</span>
        </div>
        */}
        

        {/* Title */}
        <h1 className="animate-in text-5xl sm:text-6xl md:text-7xl font-bold text-eggshell mb-6 opacity-0">
          Reality Memory
        </h1>

        {/* Subtitle */}
        <p className="animate-in text-xl sm:text-2xl text-denim max-w-2xl mx-auto mb-10 opacity-0">
          Ask where you last saw something.
          <br />
          <span className="text-eggshell">Get guided back.</span>
        </p>

        {/* CTA Buttons */}
        <div className="animate-in flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0">
          <Button asChild size="lg" className="text-lg px-8 py-6">
            <Link href="/app">
              Launch Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="text-lg px-8 py-6"
            onClick={onWatchHowItWorks}
          >
            <Play className="mr-2 h-5 w-5" />
            Watch How It Works
          </Button>
        </div>

        {/* Stats */}
        <div className="animate-in grid grid-cols-3 gap-8 mt-16 max-w-lg mx-auto opacity-0">
          <div className="text-center">
            <div className="text-3xl font-bold text-eggshell">50+</div>
            <div className="text-sm text-denim">Objects tracked</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-eggshell">&lt;1s</div>
            <div className="text-sm text-denim">Response time</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-eggshell">95%</div>
            <div className="text-sm text-denim">Accuracy</div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-denim/50 flex items-start justify-center p-2">
          <div className="w-1 h-2 rounded-full bg-denim animate-pulse" />
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
