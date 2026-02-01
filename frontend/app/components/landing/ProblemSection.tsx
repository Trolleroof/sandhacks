"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { animations } from "../../lib/animations";
import { FaBrain } from "react-icons/fa";
import { HiOutlineBriefcase } from "react-icons/hi2";
import { MdSchool } from "react-icons/md";
import { IoMdHeart } from "react-icons/io";
import type { IconType } from "react-icons";

const affectedGroups: { title: string; description: string; Icon: IconType }[] = [
    { title: "Memory loss", description: "55M+ people worldwide", Icon: FaBrain },
    { title: "Busy professionals", description: "Hours lost to searching", Icon: HiOutlineBriefcase },
    { title: "Students", description: "Materials everywhere", Icon: MdSchool },
    { title: "Caregivers", description: "Helping loved ones", Icon: IoMdHeart },
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
                    AI can recognize objects in the moment, but it can&apos;t recall where you left them.
                </p>

                {/* Affected groups - larger cards with memory scan animation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {affectedGroups.map((group) => {
                        const Icon = group.Icon;
                        return (
                            <Card key={group.title} className="memory-card glass-card opacity-0">
                                <CardContent className="p-8 text-center">
                                    {/* Icon from react-icons (different pack than lucide) */}
                                    <div className="flex justify-center mb-4">
                                        <Icon className="w-10 h-10 text-slateblue/90" aria-hidden />
                                    </div>
                                    {/* Title */}
                                    <h3 className="text-lg font-semibold text-eggshell mb-2 font-serif">
                                        {group.title}
                                    </h3>

                                    {/* Description */}
                                    <p className="text-sm text-denim/70">
                                        {group.description}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

export default ProblemSection;
