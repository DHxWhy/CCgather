'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCursor } from './CursorContext';
import '@/styles/cursor.css';
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

export function CustomCursor({
  enableTrail = false,
  trailCount = 5,
}: CustomCursorProps) {
  const { state, setCursorPosition, setCursorVisible, setCursorClicking, setCursorType, isMouseDevice } =
    useCursor();

  const cursorRef = useRef<HTMLDivElement>(null);
  const trailsRef = useRef<HTMLDivElement[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const positionRef = useRef({ x: 0, y: 0 });

  // Add class to html element
  useEffect(() => {
    if (isMouseDevice) {
      document.documentElement.classList.add('has-custom-cursor');
    }
    return () => {
      document.documentElement.classList.remove('has-custom-cursor');
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

  // Check if element is interactive
  const getElementType = useCallback((element: Element | null): 'default' | 'pointer' | 'text' => {
    if (!element) return 'default';

    const tagName = element.tagName.toLowerCase();

    // Text inputs
    if (
      tagName === 'input' ||
      tagName === 'textarea' ||
      (element as HTMLElement).isContentEditable
    ) {
      const inputType = (element as HTMLInputElement).type;
      if (!inputType || ['text', 'email', 'password', 'search', 'tel', 'url', 'number'].includes(inputType)) {
        return 'text';
      }
    }

    // Interactive elements
    if (
      tagName === 'a' ||
      tagName === 'button' ||
      tagName === 'select' ||
      tagName === 'label' ||
      element.closest('a') ||
      element.closest('button') ||
      (element as HTMLElement).onclick ||
      element.getAttribute('role') === 'button' ||
      element.classList.contains('cursor-pointer') ||
      window.getComputedStyle(element).cursor === 'pointer'
    ) {
      return 'pointer';
    }

    // Check parent elements
    const parent = element.parentElement;
    if (parent && parent !== document.body) {
      return getElementType(parent);
    }

    return 'default';
  }, []);

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      positionRef.current = { x: e.clientX, y: e.clientY };
      setCursorPosition({ x: e.clientX, y: e.clientY });

      // Detect element under cursor
      const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
      const cursorType = getElementType(elementUnderCursor);
      setCursorType(cursorType);

      // Use RAF for smooth animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateCursorPosition);
    },
    [setCursorPosition, setCursorType, updateCursorPosition, getElementType]
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

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);

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
    const classes = ['cursor-main'];

    if (state.isClicking) {
      classes.push('click');
    } else if (state.type !== 'default') {
      classes.push(state.type);
    }

    if (!state.isVisible) {
      classes.push('hidden');
    }

    return classes.join(' ');
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
