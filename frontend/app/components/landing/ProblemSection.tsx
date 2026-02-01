"use client";

import { useEffect, useRef } from "react";
import { Brain, Users, Briefcase, BookOpen, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { animations } from "../../lib/animations";

const affectedGroups = [
    { icon: Brain, title: "Memory loss", description: "55M+ people worldwide", impactStat: "152 items/year lost" },
    { icon: Briefcase, title: "Busy professionals", description: "Hours lost to searching", impactStat: "2.5 days/year wasted" },
    { icon: BookOpen, title: "Students", description: "Materials everywhere", impactStat: "43% miss deadlines" },
    { icon: Users, title: "Caregivers", description: "Helping loved ones", impactStat: "16hrs/week assisting" },
];

export function ProblemSection() {
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && sectionRef.current) {
                        const cards = sectionRef.current.querySelectorAll(".memory-card");
                        animations.memoryScanReveal(Array.from(cards));
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
        <section ref={sectionRef} className="min-h-screen py-20 px-4 bg-space/50 flex flex-col items-center justify-center">
            <div className="max-w-5xl mx-auto text-center">
                {/* Badge - sleek gradient */}
                {/*}
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-slateblue/20 to-denim/20 border border-slateblue/40 mb-8 backdrop-blur-sm">
                    <Sparkles className="h-4 w-4 text-slateblue" />
                    <span className="text-sm font-medium bg-gradient-to-r from-slateblue to-denim bg-clip-text text-transparent">The Unsolved Problem</span>
                </div>
                */}

                {/* Core problem */}
                <h2 className="text-4xl sm:text-5xl font-semibold text-eggshell mb-6 font-serif">
                    No system remembers{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-slateblue via-amber to-denim">
                        where things are.
                    </span>
                </h2>

                <p className="text-xl text-denim max-w-2xl mx-auto mb-16">
                    AI can recognize objects in the moment—but it can&apos;t recall where you left them.
                </p>

                {/* Affected groups - larger cards with memory scan animation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {affectedGroups.map((group) => (
                        <Card key={group.title} className="memory-card glass-card opacity-0">
                            <CardContent className="p-8 text-center">
                                {/* Icon */}
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slateblue/20 via-amber/20 to-denim/20 mb-4">
                                    <group.icon className="h-8 w-8 text-amber" />
                                </div>

                                {/* Title */}
                                <h3 className="text-lg font-semibold text-eggshell mb-2 font-serif">
                                    {group.title}
                                </h3>

                                {/* Description */}
                                <p className="text-sm text-denim/70 mb-4">
                                    {group.description}
                                </p>

                                {/* Impact stat - flickering like low-power digital display */}
                                <div className="mt-4 pt-3 border-t border-amber/20">
                                    <p className="text-xs text-amber/80 font-mono stat-flicker">
                                        {group.impactStat}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default ProblemSection;
