"use client";

import dynamic from "next/dynamic";

// Lazy load terminal animation for performance
const AuthTerminalAnimation = dynamic(
  () =>
    import("./AuthTerminalAnimation").then((mod) => ({
      default: mod.AuthTerminalAnimation,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-lg h-[320px] rounded-xl bg-white/5 animate-pulse" />
    ),
  }
);

export function AuthLeftPanel() {
  return (
    <div className="hidden lg:flex flex-col items-end justify-center w-full h-full pr-16 pl-16">
      {/* Content - Terminal aligned to right */}
      <div className="relative z-10 w-full max-w-md">
        <AuthTerminalAnimation />
      </div>
    </div>
  );
}
