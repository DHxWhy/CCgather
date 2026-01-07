'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

// ============================================
// Types
// ============================================

export type CursorType = 'default' | 'pointer' | 'text' | 'loading' | 'drag';

export interface CursorPosition {
  x: number;
  y: number;
}

export interface CursorState {
  type: CursorType;
  position: CursorPosition;
  isVisible: boolean;
  isClicking: boolean;
  scale: number;
  opacity: number;
}

export interface CursorContextValue {
  state: CursorState;
  setCursorType: (type: CursorType) => void;
  setCursorPosition: (position: CursorPosition) => void;
  setCursorVisible: (visible: boolean) => void;
  setCursorClicking: (clicking: boolean) => void;
  isMouseDevice: boolean;
}

// ============================================
// Context
// ============================================

const CursorContext = createContext<CursorContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface CursorProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

export function CursorProvider({ children, enabled = true }: CursorProviderProps) {
  // Check if device supports hover (mouse device)
  const [isMouseDevice, setIsMouseDevice] = useState(false);

  // Cursor state
  const [state, setState] = useState<CursorState>({
    type: 'default',
    position: { x: 0, y: 0 },
    isVisible: false,
    isClicking: false,
    scale: 1,
    opacity: 1,
  });

  // Detect mouse device
  useEffect(() => {
    const checkMouseDevice = () => {
      const hasHover = window.matchMedia('(hover: hover)').matches;
      const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
      setIsMouseDevice(hasHover && hasFinePointer);
    };

    checkMouseDevice();
    window.addEventListener('resize', checkMouseDevice);

    return () => window.removeEventListener('resize', checkMouseDevice);
  }, []);

  // Toggle custom cursor class on body
  useEffect(() => {
    if (enabled && isMouseDevice) {
      document.body.classList.add('custom-cursor-active');
    } else {
      document.body.classList.remove('custom-cursor-active');
    }

    return () => {
      document.body.classList.remove('custom-cursor-active');
    };
  }, [enabled, isMouseDevice]);

  // Cursor state setters
  const setCursorType = useCallback((type: CursorType) => {
    setState((prev) => ({
      ...prev,
      type,
      scale: type === 'pointer' ? 1.5 : type === 'text' ? 0.8 : 1,
    }));
  }, []);

  const setCursorPosition = useCallback((position: CursorPosition) => {
    setState((prev) => ({
      ...prev,
      position,
      isVisible: true,
    }));
  }, []);

  const setCursorVisible = useCallback((isVisible: boolean) => {
    setState((prev) => ({ ...prev, isVisible }));
  }, []);

  const setCursorClicking = useCallback((isClicking: boolean) => {
    setState((prev) => ({ ...prev, isClicking }));
  }, []);

  const value: CursorContextValue = {
    state,
    setCursorType,
    setCursorPosition,
    setCursorVisible,
    setCursorClicking,
    isMouseDevice,
  };

  return (
    <CursorContext.Provider value={value}>{children}</CursorContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useCursor(): CursorContextValue {
  const context = useContext(CursorContext);

  if (!context) {
    throw new Error('useCursor must be used within a CursorProvider');
  }

  return context;
}

// ============================================
// Utility Hook: Cursor Hover Effect
// ============================================

interface UseCursorHoverOptions {
  type?: CursorType;
  disabled?: boolean;
}

export function useCursorHover(options: UseCursorHoverOptions = {}) {
  const { type = 'pointer', disabled = false } = options;
  const { setCursorType, isMouseDevice } = useCursor();

  const handleMouseEnter = useCallback(() => {
    if (!disabled && isMouseDevice) {
      setCursorType(type);
    }
  }, [disabled, isMouseDevice, setCursorType, type]);

  const handleMouseLeave = useCallback(() => {
    if (!disabled && isMouseDevice) {
      setCursorType('default');
    }
  }, [disabled, isMouseDevice, setCursorType]);

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
}

export default CursorContext;
