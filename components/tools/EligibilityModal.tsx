"use client";

import { useEffect } from "react";
import { X, TrendingUp, Calendar, CheckCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface EligibilityRequirement {
  key: string;
  label: string;
  description: string;
}

interface EligibilityData {
  eligible: boolean;
  requirements: {
    level: { met: boolean; current: number; required: number; name: string };
    data_days: { met: boolean; current: number; required: number };
  };
  allRequirements: EligibilityRequirement[];
}

interface EligibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  eligibility: EligibilityData | null;
  isLoading?: boolean;
}

const RequirementIcon = ({ reqKey, isMet }: { reqKey: string; isMet: boolean }) => {
  const iconClass = "w-4 h-4";

  if (isMet) {
    return <CheckCircle className={cn(iconClass, "text-green-500")} />;
  }

  switch (reqKey) {
    case "level":
      return <TrendingUp className={cn(iconClass, "text-[var(--color-claude-coral)]")} />;
    case "data_days":
      return <Calendar className={cn(iconClass, "text-blue-400")} />;
    default:
      return null;
  }
};

export function EligibilityModal({
  isOpen,
  onClose,
  eligibility,
  isLoading,
}: EligibilityModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[var(--color-bg-card)] border border-[var(--border-default)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
              <Lock className="w-4 h-4 text-[var(--color-text-muted)]" />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              도구 추천 자격
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : eligibility ? (
            <>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                아래 조건 중{" "}
                <span className="text-[var(--color-claude-coral)] font-medium">하나만</span>{" "}
                충족하면 도구를 추천할 수 있습니다.
              </p>

              {/* Requirements */}
              <div className="space-y-3">
                {eligibility.allRequirements.map((req, index) => {
                  const status =
                    eligibility.requirements[req.key as keyof typeof eligibility.requirements];
                  const isMet = status && "met" in status ? status.met : false;

                  return (
                    <div key={req.key}>
                      <div
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          isMet
                            ? "bg-green-500/10 border-green-500/30"
                            : "bg-[var(--color-bg-elevated)] border-[var(--border-default)]"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                              isMet
                                ? "bg-green-500/20"
                                : req.key === "level"
                                  ? "bg-[var(--color-claude-coral)]/10"
                                  : "bg-blue-500/10"
                            )}
                          >
                            <RequirementIcon reqKey={req.key} isMet={isMet} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  isMet ? "text-green-500" : "text-[var(--color-text-primary)]"
                                )}
                              >
                                {req.label}
                              </span>
                              {req.key === "level" && status && "current" in status && (
                                <span className="text-xs font-medium text-orange-400">
                                  (현재: Lv.{status.current})
                                </span>
                              )}
                              {req.key === "data_days" && status && "current" in status && (
                                <span className="text-xs font-medium text-orange-400">
                                  (현재: {status.current}일)
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                              {req.key === "level"
                                ? "10B~30B 토큰 구간 달성 필요"
                                : req.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* OR Divider */}
                      {index < eligibility.allRequirements.length - 1 && (
                        <div className="flex items-center gap-3 my-3">
                          <div className="flex-1 h-px bg-[var(--border-default)]" />
                          <span className="text-xs font-medium text-[var(--color-text-muted)] px-2">
                            OR
                          </span>
                          <div className="flex-1 h-px bg-[var(--border-default)]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">
              자격 정보를 불러올 수 없습니다.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-default)]">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--border-default)] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
