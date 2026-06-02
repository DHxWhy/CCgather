import Link from "next/link";

interface GetStartedLinkProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Landing page CTA button - Link to /sign-up.
 *
 * MUST be /sign-up (useSignUp flow). New users routed to /sign-in (useSignIn)
 * silently FAIL to create a Clerk account — this caused a 3.5-month signup
 * outage (commit 4d475b4: "useSignIn → useSignUp 복원") and recurred here.
 * The /sign-up page's useSignUp + AuthenticateWithRedirectCallback is the
 * Clerk-recommended OAuth sign-up path. DO NOT change back to /sign-in.
 */
export function GetStartedLink({ className, children }: GetStartedLinkProps) {
  return (
    <Link href="/sign-up" className={className}>
      {children || "Get Started"}
    </Link>
  );
}
