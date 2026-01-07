'use client';

import { useEffect, useState, useCallback } from 'react';
import { Monitor, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

type TTheme = 'system' | 'light' | 'dark';

interface ThemeSwitcherProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ThemeSwitcher({ className, size = 'md' }: ThemeSwitcherProps) {
  const [theme, setTheme] = useState<TTheme>('system');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') as TTheme | null;
    if (stored && ['system', 'light', 'dark'].includes(stored)) {
      setTheme(stored);
    }
  }, []);

  // Apply theme changes (Default is dark, 'light' class for light mode)
  const applyTheme = useCallback((newTheme: TTheme) => {
    const root = document.documentElement;

    if (newTheme === 'system') {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      root.classList.toggle('light', prefersLight);
    } else {
      root.classList.toggle('light', newTheme === 'light');
    }
  }, []);

  // Handle theme change
  useEffect(() => {
    if (!mounted) return;

    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, [theme, mounted, applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted, applyTheme]);

  // Size variants
  const sizes = {
    sm: {
      container: '',
      button: 'w-5 h-5',
      icon: 12,
    },
    md: {
      container: '',
      button: 'w-6 h-6',
      icon: 14,
    },
  };

  const currentSize = sizes[size];

  const options: { value: TTheme; icon: React.ReactNode; label: string }[] = [
    {
      value: 'system',
      icon: <Monitor size={currentSize.icon} />,
      label: 'System theme',
    },
    {
      value: 'light',
      icon: <Sun size={currentSize.icon} />,
      label: 'Light mode',
    },
    {
      value: 'dark',
      icon: <Moon size={currentSize.icon} />,
      label: 'Dark mode',
    },
  ];

  // Prevent hydration mismatch with skeleton
  if (!mounted) {
    return (
      <div
        className={cn(
          'flex p-1 rounded-full gap-0.5 border border-[var(--border-default)] bg-transparent',
          currentSize.container,
          className
        )}
      >
        {options.map((option) => (
          <div key={option.value} className={cn(currentSize.button, 'rounded-full')} />
        ))}
      </div>
    );
  }

  return (
    <fieldset
      className={cn(
        'relative flex p-1 m-0 rounded-full gap-0.5',
        'border border-[var(--border-default)]',
        'bg-transparent',
        currentSize.container,
        className
      )}
    >
      <legend className="sr-only">Theme selection:</legend>

      {/* Sliding background indicator */}
      <div
        className={cn(
          'absolute top-1 rounded-full',
          'bg-[var(--color-claude-coral)]',
          'shadow-md shadow-[var(--color-claude-coral)]/30',
          'transition-all duration-300 ease-out',
          currentSize.button
        )}
        style={{
          left: `calc(${options.findIndex(o => o.value === theme) * (size === 'sm' ? 22 : 26)}px + 4px)`,
        }}
      />

      {options.map((option) => (
        <div key={option.value} className="relative z-10">
          <input
            aria-label={option.label}
            id={`theme-switch-${option.value}`}
            type="radio"
            name="theme"
            value={option.value}
            checked={theme === option.value}
            onChange={() => setTheme(option.value)}
            className="sr-only peer"
          />
          <label
            htmlFor={`theme-switch-${option.value}`}
            title={option.label}
            className={cn(
              'flex items-center justify-center cursor-pointer rounded-full',
              'transition-colors duration-300',
              currentSize.button,
              // Default state
              'text-[var(--color-text-muted)]',
              // Hover state
              'hover:text-[var(--color-text-secondary)]',
              // Selected state
              'peer-checked:text-white',
              // Focus state
              'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-claude-coral)] peer-focus-visible:ring-offset-1'
            )}
          >
            <span className="sr-only">{option.label}</span>
            {option.icon}
          </label>
        </div>
      ))}
    </fieldset>
  );
}

export default ThemeSwitcher;
