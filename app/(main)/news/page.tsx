import { Suspense } from 'react';

export const metadata = {
  title: 'News',
  description: 'Latest updates and announcements from the Claude Code community.',
};

function NewsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-6">
          <div className="h-6 bg-white/10 rounded w-3/4 mb-4" />
          <div className="h-4 bg-white/5 rounded w-full mb-2" />
          <div className="h-4 bg-white/5 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: 'announcement' | 'update' | 'community' | 'tip';
  published_at: string;
}

const CATEGORY_STYLES = {
  announcement: { bg: 'bg-primary/20', text: 'text-primary', label: '📢 Announcement' },
  update: { bg: 'bg-green-500/20', text: 'text-green-400', label: '🔄 Update' },
  community: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: '👥 Community' },
  tip: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '💡 Tip' },
};

function NewsCard({ item }: { item: NewsItem }) {
  const categoryStyle = CATEGORY_STYLES[item.category];
  const date = new Date(item.published_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article className="glass rounded-2xl p-6 hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center gap-3 mb-4">
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${categoryStyle.bg} ${categoryStyle.text}`}
        >
          {categoryStyle.label}
        </span>
        <span className="text-sm text-text-muted">{date}</span>
      </div>
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
        {item.title}
      </h2>
      <p className="text-text-secondary leading-relaxed">{item.content}</p>
    </article>
  );
}

// Placeholder data - will be replaced with real API data
const PLACEHOLDER_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Welcome to CCgather!',
    content:
      'CCgather is the global leaderboard for Claude Code developers. Track your token usage, compete with developers worldwide, and earn badges for your achievements.',
    category: 'announcement',
    published_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'New Badge System Released',
    content:
      'We have introduced a new badge system with 17 unique badges across 4 categories. Complete challenges and earn badges to showcase your Claude Code expertise.',
    category: 'update',
    published_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '3',
    title: 'Country Leagues Now Available',
    content:
      'Compete with developers from your country! Country leagues show rankings within each nation, fostering local competition and community.',
    category: 'community',
    published_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: '4',
    title: 'Maximize Your Claude Code Efficiency',
    content:
      'Pro tip: Use the --resume flag to continue previous conversations and save tokens. This feature helps you maintain context across sessions.',
    category: 'tip',
    published_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-3">
          Updates
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] mb-2">
          News & Updates
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Latest announcements, updates, and tips from the CCgather community
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/20 text-primary">
          All
        </button>
        {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
          <button
            key={key}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${style.bg} ${style.text} opacity-60 hover:opacity-100 transition-opacity`}
          >
            {style.label}
          </button>
        ))}
      </div>

      {/* News List */}
      <Suspense fallback={<NewsSkeleton />}>
        <div className="space-y-6">
          {PLACEHOLDER_NEWS.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      </Suspense>

      {/* Load More */}
      <div className="mt-8 text-center">
        <button className="px-6 py-3 rounded-xl bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary transition-colors">
          Load More
        </button>
      </div>
    </div>
  );
}
