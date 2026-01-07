"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  LogOut,
  Trophy,
  User,
  ChevronRight,
  Zap,
  Globe2,
  ExternalLink,
} from "lucide-react";
import { getCountryByCode } from "@/lib/constants/countries";

interface ProfileDropdownProps {
  align?: "left" | "right";
}

export function ProfileDropdown({ align = "right" }: ProfileDropdownProps) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  if (!isLoaded || !user) {
    return <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse" />;
  }

  // Get user's country from metadata or public metadata
  const countryCode = (user.publicMetadata?.country_code as string) || "";
  const countryData = countryCode ? getCountryByCode(countryCode) : null;

  const handleNavigation = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    router.push("/");
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Profile Avatar Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Avatar */}
        <div className="relative">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.fullName || user.username || "Profile"}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-transparent group-hover:ring-primary/50 transition-all"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[#B85C3D] flex items-center justify-center ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
              <span className="text-white font-semibold text-sm">
                {(user.fullName || user.username || "U").charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Online indicator */}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-bg-primary" />
        </div>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`absolute top-full mt-2 ${align === "right" ? "right-0" : "left-0"} w-72 z-50`}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className="bg-bg-elevated border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* User Info Header */}
              <div className="p-4 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
                <div className="flex items-center gap-3">
                  {user.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={user.fullName || user.username || "Profile"}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-[#B85C3D] flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {(user.fullName || user.username || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary truncate">
                      {user.fullName || user.username || "Anonymous"}
                    </p>
                    <p className="text-sm text-text-muted truncate">@{user.username || "user"}</p>
                  </div>
                </div>

                {/* Country Badge */}
                {countryData && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.05]">
                    <span className="text-lg">{countryData.flag}</span>
                    <span className="text-sm text-text-secondary">{countryData.name} League</span>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="px-4 py-3 border-t border-white/[0.05] grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-white/[0.02] text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
                    <Trophy className="w-3.5 h-3.5" />
                    <span className="text-sm font-semibold">#--</span>
                  </div>
                  <p className="text-xs text-text-muted">Global Rank</p>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.02] text-center">
                  <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="text-sm font-semibold">0</span>
                  </div>
                  <p className="text-xs text-text-muted">Tokens Today</p>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2 border-t border-white/[0.05]">
                <MenuItem
                  icon={User}
                  label="View Profile"
                  onClick={() => handleNavigation(`/u/${user.username}`)}
                />
                <MenuItem
                  icon={Settings}
                  label="Settings"
                  onClick={() => handleNavigation("/settings")}
                />
                <MenuItem
                  icon={Globe2}
                  label="Leaderboard"
                  onClick={() => handleNavigation("/leaderboard")}
                />
              </div>

              {/* Sign Out */}
              <div className="p-2 border-t border-white/[0.05]">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Menu Item Component
function MenuItem({
  icon: Icon,
  label,
  onClick,
  external = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  external?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/[0.05] transition-colors group"
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left text-sm font-medium">{label}</span>
      {external ? (
        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}
