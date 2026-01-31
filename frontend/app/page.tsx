"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Brain } from "lucide-react";
import {
  HeroSection,
  HowItWorksSection,
  PreviewSection,
  TrustSection,
  TechStrip,
  FinalCTA,
} from "./components/landing";

export default function LandingPage() {
  const handleWatchHowItWorks = useCallback(() => {
    const element = document.getElementById("how-it-works");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-ink/80 backdrop-blur-md border-b border-slateblue/20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-slateblue to-denim flex items-center justify-center">
              <Brain className="h-6 w-6 text-eggshell" />
            </div>
            <span className="text-lg font-semibold text-eggshell">
              Reality Memory
            </span>
          </Link>

          <div className="hidden sm:flex items-center gap-6">
            <button
              onClick={handleWatchHowItWorks}
              className="text-sm text-denim hover:text-eggshell transition-colors"
            >
              How It Works
            </button>
            <Link
              href="/app"
              className="text-sm px-4 py-2 rounded-[10px] bg-slateblue text-eggshell hover:bg-slateblue/80 transition-colors"
            >
              Launch Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="relative z-10">
        <HeroSection onWatchHowItWorks={handleWatchHowItWorks} />
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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[8px] bg-gradient-to-br from-slateblue to-denim flex items-center justify-center">
                <Brain className="h-4 w-4 text-eggshell" />
              </div>
              <span className="text-sm text-eggshell">Reality Memory</span>
            </div>

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
