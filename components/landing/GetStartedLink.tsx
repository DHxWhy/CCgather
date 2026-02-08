import Link from "next/link";

interface GetStartedLinkProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Landing page CTA button - simple Link to /sign-up.
 * No Clerk dependency needed since middleware redirects
 * signed-in users away from landing page.
 */
export function GetStartedLink({ className, children }: GetStartedLinkProps) {
  return (
    <Link href="/sign-up" className={className}>
      {children || "Get Started"}
    </Link>
  );
}
