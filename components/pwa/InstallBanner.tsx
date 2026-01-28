"use client";

import { usePWAInstall } from "@/hooks/use-pwa-install";
import { X, Download } from "lucide-react";

export function InstallBanner() {
  const { canShowBanner, promptInstall, dismiss } = usePWAInstall();

  if (!canShowBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[360px] z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-[#161616]/95 backdrop-blur-sm border border-white/10 rounded-xl p-4 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center">
            <Download size={18} className="text-violet-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white/90 leading-snug">Install CCgather</p>
            <p className="text-[12px] text-white/50 mt-0.5 leading-relaxed">
              Add to home screen for quick access and push notifications
            </p>

            <button
              onClick={promptInstall}
              className="mt-3 px-4 py-1.5 text-[12px] font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
            >
              Install App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
