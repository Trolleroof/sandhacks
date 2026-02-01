"use client";

import { Shield, Clock, Eye, Lock } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Memory, not surveillance",
    description: "We remember locations, not behaviors. Your privacy is paramount.",
  },
  {
    icon: Clock,
    title: "Last known location",
    description: "Only the most recent timestamp and position are stored.",
  },
  {
    icon: Eye,
    title: "On-device processing",
    description: "Object detection happens locally on your device.",
  },
  {
    icon: Lock,
    title: "No cloud storage",
    description: "Your spatial data never leaves your local network.",
  },
];

export function TrustSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-semibold text-eggshell mb-4 font-serif">
            Built on Trust
          </h2>
          <p className="text-lg text-denim max-w-2xl mx-auto">
            Memory, not surveillance. Your privacy is our priority.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="text-center p-6 rounded-[18px] bg-space/30 border border-slateblue/20 hover:border-slateblue/40 transition-colors"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-[14px] bg-amber/20 mb-4">
                <feature.icon className="h-6 w-6 text-amber" />
              </div>
              <h3 className="text-lg font-semibold text-eggshell mb-2 font-serif">
                {feature.title}
              </h3>
              <p className="text-sm text-denim">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TrustSection;
