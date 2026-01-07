'use client';

import Image from 'next/image';
import { MapPin, Calendar, ExternalLink } from 'lucide-react';

export interface ProfileData {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  rank: number;
  tier: string;
  totalTokens: number;
  totalSpent: number;
  badges: string[];
  createdAt: string;
  githubUrl?: string;
  twitterUrl?: string;
}

interface ProfileHeaderProps {
  profile: ProfileData;
  isOwnProfile?: boolean;
}

function getCountryFlag(country: string | null): string {
  if (!country) return '';
  const countryCode = country.toUpperCase();
  if (countryCode.length !== 2) return '';
  const codePoints = countryCode
    .split('')
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

function getRankMedal(rank: number): string {
  if (rank === 1) return '👑';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank <= 10) return '🏅';
  if (rank <= 100) return '🎖️';
  return '';
}

function getTierColor(tier: string): string {
  const defaultColor = 'text-text-muted';
  const colors: Record<string, string> = {
    free: defaultColor,
    pro: 'text-accent-blue',
    team: 'text-accent-purple',
    enterprise: 'text-primary',
  };
  return colors[tier.toLowerCase()] ?? defaultColor;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

export function ProfileHeader({ profile, isOwnProfile }: ProfileHeaderProps) {
  const flag = getCountryFlag(profile.country);
  const medal = getRankMedal(profile.rank);

  return (
    <div className="relative">
      {/* Background gradient */}
      <div className="h-32 bg-gradient-to-r from-primary/20 via-accent-purple/10 to-accent-blue/20 rounded-t-xl" />

      <div className="px-6 pb-6">
        {/* Avatar */}
        <div className="relative -mt-16 mb-4">
          <div className="w-32 h-32 rounded-full border-4 border-bg-primary overflow-hidden bg-bg-secondary">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.username}
                width={128}
                height={128}
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-text-muted">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Rank badge overlay */}
          {profile.rank <= 100 && (
            <div className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-bg-card border border-white/10 text-sm">
              {medal} #{profile.rank}
            </div>
          )}
        </div>

        {/* User info */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-text-primary">
                {profile.username}
              </h1>
              {flag && <span className="text-xl">{flag}</span>}
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 ${getTierColor(
                  profile.tier
                )}`}
              >
                {profile.tier}
              </span>
            </div>

            {profile.bio && (
              <p className="text-sm text-text-secondary mb-3 max-w-lg">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-xs text-text-muted">
              {profile.country && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>{profile.country}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Joined {formatDate(profile.createdAt)}</span>
              </div>
            </div>

            {/* Social links */}
            {(profile.githubUrl || profile.twitterUrl) && (
              <div className="flex gap-3 mt-3">
                {profile.githubUrl && (
                  <a
                    href={profile.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Badges */}
          {profile.badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.badges.map((badge) => (
                <span
                  key={badge}
                  className="px-2 py-1 rounded-full bg-bg-card border border-white/10 text-sm"
                  title={badge}
                >
                  {getBadgeEmoji(badge)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Edit button for own profile */}
        {isOwnProfile && (
          <button className="mt-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors">
            Edit Profile
          </button>
        )}
      </div>
    </div>
  );
}

function getBadgeEmoji(badge: string): string {
  const badgeEmojis: Record<string, string> = {
    'first-sync': '🚀',
    'token-1k': '🌱',
    'token-10k': '⚡',
    'token-100k': '💪',
    'token-1m': '💎',
    'token-10m': '🏆',
    'top-100': '🏅',
    'top-10': '🥇',
    'number-one': '👑',
    'opus-user': '🎭',
    'sonnet-user': '🎵',
    'early-adopter': '🌟',
    'big-spender': '💰',
  };
  return badgeEmojis[badge] || '🏅';
}

export default ProfileHeader;
