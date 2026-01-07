'use client';

import { useState } from 'react';
import { CLIModal } from './CLIModal';

interface CLIButtonProps {
  children: React.ReactNode;
  className?: string;
}

export function CLIButton({ children, className }: CLIButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={className}>
        {children}
      </button>
      <CLIModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default CLIButton;
