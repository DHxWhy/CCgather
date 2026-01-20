"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCursor } from "./CursorContext";
import "@/styles/cursor.css";
// Note: This imports from /styles/cursor.css (not /src/styles/)

// ============================================
// Types
// ============================================

interface CustomCursorProps {
  enableTrail?: boolean;
  trailCount?: number;
}

// ============================================
// Component - Synk Style Cursor
// ============================================

export function CustomCursor({ enableTrail = false, trailCount = 5 }: CustomCursorProps) {
  const {
    state,
    setCursorPosition,
    setCursorVisible,
    setCursorClicking,
    setCursorType,
    isMouseDevice,
  } = useCursor();

  const cursorRef = useRef<HTMLDivElement>(null);
  const trailsRef = useRef<HTMLDivElement[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const positionRef = useRef({ x: 0, y: 0 });

  // Add class to html element
  useEffect(() => {
    if (isMouseDevice) {
      document.documentElement.classList.add("has-custom-cursor");
    }
    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, [isMouseDevice]);

  // Smooth cursor movement using RAF
  const updateCursorPosition = useCallback(() => {
    if (cursorRef.current) {
      const { x, y } = positionRef.current;
      cursorRef.current.style.left = `${x}px`;
      cursorRef.current.style.top = `${y}px`;
    }
  }, []);

  // Check if element is interactive - optimized (no getComputedStyle, limited recursion)
  const getElementType = useCallback(
    (element: Element | null, depth = 0): "default" | "pointer" | "text" => {
      if (!element || depth > 3) return "default"; // Limit recursion depth

      const tagName = element.tagName.toLowerCase();

      // Text inputs
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        (element as HTMLElement).isContentEditable
      ) {
        const inputType = (element as HTMLInputElement).type;
        if (
          !inputType ||
          ["text", "email", "password", "search", "tel", "url", "number"].includes(inputType)
        ) {
          return "text";
        }
      }

      // Interactive elements - fast checks only (no getComputedStyle)
      if (
        tagName === "a" ||
        tagName === "button" ||
        tagName === "select" ||
        tagName === "label" ||
        element.closest("a") ||
        element.closest("button") ||
        element.getAttribute("role") === "button" ||
        element.classList.contains("cursor-pointer")
      ) {
        return "pointer";
      }

      // Check parent elements (limited depth)
      const parent = element.parentElement;
      if (parent && parent !== document.body) {
        return getElementType(parent, depth + 1);
      }

      return "default";
    },
    []
  );

  // Throttled element detection (every 100ms instead of every frame)
  const lastElementCheckRef = useRef(0);
  const lastCursorTypeRef = useRef<"default" | "pointer" | "text">("default");

  // Handle mouse move - optimized with throttled element detection
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      positionRef.current = { x: e.clientX, y: e.clientY };

      // Throttle element detection to every 100ms for performance
      const now = Date.now();
      if (now - lastElementCheckRef.current > 100) {
        lastElementCheckRef.current = now;
        const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
        const cursorType = getElementType(elementUnderCursor);
        if (cursorType !== lastCursorTypeRef.current) {
          lastCursorTypeRef.current = cursorType;
          setCursorType(cursorType);
        }
      }

      // Use RAF for smooth cursor position update
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateCursorPosition);
    },
    [setCursorType, updateCursorPosition, getElementType]
  );

  // Handle mouse enter/leave viewport
  const handleMouseEnter = useCallback(() => {
    setCursorVisible(true);
  }, [setCursorVisible]);

  const handleMouseLeave = useCallback(() => {
    setCursorVisible(false);
  }, [setCursorVisible]);

  // Handle mouse down/up
  const handleMouseDown = useCallback(() => {
    setCursorClicking(true);
  }, [setCursorClicking]);

  const handleMouseUp = useCallback(() => {
    setCursorClicking(false);
  }, [setCursorClicking]);

  // Set up event listeners
  useEffect(() => {
    if (!isMouseDevice) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    isMouseDevice,
    handleMouseMove,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseDown,
    handleMouseUp,
  ]);

  // Don't render on touch devices
  if (!isMouseDevice) {
    return null;
  }

  // Determine cursor class based on state
  const getCursorClass = () => {
    const classes = ["cursor-main"];

    if (state.isClicking) {
      classes.push("click");
    } else if (state.type !== "default") {
      classes.push(state.type);
    }

    if (!state.isVisible) {
      classes.push("hidden");
    }

    return classes.join(" ");
  };

  return (
    <div className="cursor-wrapper" aria-hidden="true">
      {/* Main cursor - Synk style white circle with icon */}
      <div ref={cursorRef} className={getCursorClass()} />

      {/* Trail effect (optional) */}
      {enableTrail &&
        Array.from({ length: trailCount }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              if (el) trailsRef.current[i] = el;
            }}
            className="cursor-trail"
            style={{
              animationDelay: `${i * 0.05}s`,
              opacity: 0,
            }}
          />
        ))}
    </div>
  );
}

export default CustomCursor;
