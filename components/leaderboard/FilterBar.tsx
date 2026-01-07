'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { LeaderboardFilters } from './LeaderboardTable';

interface FilterBarProps {
  filters: LeaderboardFilters;
  onFilterChange: (filters: Partial<LeaderboardFilters>) => void;
  loading?: boolean;
}

// 국가 코드를 국기 이모지로 변환
function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode === 'all') return '🌐';
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return '🌐';
  const codePoints = code.split('').map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

const COUNTRY_OPTIONS = [
  { value: 'all', label: 'Global', flag: '🌐' },
  { value: 'KR', label: 'South Korea', flag: getCountryFlag('KR') },
  { value: 'US', label: 'United States', flag: getCountryFlag('US') },
  { value: 'JP', label: 'Japan', flag: getCountryFlag('JP') },
  { value: 'CN', label: 'China', flag: getCountryFlag('CN') },
  { value: 'DE', label: 'Germany', flag: getCountryFlag('DE') },
  { value: 'GB', label: 'United Kingdom', flag: getCountryFlag('GB') },
  { value: 'FR', label: 'France', flag: getCountryFlag('FR') },
  { value: 'CA', label: 'Canada', flag: getCountryFlag('CA') },
  { value: 'AU', label: 'Australia', flag: getCountryFlag('AU') },
  { value: 'IN', label: 'India', flag: getCountryFlag('IN') },
  { value: 'BR', label: 'Brazil', flag: getCountryFlag('BR') },
  { value: 'SG', label: 'Singapore', flag: getCountryFlag('SG') },
];

const TIER_OPTIONS = [
  { value: 'all', label: 'All Tiers' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'team', label: 'Team' },
  { value: 'pro', label: 'Pro' },
  { value: 'free', label: 'Free' },
];

const TIMEFRAME_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
  { value: 'day', label: 'Today' },
];

interface DropdownProps {
  value: string;
  options: { value: string; label: string; flag?: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  showFlags?: boolean;
}

function Dropdown({ value, options, onChange, placeholder, showFlags }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption?.label || placeholder || 'Select';
  const displayFlag = showFlags && selectedOption?.flag;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg text-sm transition-all duration-200 border border-white/10 hover:border-white/20"
        style={{ backgroundColor: '#18181B' }}
      >
        {displayFlag && <span className="text-base leading-none">{displayFlag}</span>}
        <span className="text-zinc-200">{displayLabel}</span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 min-w-[200px] rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50"
          style={{ backgroundColor: '#18181B' }}
        >
          <div className="py-2 max-h-[320px] overflow-y-auto">
            {options.map((option, index) => {
              const isSelected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors duration-150
                    ${isSelected
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                    }
                    ${index === 0 ? 'rounded-t-lg' : ''}
                    ${index === options.length - 1 ? 'rounded-b-lg' : ''}
                  `}
                >
                  {showFlags && option.flag && (
                    <span className="text-lg leading-none w-6 text-center">{option.flag}</span>
                  )}
                  <span className="flex-1">{option.label}</span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterBar({ filters, onFilterChange, loading }: FilterBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    onFilterChange({ search: searchValue });
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchValue(e.target.value);
    if (e.target.value === '') {
      onFilterChange({ search: '' });
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchValue}
          onChange={handleSearchChange}
          className="w-full h-9 pl-9 pr-4 rounded-lg text-sm border border-white/10 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
          style={{ backgroundColor: '#18181B' }}
        />
      </form>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {/* Country Filter */}
        <Dropdown
          value={filters.country}
          options={COUNTRY_OPTIONS}
          onChange={(value) => onFilterChange({ country: value })}
          showFlags
        />

        {/* Tier Filter */}
        <Dropdown
          value={filters.tier}
          options={TIER_OPTIONS}
          onChange={(value) => onFilterChange({ tier: value })}
        />

        {/* Timeframe Filter */}
        <Dropdown
          value={filters.timeframe}
          options={TIMEFRAME_OPTIONS}
          onChange={(value) => onFilterChange({ timeframe: value as LeaderboardFilters['timeframe'] })}
        />

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center px-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

export default FilterBar;
