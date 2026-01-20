"use client";

import Link from "next/link";
import { useState } from "react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { CLIModal } from "@/components/cli/CLIModal";

interface GetStartedButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function GetStartedButton({ className, children }: GetStartedButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Not logged in: go to sign-up */}
      <SignedOut>
        <Link href="/sign-up" className={className}>
          {children || "Get Started"}
        </Link>
      </SignedOut>

      {/* Logged in: show CLI modal */}
      <SignedIn>
        <button onClick={() => setIsModalOpen(true)} className={className}>
          {children || "Get Started"}
        </button>
        <CLIModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </SignedIn>
    </>
  );
}
