"use client";

import { Card, CardContent } from "@/components/ui/card";
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
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Spatial map preview (static image) */}
              <div className="h-full min-h-[260px] bg-ink rounded-[18px] border border-slateblue/30 flex items-center justify-center relative overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,0.45)]">
                <img
                  src="/images/demo.png"
                  alt="Spatial map preview showing detected objects"
                  className="block w-full h-full object-cover object-[50%_75%]"
                  loading="lazy"
                />
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
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-eggshell font-serif">
                            Water Bottle
                          </h3>
                          <span className="text-sm text-green-400">94%</span>
                        </div>
                        <Progress value={94} className="h-1.5 mt-1 mb-2" />
                        <div className="text-sm text-denim">Last seen 2 minutes ago</div>
                        <div className="text-sm text-eggshell mt-1">
                          3.2m &middot; to your left, near the window
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
