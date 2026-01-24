"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface PeriodOption {
  value: string;
  label: string;
}

interface PeriodDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: PeriodOption[];
  customLabel?: string;
}

export function PeriodDropdown({ value, onChange, options, customLabel }: PeriodDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const currentOption = options.find((opt) => opt.value === value);
  const displayLabel =
    value === "custom" && customLabel ? customLabel : currentOption?.label || "Select";

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-0.5 px-2 pr-1.5 glass rounded-lg text-[11px] leading-none font-medium transition-all cursor-pointer ${
          isOpen
            ? "ring-1 ring-[var(--color-claude-coral)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-primary)] hover:bg-white/10"
        }`}
        style={{ height: 34 }}
      >
        <span>{displayLabel}</span>
        <ChevronDown
          className={`w-3 h-3 text-[var(--color-text-muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 mt-1 z-50 min-w-[60px] py-0.5 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl overflow-hidden"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors ${
                  value === option.value
                    ? "bg-[var(--color-claude-coral)]/20 text-[var(--color-claude-coral)]"
                    : "text-[var(--color-text-secondary)] hover:bg-white/10 hover:text-[var(--color-text-primary)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
