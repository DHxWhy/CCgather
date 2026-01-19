import Link from "next/link";

interface GetStartedButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function GetStartedButton({ className, children }: GetStartedButtonProps) {
  return (
    <Link href="/sign-in" className={className}>
      {children || "Get Started"}
    </Link>
  );
}
