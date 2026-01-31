"use client";

import { Brain, Map, Eye, Mic, Navigation, CheckCircle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HelpDialogProps {
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const steps = [
    {
        icon: Map,
        title: "1. Map Your Space",
        description: "Switch to Mapping mode and walk around. The camera detects and remembers objects.",
        color: "text-slateblue",
    },
    {
        icon: Eye,
        title: "2. Objects Get Saved",
        description: "Each object is stored with its position and a thumbnail for quick recognition.",
        color: "text-denim",
    },
    {
        icon: Mic,
        title: "3. Ask Naturally",
        description: 'Switch to Recall mode. Ask "Where\'s my water bottle?" using voice or text.',
        color: "text-coral",
    },
    {
        icon: Navigation,
        title: "4. Get Guided",
        description: "Reality Memory tells you exactly where to look — distance, direction, and landmarks.",
        color: "text-slateblue",
    },
    {
        icon: CheckCircle,
        title: "5. Find It!",
        description: "Follow the audio guidance to locate your item. Never lose anything again.",
        color: "text-green-500",
    },
];

const technologies = [
    { name: "Cerebras", desc: "LLM inference" },
    { name: "ElevenLabs", desc: "Voice synthesis" },
    { name: "ROS2", desc: "Robot framework" },
    { name: "VSLAM", desc: "Spatial mapping" },
];

export function HelpDialog({ trigger, open, onOpenChange }: HelpDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-slateblue to-denim flex items-center justify-center">
                            <Brain className="h-6 w-6 text-eggshell" />
                        </div>
                        How Reality Memory Works
                    </DialogTitle>
                    <DialogDescription>
                        Your AI-powered spatial memory assistant for finding lost objects
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Steps */}
                    <div className="space-y-4">
                        {steps.map((step) => (
                            <div
                                key={step.title}
                                className="flex items-start gap-4 p-3 rounded-lg bg-space/50 border border-slateblue/20"
                            >
                                <div className={`mt-0.5 ${step.color}`}>
                                    <step.icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-eggshell">{step.title}</h4>
                                    <p className="text-sm text-denim">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tech Stack */}
                    <div className="border-t border-slateblue/30 pt-4">
                        <h4 className="text-sm font-medium text-eggshell mb-3">Powered By</h4>
                        <div className="flex flex-wrap gap-2">
                            {technologies.map((tech) => (
                                <Badge key={tech.name} variant="secondary" className="flex items-center gap-1.5">
                                    <span>{tech.name}</span>
                                    <span className="text-denim">·</span>
                                    <span className="text-denim font-normal">{tech.desc}</span>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Demo Mode Hint */}
                    <div className="bg-slateblue/10 border border-slateblue/30 rounded-lg p-4">
                        <h4 className="font-medium text-eggshell mb-2">🎯 Try the Demo</h4>
                        <p className="text-sm text-denim">
                            Demo Mode is enabled by default. Try asking: &quot;Find my water bottle&quot;,
                            &quot;Where are my keys?&quot;, or &quot;Locate my laptop&quot;.
                        </p>
                    </div>

                    {/* Credits */}
                    <div className="text-center text-sm text-denim pt-2">
                        Built with ❤️ at SanD Hacks 2025
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default HelpDialog;
