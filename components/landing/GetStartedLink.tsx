import Link from "next/link";

interface GetStartedLinkProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Landing page CTA button - simple Link to /sign-in.
 * Uses sign-in instead of sign-up because GitHub OAuth
 * auto-creates accounts for new users, and the signIn
 * flow is proven to persist sessions correctly.
 * No Clerk dependency needed since middleware redirects
 * signed-in users away from landing page.
 */
export function GetStartedLink({ className, children }: GetStartedLinkProps) {
  return (
    <Link href="/sign-in" className={className}>
      {children || "Get Started"}
    </Link>
  );
}
