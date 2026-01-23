"use client";

import { useState } from "react";
import { X, AlertTriangle, CheckCircle, ArrowRight, Loader2 } from "lucide-react";

export interface DateMismatch {
  original: { original: string; normalized: string; context: string };
  rewritten: { original: string; normalized: string; context: string } | null;
  issue: string;
  severity: "critical" | "warning" | "info";
}

export interface NumberMismatch {
  original: { original: string; value: number; context: string };
  rewritten: { original: string; value: number; context: string } | null;
  issue: string;
  severity: "critical" | "warning" | "info";
}

export interface HardCheckResult {
  passed: boolean;
  score: number;
  dateCheck: {
    passed: boolean;
    mismatches: DateMismatch[];
  };
  numberCheck: {
    passed: boolean;
    mismatches: NumberMismatch[];
  };
  criticalIssues: string[];
  warnings: string[];
}

export interface CorrectionItem {
  type: "date" | "number";
  original: string;
  wrong: string;
  corrected: string;
  context: string;
}

export interface ReverifyPreviewData {
  success: boolean;
  previousScore: number;
  newScore: number;
  hardCheckResult: HardCheckResult;
  previewMode: boolean;
  proposedCorrections: CorrectionItem[];
  currentBodyHtml?: string;
  correctedBodyHtml?: string;
}

interface ReverifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentTitle: string;
  previewData: ReverifyPreviewData | null;
  isLoading: boolean;
  onApplyFix: () => Promise<void>;
}

export default function ReverifyModal({
  isOpen,
  onClose,
  contentTitle,
  previewData,
  isLoading,
  onApplyFix,
}: ReverifyModalProps) {
  const [applying, setApplying] = useState(false);

  if (!isOpen) return null;

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApplyFix();
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">3+ 팩트체크 검증</h2>
            <p className="text-sm text-white/60 truncate max-w-[500px]">{contentTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <span className="ml-3 text-white/60">원본과 비교 분석 중...</span>
            </div>
          ) : previewData ? (
            <>
              {/* Score Overview */}
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {previewData.previousScore.toFixed(0)}점
                    </div>
                    <div className="text-xs text-white/40">현재 점수</div>
                  </div>
                  <ArrowRight className="w-6 h-6 text-white/40" />
                  <div className="text-center">
                    <div
                      className={`text-2xl font-bold ${
                        previewData.newScore === 100
                          ? "text-emerald-400"
                          : previewData.newScore >= 80
                            ? "text-yellow-400"
                            : "text-red-400"
                      }`}
                    >
                      {previewData.newScore.toFixed(0)}점
                    </div>
                    <div className="text-xs text-white/40">
                      {previewData.proposedCorrections.length > 0 ? "수정 후 예상" : "검증 결과"}
                    </div>
                  </div>
                </div>

                {previewData.hardCheckResult.passed ? (
                  <div className="mt-4 flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>모든 날짜/숫자가 원본과 일치합니다</span>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{previewData.hardCheckResult.criticalIssues.length}개 문제 발견</span>
                  </div>
                )}
              </div>

              {/* Critical Issues */}
              {previewData.hardCheckResult.criticalIssues.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-red-400">발견된 문제</h3>
                  <div className="space-y-2">
                    {previewData.hardCheckResult.criticalIssues.map((issue, i) => (
                      <div
                        key={i}
                        className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-white/80"
                      >
                        {issue}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Mismatches */}
              {previewData.hardCheckResult.dateCheck.mismatches.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-yellow-400">날짜 불일치</h3>
                  <div className="space-y-2">
                    {previewData.hardCheckResult.dateCheck.mismatches.map((m, i) => (
                      <div
                        key={i}
                        className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-white/60">원본:</span>
                          <span className="text-emerald-400 font-mono">{m.original.original}</span>
                          <ArrowRight className="w-4 h-4 text-white/40" />
                          <span className="text-white/60">현재:</span>
                          <span className="text-red-400 font-mono">
                            {m.rewritten?.original || "(누락)"}
                          </span>
                        </div>
                        <div className="text-xs text-white/40 mt-1">{m.issue}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Number Mismatches */}
              {previewData.hardCheckResult.numberCheck.mismatches.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-orange-400">숫자 불일치</h3>
                  <div className="space-y-2">
                    {previewData.hardCheckResult.numberCheck.mismatches.map((m, i) => (
                      <div
                        key={i}
                        className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-white/60">원본:</span>
                          <span className="text-emerald-400 font-mono">{m.original.original}</span>
                          <ArrowRight className="w-4 h-4 text-white/40" />
                          <span className="text-white/60">현재:</span>
                          <span className="text-red-400 font-mono">
                            {m.rewritten?.original || "(누락)"}
                          </span>
                        </div>
                        <div className="text-xs text-white/40 mt-1">{m.issue}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Proposed Corrections */}
              {previewData.proposedCorrections.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-purple-400">
                    AI 자동 수정 제안 ({previewData.proposedCorrections.length}개)
                  </h3>
                  <div className="space-y-2">
                    {previewData.proposedCorrections.map((c, i) => (
                      <div
                        key={i}
                        className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-1 text-xs text-purple-400 mb-2">
                          <span className="px-1.5 py-0.5 bg-purple-500/20 rounded">
                            {c.type === "date" ? "날짜" : "숫자"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-red-400 line-through font-mono">{c.wrong}</span>
                          <ArrowRight className="w-4 h-4 text-purple-400" />
                          <span className="text-emerald-400 font-mono">{c.corrected}</span>
                        </div>
                        <div className="text-xs text-white/40 mt-2 line-clamp-2">
                          문맥: {c.context}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {previewData.hardCheckResult.warnings.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-white/60">경고</h3>
                  <div className="space-y-1">
                    {previewData.hardCheckResult.warnings.map((w, i) => (
                      <div key={i} className="text-xs text-white/40">
                        • {w}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-white/40">데이터를 불러올 수 없습니다</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            취소
          </button>

          {previewData && previewData.proposedCorrections.length > 0 && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-4 py-2 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  적용 중...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  수정 적용 ({previewData.proposedCorrections.length}개)
                </>
              )}
            </button>
          )}

          {previewData && previewData.hardCheckResult.passed && (
            <div className="px-4 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg">
              검증 통과 - 수정 불필요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
