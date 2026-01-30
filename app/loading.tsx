import { BrandSpinner } from "@/components/shared/BrandSpinner";

export default function RootLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)]">
      <BrandSpinner size="lg" showText />
    </div>
  );
}
