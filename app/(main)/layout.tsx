import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { OnboardingGuard } from "@/components/auth/OnboardingGuard";
import { ProductHuntBadge } from "@/components/marketing/ProductHuntBadge";
import { Providers } from "../providers";

// PWA 제거 (2026-05-24): InstallBanner / UpdateNotification 마운트 해제.
// public/sw.js 의 self-destruct SW 가 옛 PWA 사용자 자동 회수.
export const dynamic = "force-dynamic";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <OnboardingGuard>
        <div className="min-h-screen flex flex-col bg-bg-primary">
          <Header />
          <main className="flex-1 pt-12">{children}</main>
          <Footer />
          <ProductHuntBadge />
        </div>
      </OnboardingGuard>
    </Providers>
  );
}
