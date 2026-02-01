"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { animate } from "animejs";
import {
  HeroSection,
  ProblemSection,
  HowItWorksSection,
  PreviewSection,
  TrustSection,
  TechStrip,
  FinalCTA,
} from "./components/landing";

export default function LandingPage() {
  const navRef = useRef<HTMLDivElement>(null);
  const handleWatchHowItWorks = useCallback(() => {
    const element = document.getElementById("how-it-works");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const hero = document.getElementById("hero");
    if (hero) {
      const observer = new IntersectionObserver(
        (entries) => {
          const isHeroVisible = entries[0]?.isIntersecting;
          if (isHeroVisible) {
            animate(nav, {
              opacity: 0,
              translateY: -16,
              duration: 260,
              ease: "outQuad",
              begin: () => {
                nav.style.pointerEvents = "none";
              },
            });
          } else {
            animate(nav, {
              opacity: 1,
              translateY: 0,
              duration: 800,
              ease: "outElastic(1, .7)",
              begin: () => {
                nav.style.pointerEvents = "auto";
              },
            });
          }
        },
        { threshold: 0.6 }
      );
      observer.observe(hero);

      return () => {
        observer.disconnect();
      };
    }

    return () => {
    };
  }, []);

  return (
    <div className="min-h-screen bg-ink">
      {/* Background effects */}
      <div className="background-gradient" />
      <div className="background-noise" />
      <div className="background-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-6 left-1/2 z-50 -translate-x-1/2">
        <div
          ref={navRef}
          className="opacity-0 -translate-y-4 pointer-events-none bg-ink/70 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 shadow-[0_12px_40px_rgba(8,12,20,0.45),0_0_30px_rgba(96,134,174,0.15)]"
        >
          <div className="relative flex items-center gap-6">
            <button
              onClick={() => {
                const element = document.getElementById("hero");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              className="relative z-10 text-lg font-semibold text-eggshell"
            >
              Recall
            </button>

            <div className="relative z-10 hidden sm:flex items-center gap-2">
              <button
                onClick={handleWatchHowItWorks}
                className="px-4 py-2 text-sm text-denim hover:text-eggshell hover:bg-space/60 transition-colors rounded-full"
              >
                How It Works
              </button>
              <Link
                href="/app"
                className="px-4 py-2 text-sm text-ink bg-amber hover:bg-amber-muted transition-colors font-semibold rounded-full"
              >
                Try it now
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="relative z-10">
        <HeroSection onWatchHowItWorks={handleWatchHowItWorks} />
        <ProblemSection />
        <HowItWorksSection />
        <PreviewSection />
        <TrustSection />
        <TechStrip />
        <FinalCTA />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slateblue/20 bg-space/30">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-eggshell">Recall</span>

            <p className="text-sm text-denim text-center">
              Built with love at SanD Hacks 2025
            </p>

            <div className="flex items-center gap-4">
              <Link
                href="/app"
                className="text-sm text-denim hover:text-eggshell transition-colors"
              >
                Demo
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-denim hover:text-eggshell transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
