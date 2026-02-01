"use client";

import { Cpu, Eye, Zap, Mic } from "lucide-react";

const technologies = [
  { icon: Cpu, name: "VSLAM", description: "Visual SLAM" },
  { icon: Eye, name: "YOLO", description: "Object Detection" },
  { icon: Zap, name: "FastAPI", description: "Backend" },
  { icon: Mic, name: "Voice", description: "Natural Language" },
];

export function TechStrip() {
  return (
    <section className="py-12 px-4 border-y border-slateblue/20 bg-space/20">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {technologies.map((tech, index) => (
            <div
              key={tech.name}
              className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity"
            >
              <tech.icon className="h-5 w-5 text-denim" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-eggshell">
                  {tech.name}
                </span>
                <span className="text-xs text-denim">{tech.description}</span>
              </div>
              {index < technologies.length - 1 && (
                <span className="hidden md:block ml-8 w-px h-8 bg-slateblue/30" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TechStrip;
