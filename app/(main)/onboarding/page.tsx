"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ALL_COUNTRIES, TOP_COUNTRIES, type Country } from "@/lib/constants/countries";

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return ALL_COUNTRIES;
    const q = searchQuery.toLowerCase();
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const selectedCountryData = useMemo(() => {
    return ALL_COUNTRIES.find((c) => c.code === selectedCountry);
  }, [selectedCountry]);

  const handleSubmit = async () => {
    if (!selectedCountry) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country_code: selectedCountry,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          onboarding_completed: true,
        }),
      });

      if (response.ok) {
        router.push("/leaderboard");
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl mb-4 block">🌐</span>
          <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-3">
            Getting Started
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] mb-2">
            Welcome to CCgather!
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Select your country to continue. This helps us show you in the right leaderboard.
          </p>
        </div>

        <div className="glass rounded-2xl p-6">
          {/* Selected Country Display */}
          {selectedCountryData && (
            <div className="mb-4 p-4 bg-primary/10 border border-primary/30 rounded-xl flex items-center gap-3">
              <span className="text-3xl">{selectedCountryData.flag}</span>
              <div>
                <div className="text-sm text-text-muted">Selected</div>
                <div className="font-medium text-text-primary">{selectedCountryData.name}</div>
              </div>
              <button
                onClick={() => setSelectedCountry("")}
                className="ml-auto text-text-muted hover:text-text-primary transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by country name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Top Countries - Only show when not searching */}
          {!searchQuery && (
            <div className="mb-4">
              <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Popular Countries
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TOP_COUNTRIES.map((country) => (
                  <CountryButton
                    key={country.code}
                    country={country}
                    selected={selectedCountry === country.code}
                    onClick={() => setSelectedCountry(country.code)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Countries */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {searchQuery
                  ? `Search Results (${filteredCountries.length})`
                  : `All Countries (${ALL_COUNTRIES.length})`}
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country) => (
                  <CountryButton
                    key={country.code}
                    country={country}
                    selected={selectedCountry === country.code}
                    onClick={() => {
                      setSelectedCountry(country.code);
                      setSearchQuery("");
                    }}
                    compact
                  />
                ))
              ) : (
                <div className="text-center py-8 text-text-muted">
                  <span className="text-2xl block mb-2">🔍</span>
                  No countries found for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!selectedCountry || isSubmitting}
            className="w-full mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-[#F7931E] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Setting up...
              </>
            ) : (
              "Continue"
            )}
          </button>

          {/* Skip hint */}
          <p className="text-xs text-text-muted text-center mt-4">
            You can change your country later in Settings
          </p>
        </div>
      </div>
    </div>
  );
}

function CountryButton({
  country,
  selected,
  onClick,
  compact = false,
}: {
  country: Country;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 rounded-xl text-left transition-all duration-150
        ${compact ? "py-2.5" : "py-3"}
        ${
          selected
            ? "bg-primary/20 border-primary text-text-primary ring-1 ring-primary/50"
            : "bg-white/5 border-transparent text-text-secondary hover:bg-white/10 hover:text-text-primary"
        }
        border
      `}
    >
      <span className={compact ? "text-lg" : "text-xl"}>{country.flag}</span>
      <span className="font-medium flex-1 truncate">{country.name}</span>
      {selected && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-primary flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}
