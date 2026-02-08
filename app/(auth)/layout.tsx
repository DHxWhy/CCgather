// Clerk 사용으로 인한 동적 렌더링 필수
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
