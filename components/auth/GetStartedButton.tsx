"use client";

import { useState } from "react";
import { AuthModal } from "./AuthModal";

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
      <AuthModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
