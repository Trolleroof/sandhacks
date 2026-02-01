"use client";

import Link from "next/link";
import { ArrowRight, Brain, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="min-h-screen py-20 px-4 flex flex-col items-center justify-center relative">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-slateblue/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/3 w-64 h-64 bg-amber/12 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Main icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-[28px] bg-gradient-to-br from-slateblue via-amber to-denim mb-8">
          <Brain className="h-12 w-12 text-eggshell" />
        </div>

        <h2 className="text-4xl sm:text-5xl font-semibold text-eggshell mb-4 font-serif">
          Give your space memory.
        </h2>
        <p className="text-xl text-denim mb-10">
          Never ask &quot;where did I put that?&quot; again.
        </p>

        <Button asChild size="lg" className="text-xl px-12 py-7 mb-12 bg-amber hover:bg-amber-muted text-ink font-semibold shadow-lg shadow-amber/20">
          <Link href="/app">
            Try Reality Memory
            <ArrowRight className="ml-2 h-6 w-6" />
          </Link>
        </Button>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-8">
          <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-space/50 border border-slateblue/20">
            <Shield className="h-5 w-5 text-slateblue" />
            <span className="text-denim">Privacy-first</span>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-space/50 border border-slateblue/20">
            <Zap className="h-5 w-5 text-slateblue" />
            <span className="text-denim">Works locally</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FinalCTA;
