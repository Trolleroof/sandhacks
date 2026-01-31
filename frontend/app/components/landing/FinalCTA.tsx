"use client";

import Link from "next/link";
import { ArrowRight, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-[24px] bg-gradient-to-br from-slateblue to-denim mb-8">
          <Brain className="h-10 w-10 text-eggshell" />
        </div>

        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl font-bold text-eggshell mb-4">
          Ready to remember everything?
        </h2>
        <p className="text-lg text-denim max-w-xl mx-auto mb-8">
          Start mapping your space and never lose track of your belongings again.
        </p>

        {/* CTA Button */}
        <Button asChild size="lg" className="text-lg px-10 py-6">
          <Link href="/app">
            Launch Demo
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>

        {/* Footer note */}
        <p className="text-sm text-denim/60 mt-8">
          No account required. Works locally on your device.
        </p>
      </div>
    </section>
  );
}

export default FinalCTA;
