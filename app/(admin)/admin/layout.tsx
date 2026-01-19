import { ClerkProviderWrapper } from "@/components/providers/ClerkProviderWrapper";
import { AdminLayoutClient } from "./AdminLayoutClient";

// Clerk 사용으로 인한 동적 렌더링 필수
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProviderWrapper>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </ClerkProviderWrapper>
  );
}
