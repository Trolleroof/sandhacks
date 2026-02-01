"use client";

import { useEffect, useRef } from "react";
import { Map, Brain, Navigation, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { animations } from "../../lib/animations";

const steps = [
  {
    icon: Map,
    title: "Map your space",
    description: "Walk through your environment while our AI learns and catalogs object locations in real-time.",
    color: "from-slateblue to-denim",
  },
  {
    icon: Brain,
    title: "We remember",
    description: "Every object is stored with precise spatial coordinates—a persistent memory for your space.",
    color: "from-denim to-slateblue",
  },
  {
    icon: Navigation,
    title: "Ask & find",
    description: '"Where are my keys?" Get instant voice-guided directions to any remembered object.',
    color: "from-slateblue via-denim to-slateblue",
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
          <h2 className="text-4xl sm:text-5xl font-bold text-eggshell mb-4">
            How It Works
          </h2>
          <p className="text-xl text-denim">
            Three steps to persistent spatial memory.
          </p>
        </div>

        {/* Steps - larger cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <Card
              key={step.title}
              className="step-card opacity-0 hover:border-slateblue/60 transition-all hover:-translate-y-2"
            >
              <CardContent className="p-10 text-center">
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-space text-denim text-lg font-bold mb-6">
                  {index + 1}
                </div>

                {/* Icon */}
                <div
                  className={`inline-flex items-center justify-center w-20 h-20 rounded-[20px] bg-gradient-to-br ${step.color} mb-6`}
                >
                  <step.icon className="h-10 w-10 text-eggshell" />
                </div>

                <h3 className="text-xl font-semibold text-eggshell mb-3">
                  {step.title}
                </h3>
                <p className="text-base text-denim leading-relaxed">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Connector arrows (desktop only) */}
        <div className="hidden md:flex justify-center items-center gap-4 mt-8">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slateblue/50 to-slateblue/50" />
          <ArrowRight className="h-5 w-5 text-slateblue" />
          <div className="flex-1 h-px bg-gradient-to-r from-slateblue/50 via-slateblue/50 to-slateblue/50" />
          <ArrowRight className="h-5 w-5 text-slateblue" />
          <div className="flex-1 h-px bg-gradient-to-r from-slateblue/50 via-slateblue/50 to-transparent" />
        </div>
      </div>
    </section>
  );
}

export default HowItWorksSection;
