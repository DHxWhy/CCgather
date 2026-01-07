'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ALL_COUNTRIES, TOP_COUNTRIES, type Country } from '@/lib/constants/countries';

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCountries = searchQuery
    ? ALL_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ALL_COUNTRIES;

  const handleSubmit = async () => {
    if (!selectedCountry) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_code: selectedCountry,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          onboarding_completed: true,
        }),
      });

      if (response.ok) {
        router.push('/leaderboard');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-5xl mb-4 block">🌐</span>
          <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-3">
            Getting Started
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] mb-2">
            Welcome to CCgather!
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Let&apos;s set up your profile. Where are you from?
          </p>
        </div>

        <div className="glass rounded-2xl p-6">
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Top Countries */}
          {!searchQuery && (
            <div className="mb-4">
              <div className="text-sm text-text-muted mb-2">Popular</div>
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
          <div className="max-h-60 overflow-y-auto">
            <div className="text-sm text-text-muted mb-2">
              {searchQuery ? 'Results' : 'All Countries'}
            </div>
            <div className="space-y-1">
              {filteredCountries.map((country) => (
                <CountryButton
                  key={country.code}
                  country={country}
                  selected={selectedCountry === country.code}
                  onClick={() => setSelectedCountry(country.code)}
                  compact
                />
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!selectedCountry || isSubmitting}
            className="w-full mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-[#F7931E] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {isSubmitting ? 'Setting up...' : 'Continue'}
          </button>
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
        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors
        ${
          selected
            ? 'bg-primary/20 border-primary text-text-primary'
            : 'bg-white/5 border-transparent text-text-secondary hover:bg-white/10 hover:text-text-primary'
        }
        border
        ${compact ? 'py-2' : ''}
      `}
    >
      <span className="text-xl">{country.flag}</span>
      <span className="font-medium">{country.name}</span>
    </button>
  );
}
