import { Spinner } from '@/components/shared/Spinner';

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary">
      {/* Logo Animation */}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)] flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-2xl">CC</span>
        </div>
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-[var(--color-claude-coral)] opacity-30 blur-xl animate-glow-pulse -z-10" />
      </div>

      {/* Spinner */}
      <Spinner size="lg" className="mb-4" />

      {/* Loading Text */}
      <p className="text-text-secondary text-sm animate-pulse">Loading...</p>
    </div>
  );
}
