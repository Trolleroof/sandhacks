"use client";

import { useEffect, useRef } from "react";
import { Map, Eye, Navigation } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { animations } from "../../lib/animations";

const steps = [
  {
    icon: Map,
    title: "Map once",
    description: "Walk through your space while we learn where objects are.",
    color: "from-slateblue to-denim",
  },
  {
    icon: Eye,
    title: "We remember objects",
    description: "AI detects and catalogs every item with spatial coordinates.",
    color: "from-denim to-slateblue",
  },
  {
    icon: Navigation,
    title: "Ask and get guided",
    description: 'Just ask "Find my keys" and get voice-guided directions.',
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
            animations.staggerCards(cards);
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
    <section
      ref={sectionRef}
      id="how-it-works"
      className="py-24 px-4"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-eggshell mb-4">
            How It Works
          </h2>
          <p className="text-lg text-denim max-w-2xl mx-auto">
            Three simple steps to never lose track of your belongings again
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <Card
              key={step.title}
              className="step-card opacity-0 hover:border-slateblue/60 transition-all hover:-translate-y-1"
            >
              <CardContent className="p-8 text-center">
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-space text-denim text-sm font-medium mb-6">
                  {index + 1}
                </div>

                {/* Icon */}
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-[18px] bg-gradient-to-br ${step.color} mb-6`}
                >
                  <step.icon className="h-8 w-8 text-eggshell" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-eggshell mb-3">
                  {step.title}
                </h3>
                <p className="text-denim">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Connection line (desktop only) */}
        <div className="hidden md:block relative h-0 -mt-[200px] mb-[200px]">
          <div className="absolute top-0 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-transparent via-slateblue/30 to-transparent" />
        </div>
      </div>
    </section>
  );
}

export default HowItWorksSection;
