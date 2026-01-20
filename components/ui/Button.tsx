"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-claude-coral)]/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-claude-coral)] text-white shadow-sm shadow-black/5 hover:bg-[var(--color-claude-coral)]/90",
        primary:
          "bg-[var(--color-claude-coral)] text-white shadow-sm shadow-black/5 hover:bg-[var(--color-claude-coral)]/90",
        destructive: "bg-red-500 text-white shadow-sm shadow-black/5 hover:bg-red-500/90",
        outline:
          "border border-[var(--border-default)] bg-transparent shadow-sm shadow-black/5 hover:bg-white/5 hover:text-[var(--color-text-primary)]",
        secondary:
          "bg-white/10 text-[var(--color-text-primary)] shadow-sm shadow-black/5 hover:bg-white/15",
        ghost: "hover:bg-white/10 hover:text-[var(--color-text-primary)]",
        link: "text-[var(--color-claude-coral)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, fullWidth = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), fullWidth && "w-full")}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
