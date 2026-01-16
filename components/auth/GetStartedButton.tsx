"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Lazy load AuthModal to defer Clerk JS loading until user clicks the button
const AuthModal = dynamic(() => import("./AuthModal").then((mod) => mod.AuthModal), {
  ssr: false,
});

interface GetStartedButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function GetStartedButton({ className, children }: GetStartedButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={className}>
        {children || "Get Started"}
      </button>
      {isOpen && <AuthModal isOpen={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
}
