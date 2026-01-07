"use client";

import { motion } from "framer-motion";
import { type Country } from "@/lib/constants/countries";
import { Users, Trophy, TrendingUp, Check } from "lucide-react";

interface CountryCardProps {
  country: Country;
  isSelected: boolean;
  onClick: () => void;
  index: number;
  stats?: {
    users: number;
    rank: number;
    trending?: boolean;
  };
}

export function CountryCard({ country, isSelected, onClick, index, stats }: CountryCardProps) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        group relative w-full text-left overflow-hidden
        rounded-2xl transition-all duration-300
        ${
          isSelected
            ? "bg-gradient-to-br from-primary/20 via-primary/10 to-transparent ring-2 ring-primary shadow-lg shadow-primary/20"
            : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-primary/30"
        }
      `}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/3 group-hover:to-transparent transition-all duration-500" />

      {/* Shine effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>

      <div className="relative p-4 sm:p-5">
        {/* Header with flag and name */}
        <div className="flex items-center gap-3 mb-3">
          <motion.span
            className="text-3xl sm:text-4xl"
            animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            {country.flag}
          </motion.span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary truncate text-sm sm:text-base">
              {country.name}
            </h3>
            <p className="text-xs text-text-muted uppercase tracking-wider">
              {country.code} League
            </p>
          </div>

          {/* Selection indicator */}
          <motion.div
            className={`
              w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
              ${
                isSelected
                  ? "bg-primary text-white"
                  : "bg-white/5 border border-white/10 group-hover:border-primary/50"
              }
            `}
            animate={isSelected ? { scale: [0.8, 1.1, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            {isSelected && <Check className="w-3.5 h-3.5" />}
          </motion.div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary/70" />
              <span>{stats.users.toLocaleString()} coders</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-500/70" />
              <span>#{stats.rank}</span>
            </div>
            {stats.trending && (
              <div className="flex items-center gap-1 text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Hot</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom glow line when selected */}
      {isSelected && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.button>
  );
}

// Compact version for the scrollable list
export function CountryCardCompact({
  country,
  isSelected,
  onClick,
  index,
}: Omit<CountryCardProps, "stats">) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
        transition-all duration-200
        ${isSelected ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-white/[0.05]"}
      `}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="text-xl">{country.flag}</span>
      <span
        className={`flex-1 truncate ${isSelected ? "text-text-primary font-medium" : "text-text-secondary"}`}
      >
        {country.name}
      </span>
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
}
