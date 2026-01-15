"use client";

import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  side?: "left" | "right";
  title?: string;
  showCloseButton?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
}

// ============================================
// Component
// ============================================

export function MobileDrawer({
  open,
  onClose,
  children,
  side = "right",
  title,
  showCloseButton = true,
  closeOnOutsideClick = true,
  closeOnEscape = true,
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Swipe gesture state
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchCurrentX, setTouchCurrentX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isVerticalScroll, setIsVerticalScroll] = useState(false);

  // Swipe threshold and settings
  const SWIPE_THRESHOLD = 100; // px to trigger close
  const VERTICAL_THRESHOLD = 10; // px to detect vertical scroll

  // Touch handlers for swipe-to-close
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    setTouchCurrentX(touch.clientX);
    setIsDragging(false);
    setIsVerticalScroll(false);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (touchStartX === null || touchStartY === null) return;

      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      // Detect if this is a vertical scroll (first significant movement)
      if (!isDragging && !isVerticalScroll) {
        if (Math.abs(deltaY) > VERTICAL_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
          setIsVerticalScroll(true);
          return;
        }
        // For right-side drawer: only allow swipe right (positive deltaX)
        // For left-side drawer: only allow swipe left (negative deltaX)
        const isValidSwipe = side === "right" ? deltaX > 10 : deltaX < -10;
        if (isValidSwipe) {
          setIsDragging(true);
        }
      }

      if (isVerticalScroll) return;

      if (isDragging) {
        setTouchCurrentX(touch.clientX);
      }
    },
    [touchStartX, touchStartY, isDragging, isVerticalScroll, side]
  );

  const handleTouchEnd = useCallback(() => {
    if (touchStartX !== null && touchCurrentX !== null && isDragging) {
      const deltaX = touchCurrentX - touchStartX;
      // For right-side drawer: close on swipe right
      // For left-side drawer: close on swipe left
      const shouldClose = side === "right" ? deltaX > SWIPE_THRESHOLD : deltaX < -SWIPE_THRESHOLD;

      if (shouldClose) {
        onClose();
      }
    }

    // Reset state
    setTouchStartX(null);
    setTouchStartY(null);
    setTouchCurrentX(null);
    setIsDragging(false);
    setIsVerticalScroll(false);
  }, [touchStartX, touchCurrentX, isDragging, side, onClose]);

  // Calculate swipe offset for visual feedback
  const getSwipeOffset = () => {
    if (!isDragging || touchStartX === null || touchCurrentX === null) return 0;
    const delta = touchCurrentX - touchStartX;
    // For right-side drawer: only positive offset (swipe right)
    // For left-side drawer: only negative offset (swipe left)
    if (side === "right") {
      return Math.max(0, delta);
    } else {
      return Math.min(0, delta);
    }
  };

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Handle outside click
  const handleOverlayClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (closeOnOutsideClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOutsideClick, onClose]
  );

  // Lock body scroll and handle focus
  useEffect(() => {
    if (open) {
      // Store currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Lock body scroll
      document.body.style.overflow = "hidden";

      // Focus first focusable element in drawer
      const focusableElements = drawerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements && focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }

      // Add escape key listener
      document.addEventListener("keydown", handleKeyDown);
    } else {
      // Restore body scroll
      document.body.style.overflow = "";

      // Restore focus to previous element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  // Don't render if not open
  if (!open) return null;

  const drawer = (
    <div
      className={cn(
        "fixed inset-0 z-50",
        "flex",
        side === "right" ? "justify-end" : "justify-start"
      )}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "drawer-title" : undefined}
    >
      {/* Overlay - clickable to close */}
      <div
        className={cn("absolute inset-0", "bg-black/50 backdrop-blur-sm", "animate-fade-in-up")}
        style={{ animationDuration: "0.2s" }}
        onClick={closeOnOutsideClick ? onClose : undefined}
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "relative z-10",
          "w-[85vw] max-w-sm h-full",
          "bg-[var(--color-bg-primary)]",
          "border-l border-[var(--border-default)]",
          side === "right" && "border-l",
          side === "left" && "border-r",
          "shadow-xl",
          !isDragging && "animate-slide-in-right"
        )}
        style={{
          animationDuration: "0.3s",
          transform: isDragging ? `translateX(${getSwipeOffset()}px)` : undefined,
          transition: isDragging ? "none" : "transform 0.3s ease-out",
        }}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between",
            "h-14 px-4",
            "border-b border-[var(--border-default)]"
          )}
        >
          {title && (
            <h2
              id="drawer-title"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              {title}
            </h2>
          )}

          {showCloseButton && (
            <button
              onClick={onClose}
              className={cn(
                "p-2 -mr-2",
                "rounded-lg",
                "text-[var(--color-text-muted)]",
                "hover:text-[var(--color-text-primary)]",
                "hover:bg-[var(--glass-bg)]",
                "transition-colors duration-200",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
              )}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );

  // Render portal
  if (typeof window === "undefined") return null;
  return createPortal(drawer, document.body);
}

export default MobileDrawer;
