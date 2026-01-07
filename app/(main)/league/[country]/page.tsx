import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ALL_COUNTRIES } from '@/lib/constants/countries';

interface LeaguePageProps {
  params: Promise<{ country: string }>;
}

export async function generateMetadata({ params }: LeaguePageProps) {
  const { country } = await params;
  const countryData = ALL_COUNTRIES.find(
    (c) => c.code.toLowerCase() === country.toLowerCase()
  );

  if (!countryData) {
    return { title: 'Country Not Found' };
  }

  return {
    title: `${countryData.flag} ${countryData.name} League`,
    description: `Leaderboard for Claude Code developers in ${countryData.name}.`,
  };
}

function LeagueSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-16 bg-white/5 rounded-xl" />
      ))}
    </div>
  );
}

// Placeholder data - will be replaced with real API data
const PLACEHOLDER_USERS = Array.from({ length: 10 }).map((_, i) => ({
  id: `user-${i}`,
  username: `user${i + 1}`,
  display_name: `User ${i + 1}`,
  total_tokens: (10 - i) * 1_200_000_000,
  total_cost: (10 - i) * 432,
  level: 7 - Math.floor(i / 2),
  country_rank: i + 1,
}));

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { country } = await params;
  const countryData = ALL_COUNTRIES.find(
    (c) => c.code.toLowerCase() === country.toLowerCase()
  );

  if (!countryData) {
    notFound();
  }

  // Placeholder stats - will be replaced with real API data
  const countryStats = {
    total_users: 1234,
    total_tokens: 500_000_000_000,
    average_tokens: 405_186_722,
    global_position: 5,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl">{countryData.flag}</span>
          <div>
            <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-2">
              Country League
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)]">
              {countryData.name}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Top Claude Code developers from {countryData.name}
            </p>
          </div>
        </div>
      </div>

      {/* Country Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="glass rounded-xl p-4">
          <div className="text-2xl font-bold text-text-primary">
            {countryStats.total_users.toLocaleString()}
          </div>
          <div className="text-sm text-text-muted">Total Developers</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-2xl font-bold text-text-primary">
            {(countryStats.total_tokens / 1_000_000_000).toFixed(0)}B
          </div>
          <div className="text-sm text-text-muted">Total Tokens</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-2xl font-bold text-text-primary">
            {(countryStats.average_tokens / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-sm text-text-muted">Avg per User</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-2xl font-bold text-text-primary">
            #{countryStats.global_position}
          </div>
          <div className="text-sm text-text-muted">Global Rank</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
          {['Today', '7D', '30D', 'All Time'].map((period) => (
            <button
              key={period}
              className="px-4 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors data-[active=true]:bg-white/10 data-[active=true]:text-text-primary"
              data-active={period === 'All Time'}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <Suspense fallback={<LeagueSkeleton />}>
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-text-secondary font-medium text-sm py-4 px-6">
                    Rank
                  </th>
                  <th className="text-left text-text-secondary font-medium text-sm py-4 px-6">
                    User
                  </th>
                  <th className="text-left text-text-secondary font-medium text-sm py-4 px-6">
                    Level
                  </th>
                  <th className="text-right text-text-secondary font-medium text-sm py-4 px-6">
                    Tokens
                  </th>
                  <th className="text-right text-text-secondary font-medium text-sm py-4 px-6">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLACEHOLDER_USERS.map((user, i) => (
                  <tr
                    key={user.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <span
                        className={`font-mono ${
                          i === 0
                            ? 'text-yellow-400'
                            : i === 1
                              ? 'text-gray-300'
                              : i === 2
                                ? 'text-orange-400'
                                : 'text-text-primary'
                        }`}
                      >
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[#F7931E] flex items-center justify-center text-white font-bold">
                          {user.display_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-text-primary">
                            {user.display_name}
                          </div>
                          <div className="text-sm text-text-muted">
                            @{user.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-text-primary">
                        ⚔️ Lv.{user.level}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-text-primary font-mono">
                        {(user.total_tokens / 1_000_000_000).toFixed(1)}B
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-text-primary font-mono">
                        ${user.total_cost.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Suspense>

      {/* Pagination */}
      <div className="flex justify-center mt-8 gap-2">
        {[1, 2, 3, '...', 10].map((page, i) => (
          <button
            key={i}
            className="w-10 h-10 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors data-[active=true]:bg-primary data-[active=true]:text-white"
            data-active={page === 1}
          >
            {page}
          </button>
        ))}
      </div>
    </div>
  );
}
