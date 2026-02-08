import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { OnboardingGuard } from "@/components/auth/OnboardingGuard";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { UpdateNotification } from "@/components/pwa/UpdateNotification";
import { ProductHuntBadge } from "@/components/marketing/ProductHuntBadge";
import { ClerkProviderWrapper } from "@/components/providers/ClerkProviderWrapper";
import { Providers } from "../providers";

export const dynamic = "force-dynamic";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProviderWrapper>
      <Providers>
        <OnboardingGuard>
          <div className="min-h-screen flex flex-col bg-bg-primary">
            <Header />
            <main className="flex-1 pt-12">{children}</main>
            <Footer />
            <InstallBanner />
            <UpdateNotification />
            <ProductHuntBadge />
          </div>
        </OnboardingGuard>
      </Providers>
    </ClerkProviderWrapper>
  );
}
