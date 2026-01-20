import { BrandSpinner } from "@/components/shared/BrandSpinner";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary">
      <BrandSpinner size="lg" showText />
    </div>
  );
}
