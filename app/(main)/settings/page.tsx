'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { ALL_COUNTRIES } from '@/lib/constants/countries';

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [selectedCountry, setSelectedCountry] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const filteredCountries = searchQuery
    ? ALL_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ALL_COUNTRIES;

  const handleUpdateProfile = async () => {
    if (!selectedCountry) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_code: selectedCountry,
        }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-white/10 rounded w-1/3" />
          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="h-20 bg-white/5 rounded-xl" />
            <div className="h-12 bg-white/5 rounded-xl" />
            <div className="h-12 bg-white/5 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-3">
          Account
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] mb-2">
          Settings
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Manage your profile and preferences
        </p>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400">
          ✓ Profile updated successfully!
        </div>
      )}

      {/* Profile Section */}
      <section className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
          Profile
        </h2>

        <div className="flex items-center gap-4 mb-6 p-4 bg-white/5 rounded-xl">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt="Profile"
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-[#F7931E]" />
          )}
          <div>
            <div className="font-medium text-text-primary">
              {user?.fullName || user?.username || 'Anonymous'}
            </div>
            <div className="text-sm text-text-muted">
              @{user?.username || 'user'}
            </div>
          </div>
        </div>

        {/* Country Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Country
          </label>
          <input
            type="text"
            placeholder="Search country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredCountries.slice(0, 10).map((country) => (
              <button
                key={country.code}
                onClick={() => {
                  setSelectedCountry(country.code);
                  setSearchQuery('');
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left transition-colors ${
                  selectedCountry === country.code
                    ? 'bg-primary/20 text-text-primary'
                    : 'hover:bg-white/5 text-text-secondary'
                }`}
              >
                <span>{country.flag}</span>
                <span>{country.name}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleUpdateProfile}
          disabled={!selectedCountry || isUpdating}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-[#F7931E] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {isUpdating ? 'Updating...' : 'Update Profile'}
        </button>
      </section>

      {/* CLI Token Section */}
      <section className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
          CLI Connection
        </h2>
        <p className="text-text-secondary mb-4">
          Connect your local Claude Code CLI to automatically sync your usage
          stats.
        </p>
        <div className="p-4 bg-white/5 rounded-xl font-mono text-sm text-text-muted mb-4">
          npx ccgather-cli setup
        </div>
        <button className="px-6 py-3 rounded-xl bg-white/10 text-text-primary hover:bg-white/20 transition-colors">
          Generate New Token
        </button>
      </section>

      {/* Danger Zone */}
      <section className="glass rounded-2xl p-6 border border-red-500/20">
        <h2 className="text-base font-semibold text-red-400 mb-4">Danger Zone</h2>
        <p className="text-text-secondary mb-4">
          These actions are irreversible. Please proceed with caution.
        </p>
        <div className="flex flex-wrap gap-4">
          <button className="px-6 py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
            Reset Stats
          </button>
          <button className="px-6 py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
            Delete Account
          </button>
        </div>
      </section>
    </div>
  );
}
