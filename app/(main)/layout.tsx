import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { OnboardingGuard } from "@/components/auth/OnboardingGuard";
import { ClerkProviderWrapper } from "@/components/providers/ClerkProviderWrapper";

export const dynamic = "force-dynamic";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProviderWrapper>
      <OnboardingGuard>
        <div className="min-h-screen flex flex-col bg-bg-primary">
          <Header />
          <main className="flex-1 pt-16">{children}</main>
          <Footer />
        </div>
      </OnboardingGuard>
    </ClerkProviderWrapper>
  );
}
