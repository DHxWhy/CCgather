'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export interface ToastProps {
  id: string;
  type?: 'success' | 'error' | 'info' | 'levelup';
  title: string;
  message?: string;
  icon?: React.ReactNode;
  duration?: number;
  onClose: (id: string) => void;
}

export function Toast({
  id,
  type = 'info',
  title,
  message,
  icon,
  duration = 5000,
  onClose,
}: ToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration <= 0) return;

    // Progress animation
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    // Auto dismiss
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onClose(id), 300);
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [duration, id, onClose]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onClose(id), 300);
  };

  const typeStyles = {
    success: 'border-green-500/30 bg-green-500/10',
    error: 'border-red-500/30 bg-red-500/10',
    info: 'border-blue-500/30 bg-blue-500/10',
    levelup: 'border-[var(--color-claude-coral)]/50 bg-gradient-to-r from-[var(--color-claude-coral)]/20 to-[#F7931E]/20',
  };

  const progressColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    levelup: 'bg-gradient-to-r from-[var(--color-claude-coral)] to-[#F7931E]',
  };

  return (
    <div
      className={`relative w-80 rounded-lg border shadow-xl backdrop-blur-sm overflow-hidden transition-all duration-300 ${
        typeStyles[type]
      } ${isLeaving ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div
          className={`h-full transition-all duration-100 ${progressColors[type]}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          {icon && (
            <div className="flex-shrink-0 text-2xl">
              {icon}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {title}
            </h4>
            {message && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {message}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Toast;
