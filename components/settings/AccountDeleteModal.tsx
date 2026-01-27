"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  AlertTriangle,
  Trash2,
  Clock,
  ChartBar,
  Vote,
  Award,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  onConfirmDelete: () => Promise<void>;
}

export function AccountDeleteModal({
  isOpen,
  onClose,
  username,
  onConfirmDelete,
}: AccountDeleteModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmEnabled = inputValue === username;

  const handleDelete = async () => {
    if (!isConfirmEnabled) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirmDelete();
      onClose();
    } catch (err) {
      console.error("Account deletion failed:", err);
      setError("An error occurred while deleting your account. Please try again.");
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return;
    setInputValue("");
    setError(null);
    onClose();
  };

  // Data that will be deleted
  const deletedData = [
    { icon: ChartBar, label: "Usage Statistics", desc: "Token usage, cost history" },
    { icon: Vote, label: "Vote History", desc: "Tools you've upvoted" },
    { icon: Award, label: "Badges & Level", desc: "Earned badges, level info" },
    { icon: MessageSquare, label: "Activity History", desc: "Submitted tools, comments" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md rounded-2xl bg-[#0D0D0F] border border-white/10 shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Delete Account</h2>
                  <p className="text-xs text-zinc-500">Your profile will be hidden immediately</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isDeleting}
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
              {/* Recovery Notice */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Clock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-300">
                    Recovery available within 7 days
                  </p>
                  <p className="text-xs text-amber-200/70 mt-1">
                    Your profile will be hidden immediately from the leaderboard and public views.
                    If you log in within 7 days, you can recover your account. After 7 days, all
                    data will be permanently deleted.
                  </p>
                </div>
              </div>

              {/* Deleted Data List */}
              <div>
                <p className="text-sm font-medium text-zinc-300 mb-3">Data to be deleted</p>
                <div className="space-y-2">
                  {deletedData.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/5"
                    >
                      <item.icon className="w-4 h-4 text-zinc-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-300">{item.label}</p>
                        <p className="text-[11px] text-zinc-600 truncate">{item.desc}</p>
                      </div>
                      <Trash2 className="w-3.5 h-3.5 text-red-400/60" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirmation Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Type <span className="text-red-400 font-bold">{username}</span> to confirm
                </label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={username}
                  disabled={isDeleting}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg bg-white/5 border text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 transition-all disabled:opacity-50",
                    isConfirmEnabled
                      ? "border-red-500/50 focus:ring-red-500/30"
                      : "border-white/10 focus:ring-primary/30"
                  )}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-zinc-300 font-medium text-sm hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!isConfirmEnabled || isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
