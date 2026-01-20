"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { CLIModal } from "@/components/cli/CLIModal";

interface GetStartedButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function GetStartedButton({ className, children }: GetStartedButtonProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Default to sign-up link while Clerk is loading or during logout transition
  if (!isLoaded || !isSignedIn) {
    return (
      <Link href="/sign-up" className={className}>
        {children || "Get Started"}
      </Link>
    );
  }

  // Logged in: show CLI modal
  return (
    <>
      <button onClick={() => setIsModalOpen(true)} className={className}>
        {children || "Get Started"}
      </button>
      <CLIModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
