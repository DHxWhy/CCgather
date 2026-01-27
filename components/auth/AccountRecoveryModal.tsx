"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Trash2, Clock, Trophy, ThumbsUp, Wrench, AlertTriangle } from "lucide-react";

interface PendingDeletionInfo {
  pending_deletion: true;
  deleted_at: string;
  expires_at: string;
  remaining_hours: number;
  stats: {
    tools_submitted: number;
    votes_count: number;
    level: number;
    username: string;
  };
}

interface AccountRecoveryModalProps {
  isOpen: boolean;
  pendingInfo: PendingDeletionInfo;
  onRecover: () => Promise<void>;
  onFreshStart: () => Promise<void>;
}

export function AccountRecoveryModal({
  isOpen,
  pendingInfo,
  onRecover,
  onFreshStart,
}: AccountRecoveryModalProps) {
  const [isLoading, setIsLoading] = useState<"recover" | "fresh-start" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatRemainingTime = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes} minutes`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    if (days > 0) {
      return `${days} days ${remainingHours} hours`;
    }
    return `${remainingHours} hours`;
  };

  const handleRecover = async () => {
    setIsLoading("recover");
    setError(null);
    try {
      await onRecover();
    } catch (err) {
      console.error("Account recovery failed:", err);
      setError("An error occurred during recovery. Please try again.");
      setIsLoading(null);
    }
  };

  const handleFreshStart = async () => {
    setIsLoading("fresh-start");
    setError(null);
    try {
      await onFreshStart();
    } catch (err) {
      console.error("Fresh start failed:", err);
      setError("An error occurred. Please try again.");
      setIsLoading(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop - no close on click for this important modal */}
          <motion.div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-[440px] rounded-2xl bg-[#0D0D0F] border border-white/10 shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
          >
            <div className="p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#DA7756]/20 to-[#B85C3D]/20 mb-4">
                  <RefreshCw className="w-8 h-8 text-[#DA7756]" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Previous Account Found!</h1>
                <p className="text-zinc-400 text-sm">
                  You can recover your pending deletion account or start fresh
                </p>
              </div>

              {/* Stats */}
              <div className="bg-white/5 rounded-xl p-4 mb-6">
                <div className="text-sm text-zinc-400 mb-3">
                  <span className="font-medium text-white">{pendingInfo.stats.username}</span>
                  &apos;s activity
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-zinc-300 mb-1">
                      <Wrench className="w-4 h-4" />
                      <span className="font-semibold">{pendingInfo.stats.tools_submitted}</span>
                    </div>
                    <span className="text-xs text-zinc-500">Tools</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-zinc-300 mb-1">
                      <ThumbsUp className="w-4 h-4" />
                      <span className="font-semibold">{pendingInfo.stats.votes_count}</span>
                    </div>
                    <span className="text-xs text-zinc-500">Votes</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-zinc-300 mb-1">
                      <Trophy className="w-4 h-4" />
                      <span className="font-semibold">Lv.{pendingInfo.stats.level}</span>
                    </div>
                    <span className="text-xs text-zinc-500">Level</span>
                  </div>
                </div>
              </div>

              {/* Remaining time */}
              <div className="flex items-center justify-center gap-2 text-amber-400 text-sm mb-6">
                <Clock className="w-4 h-4" />
                <span>Time remaining: {formatRemainingTime(pendingInfo.remaining_hours)}</span>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRecover}
                  disabled={isLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-[#DA7756] to-[#B85C3D] text-white font-semibold text-base hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading === "recover" ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  <span>Recover Account</span>
                </button>

                <button
                  onClick={handleFreshStart}
                  disabled={isLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/5 text-zinc-300 font-medium text-base hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                >
                  {isLoading === "fresh-start" ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                  <span>Start Fresh</span>
                </button>
              </div>

              {/* Warning */}
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-200/80">
                    Choosing <span className="font-semibold">&quot;Start Fresh&quot;</span> will{" "}
                    <span className="font-semibold text-amber-300">permanently delete</span> your
                    previous data immediately. This cannot be undone.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
