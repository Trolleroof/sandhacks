"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Eye, MapPin, Search, Volume2 } from "lucide-react";
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
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 py-20"
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-slateblue/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-denim/15 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-slateblue/10 rounded-full blur-[60px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Floating icons */}
        <div className="animate-in opacity-0 flex justify-center gap-6 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-space/80 border border-slateblue/30 flex items-center justify-center animate-pulse">
            <MapPin className="h-6 w-6 text-slateblue" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-space/80 border border-denim/30 flex items-center justify-center animate-pulse delay-100">
            <Search className="h-6 w-6 text-denim" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-space/80 border border-slateblue/30 flex items-center justify-center animate-pulse delay-200">
            <Volume2 className="h-6 w-6 text-slateblue" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="animate-in text-5xl sm:text-6xl md:text-7xl font-bold text-eggshell mb-6 opacity-0 leading-tight">
          The physical world{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-slateblue to-denim">
            forgets.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="animate-in text-xl sm:text-2xl text-denim max-w-xl mx-auto mb-10 opacity-0">
          Reality Memory gives spaces persistent memory—so you don&apos;t have to.
        </p>

        {/* CTA Buttons */}
        <div className="animate-in flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0">
          <Button asChild size="lg" className="text-lg px-8 py-6">
            <Link href="/app">
              Try it now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="text-lg px-8 py-6"
            onClick={onWatchHowItWorks}
          >
            <Eye className="mr-2 h-5 w-5" />
            See How It Works
          </Button>
        </div>

        {/* Stats */}
        <div className="animate-in grid grid-cols-3 gap-12 mt-20 max-w-2xl mx-auto opacity-0">
          <div className="text-center p-4 rounded-2xl bg-space/30 border border-slateblue/20">
            <div className="text-4xl font-bold text-eggshell mb-1">55M</div>
            <div className="text-sm text-denim">Living with dementia</div>
          </div>
          <div className="text-center p-4 rounded-2xl bg-space/30 border border-slateblue/20">
            <div className="text-4xl font-bold text-eggshell mb-1">&lt;1s</div>
            <div className="text-sm text-denim">Response time</div>
          </div>
          <div className="text-center p-4 rounded-2xl bg-space/30 border border-slateblue/20">
            <div className="text-4xl font-bold text-eggshell mb-1">100%</div>
            <div className="text-sm text-denim">Local &amp; private</div>
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
