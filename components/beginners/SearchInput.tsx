"use client";

import { useState, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface SearchInputProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
}

export default function SearchInput({
  placeholder = "Search commands, flags, features...",
  onSearch,
  isLoading,
}: SearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") || "");

  const handleSearch = useCallback(
    (query: string) => {
      if (onSearch) {
        onSearch(query);
      } else {
        // Default behavior: update URL params
        const params = new URLSearchParams(searchParams.toString());
        if (query) {
          params.set("q", query);
        } else {
          params.delete("q");
        }
        router.push(`?${params.toString()}`);
      }
    },
    [onSearch, router, searchParams]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(value);
  };

  const handleClear = () => {
    setValue("");
    handleSearch("");
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-text-muted" />
          )}
        </div>

        {/* Input */}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-10 py-3 rounded-xl border border-white/10 bg-white/[0.02] text-[var(--color-text-primary)] placeholder-text-muted focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.04] transition-all"
        />

        {/* Clear Button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        )}
      </div>

      {/* Search hint */}
      <p className="mt-2 text-xs text-text-muted text-center">
        Try: <code className="px-1 bg-white/5 rounded">--resume</code>,{" "}
        <code className="px-1 bg-white/5 rounded">.claudeignore</code>, or{" "}
        <code className="px-1 bg-white/5 rounded">MCP</code>
      </p>
    </form>
  );
}
