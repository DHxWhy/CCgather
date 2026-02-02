"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const PRODUCT_HUNT_URL = "https://www.producthunt.com/posts/ccgather";
const STORAGE_KEY = "ph-badge-dismissed";

export function ProductHuntBadge() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Show after a short delay for better UX
    const timer = setTimeout(() => setIsVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
    setIsDismissed(true);
  };

  // Don't render on mobile or if dismissed
  if (isDismissed) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-10 hidden lg:block transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <a
        href={PRODUCT_HUNT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
      >
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>

        {/* Product Hunt Logo */}
        <div className="w-10 h-10 rounded-lg bg-[#FF6154] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 40 40" className="w-6 h-6 text-white" fill="currentColor">
            <path d="M22.667 20H17.333V13.333H22.667C24.507 13.333 26 14.827 26 16.667C26 18.507 24.507 20 22.667 20ZM22.667 10H14V30H17.333V23.333H22.667C26.347 23.333 29.333 20.347 29.333 16.667C29.333 12.987 26.347 10 22.667 10Z" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 font-medium">FEATURED ON</span>
          <span className="text-sm font-bold text-gray-900">Product Hunt</span>
        </div>

        {/* Vote arrow */}
        <div className="flex flex-col items-center ml-2 pl-3 border-l border-gray-200">
          <svg
            className="w-4 h-4 text-[#FF6154] group-hover:-translate-y-0.5 transition-transform"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 4l-8 8h6v8h4v-8h6z" />
          </svg>
          <span className="text-xs font-bold text-gray-700">VOTE</span>
        </div>
      </a>
    </div>
  );
}
