"use client";

import { Brain, Users, Briefcase, BookOpen, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const affectedGroups = [
    { icon: Brain, title: "Memory loss", description: "55M+ people worldwide" },
    { icon: Briefcase, title: "Busy professionals", description: "Hours lost to searching" },
    { icon: BookOpen, title: "Students", description: "Materials everywhere" },
    { icon: Users, title: "Caregivers", description: "Helping loved ones" },
];

export function ProblemSection() {
    return (
        <section className="min-h-screen py-20 px-4 bg-space/50 flex flex-col items-center justify-center">
            <div className="max-w-5xl mx-auto text-center">
                {/* Badge - sleek gradient */}
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-slateblue/20 to-denim/20 border border-slateblue/40 mb-8 backdrop-blur-sm">
                    <Sparkles className="h-4 w-4 text-slateblue" />
                    <span className="text-sm font-medium bg-gradient-to-r from-slateblue to-denim bg-clip-text text-transparent">The Unsolved Problem</span>
                </div>

                {/* Core problem */}
                <h2 className="text-4xl sm:text-5xl font-bold text-eggshell mb-6">
                    No system remembers{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-slateblue to-denim">
                        where things are.
                    </span>
                </h2>

                <p className="text-xl text-denim max-w-2xl mx-auto mb-16">
                    AI can recognize objects in the moment—but it can&apos;t recall where you left them.
                </p>

                {/* Affected groups - larger cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {affectedGroups.map((group) => (
                        <Card key={group.title} className="bg-space/50 border-slateblue/30 hover:border-slateblue/60 transition-colors">
                            <CardContent className="p-8 text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slateblue/20 to-denim/20 mb-4">
                                    <group.icon className="h-8 w-8 text-denim" />
                                </div>
                                <h3 className="text-lg font-semibold text-eggshell mb-2">{group.title}</h3>
                                <p className="text-sm text-denim/70">{group.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default ProblemSection;
