// Clerk 사용으로 인한 동적 렌더링 필수
export const dynamic = "force-dynamic";

export default function SSOCallbackLayout({ children }: { children: React.ReactNode }) {
  // ClerkProvider는 root layout에서 이미 제공됨 - 중복 감싸기 금지!
  return <>{children}</>;
}
