"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "ph-badge-dismissed-v3";

export function ProductHuntBadge() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

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

  if (isDismissed) return null;

  return (
    <div
      className={`fixed bottom-6 left-6 z-10 hidden lg:block transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="relative group">
        <button
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 z-10"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>

        <a
          href="https://www.producthunt.com/products/ccgather?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-ccgather"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1071381&theme=light&t=1770059953257"
            alt="CCgather - Document your Claude Code journey | Product Hunt"
            width="140"
            height="30"
            className="hover:opacity-90 transition-opacity"
          />
        </a>
      </div>
    </div>
  );
}
