"use client";

import { MapPin, Clock, Navigation, Wifi } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function PreviewSection() {
  return (
    <section className="py-24 px-4 bg-space/30">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-semibold text-eggshell mb-4 font-serif">
            See It In Action
          </h2>
          <p className="text-lg text-denim max-w-2xl mx-auto">
            Instant object location with voice-guided navigation
          </p>
        </div>

        {/* Preview frame */}
        <div className="relative max-w-4xl mx-auto">
          {/* Browser frame */}
          <div className="rounded-[24px] border border-slateblue/40 bg-ink overflow-hidden shadow-2xl">
            {/* Browser header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-space/50 border-b border-slateblue/30">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-[8px] bg-space text-xs text-denim">
                  recall.ai
                </div>
              </div>
            </div>

            {/* App content preview */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Camera view mock */}
              <div className="aspect-video bg-gradient-to-br from-space to-ink rounded-[18px] border border-slateblue/30 flex items-center justify-center relative overflow-hidden">
                {/* Simulated camera view */}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />

                {/* Vertical scanning line - mechanical effect */}
                <div className="scanning-line" />

                {/* Detection box */}
                <div className="absolute top-1/4 left-1/3 w-24 h-24 border-2 border-denim rounded-lg flex items-end justify-center pb-1 z-10">
                  <Badge variant="secondary" className="text-xs">
                    water bottle
                  </Badge>
                </div>

                {/* Status - pulsing Live indicator */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-ink/80 backdrop-blur-sm rounded-[10px] px-3 py-1.5 animate-pulse-live z-20">
                  <Wifi className="h-3.5 w-3.5 text-green-400 animate-pulse" />
                  <span className="text-xs text-eggshell">Live</span>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                </div>
              </div>

              {/* Results panel mock */}
              <div className="space-y-4">
                {/* Mode toggle mock */}
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-1 rounded-[14px] bg-space p-1 border border-slateblue/30">
                    <div className="px-4 py-2 rounded-[10px] text-sm text-denim">
                      Mapping
                    </div>
                    <div className="px-4 py-2 rounded-[10px] bg-slateblue text-sm text-eggshell">
                      Recall
                    </div>
                  </div>
                </div>

                {/* Result card mock */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-14 h-14 rounded-[14px] bg-gradient-to-br from-slateblue via-amber to-denim flex items-center justify-center">
                        <MapPin className="h-7 w-7 text-eggshell" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-eggshell font-serif">
                            Water Bottle
                          </h3>
                          <span className="text-sm text-green-400">94%</span>
                        </div>
                        <Progress value={94} className="h-1.5 mt-1 mb-2" />
                        <div className="flex items-center gap-2 text-sm text-denim">
                          <Clock className="h-3.5 w-3.5" />
                          <span>2 minutes ago</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-eggshell mt-1">
                          <Navigation className="h-3.5 w-3.5 text-denim" />
                          <span>3.2m &middot; to your left, near the window</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Guidance mock */}
                <Card className="bg-space/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-4xl font-bold text-eggshell mb-1">
                      3.2<span className="text-lg text-denim ml-1">m</span>
                    </div>
                    <p className="text-sm text-denim">
                      Turn 45° left and walk forward
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -z-10 -bottom-10 -right-10 w-64 h-64 bg-slateblue/10 rounded-full blur-[60px]" />
          <div className="absolute -z-10 -top-10 -left-10 w-48 h-48 bg-denim/10 rounded-full blur-[50px]" />
        </div>
      </div>
    </section>
  );
}

export default PreviewSection;
