import { Providers } from "../providers";

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
