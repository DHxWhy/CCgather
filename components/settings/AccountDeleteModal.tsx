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
  Bookmark,
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
      setError("계정 삭제 중 오류가 발생했습니다. 다시 시도해주세요.");
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
    { icon: ChartBar, label: "사용 통계", desc: "토큰 사용량, 비용 기록" },
    { icon: Vote, label: "투표 기록", desc: "추천/비추천한 도구들" },
    { icon: Bookmark, label: "북마크", desc: "저장한 도구 목록" },
    { icon: Award, label: "뱃지 및 레벨", desc: "획득한 뱃지, 레벨 정보" },
    { icon: MessageSquare, label: "활동 내역", desc: "추천한 도구, 댓글" },
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
                  <h2 className="text-lg font-bold text-white">계정 삭제</h2>
                  <p className="text-xs text-zinc-500">이 작업은 되돌릴 수 없습니다</p>
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
                  <p className="text-sm font-medium text-amber-300">3일 이내 복구 가능</p>
                  <p className="text-xs text-amber-200/70 mt-1">
                    계정 삭제 요청 후 3일 이내에 다시 로그인하시면 계정을 복구할 수 있습니다. 3일이
                    지나면 모든 데이터가 영구 삭제됩니다.
                  </p>
                </div>
              </div>

              {/* Deleted Data List */}
              <div>
                <p className="text-sm font-medium text-zinc-300 mb-3">삭제되는 데이터</p>
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
                  확인을 위해 <span className="text-red-400 font-bold">{username}</span>을(를)
                  입력하세요
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
                  취소
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
                      <span>계정 삭제</span>
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
