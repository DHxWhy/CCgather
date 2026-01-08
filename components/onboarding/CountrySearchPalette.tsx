"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Command, X, Globe2 } from "lucide-react";
import { type Country } from "@/lib/constants/countries";
import { FlagIcon } from "@/components/ui/FlagIcon";

interface CountrySearchPaletteProps {
  countries: Country[];
  selectedCountry: string;
  onSelectCountry: (code: string) => void;
}

export function CountrySearchPalette({
  countries,
  selectedCountry,
  onSelectCountry,
}: CountrySearchPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredCountries = useMemo(() => {
    if (!query.trim()) return countries; // Show all countries when no search
    const q = query.toLowerCase();
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countries, query]);

  const displayList = filteredCountries;

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, displayList.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && displayList[highlightedIndex]) {
        e.preventDefault();
        onSelectCountry(displayList[highlightedIndex].code);
        setIsOpen(false);
        setQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, highlightedIndex, displayList, onSelectCountry]);

  // Reset highlight when list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll("[data-country-item]");
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const selectedCountryData = countries.find((c) => c.code === selectedCountry);

  return (
    <>
      {/* Trigger Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-primary/30 hover:bg-white/[0.05] transition-all group"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Search className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" />
        <span className="flex-1 text-left text-text-muted">
          {selectedCountryData
            ? `${selectedCountryData.flag} ${selectedCountryData.name}`
            : "Search for your country..."}
        </span>
        <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.1] text-xs text-text-muted">
          <Command className="w-3 h-3" />K
        </kbd>
      </motion.button>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setIsOpen(false);
                setQuery("");
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Palette */}
            <motion.div
              className="relative w-full max-w-lg bg-bg-primary border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Header */}
              <div className="relative border-b border-white/[0.08]">
                <div className="flex items-center px-4">
                  <Search className="w-5 h-5 text-text-muted" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search countries..."
                    className="flex-1 px-3 py-4 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-primary transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Category hint */}
                <div className="px-4 pb-2 flex items-center gap-2">
                  <Globe2 className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-xs text-text-muted">
                    {filteredCountries.length} {query ? "result" : "countrie"}
                    {filteredCountries.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
                {displayList.length > 0 ? (
                  displayList.map((country, index) => (
                    <motion.button
                      key={country.code}
                      data-country-item
                      onClick={() => {
                        onSelectCountry(country.code);
                        setIsOpen(false);
                        setQuery("");
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                        transition-colors
                        ${
                          highlightedIndex === index
                            ? "bg-primary/10 text-text-primary"
                            : selectedCountry === country.code
                              ? "bg-white/[0.05] text-text-primary"
                              : "text-text-secondary hover:bg-white/[0.03]"
                        }
                      `}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <FlagIcon countryCode={country.code} size="sm" />
                      <span className="flex-1">{country.name}</span>
                      {selectedCountry === country.code && (
                        <span className="text-xs text-primary font-medium px-2 py-0.5 rounded-full bg-primary/10">
                          Selected
                        </span>
                      )}
                    </motion.button>
                  ))
                ) : query ? (
                  <div className="py-12 text-center">
                    <Globe2 className="w-10 h-10 mx-auto mb-3 text-text-muted/50" />
                    <p className="text-text-muted text-sm">No countries found</p>
                    <p className="text-text-muted/70 text-xs mt-1">Try a different search term</p>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
