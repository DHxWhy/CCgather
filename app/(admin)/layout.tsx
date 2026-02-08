import { ClerkProviderWrapper } from "@/components/providers/ClerkProviderWrapper";
import { Providers } from "../providers";

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProviderWrapper>
      <Providers>{children}</Providers>
    </ClerkProviderWrapper>
  );
}
