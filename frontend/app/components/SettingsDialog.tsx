"use client";

import { useState } from "react";
import { Settings, Volume2, Mic, Cpu, RefreshCw } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface SettingsDialogProps {
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    useMockData: boolean;
    onUseMockDataChange: (value: boolean) => void;
    showBoundingBoxes: boolean;
    onShowBoundingBoxesChange: (value: boolean) => void;
    onReset: () => void;
}

export function SettingsDialog({
    trigger,
    open,
    onOpenChange,
    useMockData,
    onUseMockDataChange,
    showBoundingBoxes,
    onShowBoundingBoxesChange,
    onReset,
}: SettingsDialogProps) {
    const [confirmReset, setConfirmReset] = useState(false);

    const handleReset = () => {
        if (confirmReset) {
            onReset();
            setConfirmReset(false);
            onOpenChange?.(false);
        } else {
            setConfirmReset(true);
            setTimeout(() => setConfirmReset(false), 3000);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Settings
                    </DialogTitle>
                    <DialogDescription>
                        Customize your Reality Memory experience
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Voice Settings */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-eggshell flex items-center gap-2">
                            <Volume2 className="h-4 w-4" />
                            Voice & Audio
                        </h4>

                        <div className="space-y-3 pl-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-eggshell">Voice Engine</p>
                                    <p className="text-xs text-denim">ElevenLabs (George)</p>
                                </div>
                                <span className="text-xs text-slateblue bg-slateblue/10 px-2 py-1 rounded">
                                    Premium
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-eggshell">Speech Recognition</p>
                                    <p className="text-xs text-denim">Web Speech API</p>
                                </div>
                                <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">
                                    Active
                                </span>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-slateblue/30" />

                    {/* AI Settings */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-eggshell flex items-center gap-2">
                            <Cpu className="h-4 w-4" />
                            AI Engine
                        </h4>

                        <div className="space-y-3 pl-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-eggshell">LLM Provider</p>
                                    <p className="text-xs text-denim">Cerebras (Llama 3.3 70B)</p>
                                </div>
                                <span className="text-xs text-slateblue bg-slateblue/10 px-2 py-1 rounded">
                                    ~2000 tok/s
                                </span>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-slateblue/30" />

                    {/* Display Settings */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-eggshell flex items-center gap-2">
                            <Mic className="h-4 w-4" />
                            Display
                        </h4>

                        <div className="space-y-3 pl-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-eggshell">Demo Mode</p>
                                    <p className="text-xs text-denim">Use simulated object data</p>
                                </div>
                                <Switch
                                    checked={useMockData}
                                    onCheckedChange={onUseMockDataChange}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-eggshell">Bounding Boxes</p>
                                    <p className="text-xs text-denim">Show detection overlays</p>
                                </div>
                                <Switch
                                    checked={showBoundingBoxes}
                                    onCheckedChange={onShowBoundingBoxesChange}
                                />
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-slateblue/30" />

                    {/* Danger Zone */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-eggshell flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Reset
                        </h4>

                        <div className="pl-6">
                            <Button
                                variant={confirmReset ? "destructive" : "outline"}
                                size="sm"
                                onClick={handleReset}
                                className="w-full"
                            >
                                {confirmReset ? "Click again to confirm reset" : "Reset All Settings"}
                            </Button>
                            <p className="text-xs text-denim mt-2">
                                This will clear all search results and return to default settings.
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default SettingsDialog;
