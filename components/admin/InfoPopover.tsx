"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface InfoPopoverProps {
  title: string;
  description: string;
  insights?: readonly string[];
  formula?: string;
}

export function InfoPopover({ title, description, insights, formula }: InfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 280;
      const popoverHeight = 200;

      let left = rect.left + rect.width / 2 - popoverWidth / 2;
      let top = rect.bottom + 8;

      // 화면 경계 체크
      if (left < 8) left = 8;
      if (left + popoverWidth > window.innerWidth - 8) {
        left = window.innerWidth - popoverWidth - 8;
      }
      if (top + popoverHeight > window.innerHeight - 8) {
        top = rect.top - popoverHeight - 8;
      }

      setPosition({ top, left });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="ml-1 w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[10px] text-white/50 hover:text-white/70 transition-colors"
        aria-label={`${title} 정보`}
      >
        i
      </button>

      {isOpen &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[9999] w-[280px] bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl p-4 animate-in fade-in zoom-in-95 duration-150"
            style={{ top: position.top, left: position.left }}
          >
            {/* 제목 */}
            <div className="text-[13px] font-semibold text-white mb-2">{title}</div>

            {/* 설명 */}
            <p className="text-[12px] text-white/60 leading-relaxed mb-3">{description}</p>

            {/* 계산 공식 */}
            {formula && (
              <div className="bg-white/5 rounded px-2 py-1.5 mb-3">
                <div className="text-[10px] text-white/40 mb-1">계산 공식</div>
                <code className="text-[11px] text-[var(--color-claude-coral)] font-mono">
                  {formula}
                </code>
              </div>
            )}

            {/* 인사이트 */}
            {insights && insights.length > 0 && (
              <div className="border-t border-white/5 pt-2">
                <div className="text-[10px] text-white/40 mb-1.5">💡 활용 방법</div>
                <ul className="space-y-1">
                  {insights.map((insight, i) => (
                    <li key={i} className="text-[11px] text-white/50 flex items-start gap-1.5">
                      <span className="text-white/30 mt-0.5">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

/**
 * 지표별 설명 데이터
 */
export const METRIC_INFO = {
  // 핵심 지표
  wau_submitters: {
    title: "WAU (Weekly Active Submitters)",
    description: "최근 7일간 최소 1회 이상 CLI로 데이터를 제출한 고유 사용자 수입니다.",
    formula: "COUNT(DISTINCT user_id) WHERE submitted_at >= 7일 전",
    insights: [
      "핵심 활성 사용자 지표입니다",
      "이 수치가 감소하면 사용자 이탈을 의심해보세요",
      "신규 가입자 대비 비율로 활성화율을 파악할 수 있습니다",
    ],
  },
  mau_submitters: {
    title: "MAU (Monthly Active Submitters)",
    description: "최근 30일간 최소 1회 이상 CLI로 데이터를 제출한 고유 사용자 수입니다.",
    formula: "COUNT(DISTINCT user_id) WHERE submitted_at >= 30일 전",
    insights: [
      "월간 활성 사용자 규모를 파악합니다",
      "WAU와 함께 보면 서비스 점착도를 측정할 수 있습니다",
    ],
  },
  stickiness: {
    title: "WAU/MAU (Stickiness)",
    description:
      "WAU를 MAU로 나눈 비율입니다. 사용자들이 얼마나 자주 서비스를 이용하는지 보여줍니다.",
    formula: "(WAU / MAU) × 100",
    insights: [
      "25% 이상이면 건강한 engagement입니다",
      "15% 미만이면 사용자 이탈 위험 신호입니다",
      "개발 도구 특성상 20-30%가 일반적입니다",
    ],
  },
  total_submissions: {
    title: "총 제출 수",
    description: "선택한 기간 동안 발생한 모든 CLI 제출 횟수입니다.",
    formula: "COUNT(*) FROM usage_stats WHERE date IN 기간",
    insights: [
      "사용자 참여도를 나타냅니다",
      "WAU와 함께 보면 1인당 평균 제출 횟수를 알 수 있습니다",
    ],
  },
  new_signups: {
    title: "신규 가입",
    description: "선택한 기간 동안 새로 가입한 사용자 수입니다.",
    formula: "COUNT(*) FROM users WHERE created_at IN 기간",
    insights: ["사용자 획득 성과를 측정합니다", "마케팅/바이럴 효과를 평가할 수 있습니다"],
  },
  first_submit_rate: {
    title: "첫 제출 완료율",
    description: "가입 후 실제로 CLI를 통해 데이터를 제출한 사용자 비율입니다.",
    formula: "(첫 제출 완료 사용자 / 신규 가입자) × 100",
    insights: [
      "온보딩 성공률을 나타냅니다",
      "CLI 설치 가이드의 효과를 측정합니다",
      "이 비율이 낮으면 온보딩 UX를 개선하세요",
    ],
  },

  // DAU/WAU/MAU (웹 트래픽 - PostHog)
  dau: {
    title: "DAU (Daily Active Visitors)",
    description: "오늘 웹사이트에 방문한 고유 방문자 수입니다. 뉴스 SEO 유입 포함.",
    insights: ["일일 웹 트래픽을 파악합니다", "뉴스 콘텐츠의 SEO 효과를 측정할 수 있습니다"],
  },
  wau: {
    title: "WAU (Weekly Active Visitors)",
    description: "최근 7일간 웹사이트에 방문한 고유 방문자 수입니다.",
    insights: ["주간 웹 트래픽 규모를 파악합니다", "Overview의 WAU(제출자)와 다른 지표입니다"],
  },
  mau: {
    title: "MAU (Monthly Active Visitors)",
    description: "최근 30일간 웹사이트에 방문한 고유 방문자 수입니다.",
    insights: ["월간 웹 트래픽 규모를 파악합니다", "Overview의 MAU(제출자)와 다른 지표입니다"],
  },

  // 리텐션
  w1_retention: {
    title: "W1 리텐션",
    description: "첫 제출 후 1주일 뒤에 다시 제출한 사용자 비율입니다.",
    formula: "(1주차 재제출 사용자 / 첫 제출 사용자) × 100",
    insights: ["초기 사용자 유지율을 나타냅니다", "40% 이상이면 양호, 20% 미만이면 개선 필요"],
  },
  w4_retention: {
    title: "W4 리텐션",
    description: "첫 제출 후 4주일 뒤에 다시 제출한 사용자 비율입니다.",
    formula: "(4주차 재제출 사용자 / 첫 제출 사용자) × 100",
    insights: ["장기 사용자 유지율을 나타냅니다", "20% 이상이면 양호한 수준입니다"],
  },

  // 전환
  signup_funnel: {
    title: "가입 퍼널",
    description: "방문자가 가입까지 이어지는 과정을 단계별로 보여줍니다.",
    insights: ["이탈이 많은 단계를 찾아 개선하세요", "전환율이 낮은 단계에 집중하면 효율적입니다"],
  },
  submit_funnel: {
    title: "제출 퍼널",
    description: "가입 → CLI 설치 → 첫 제출 → 재제출 과정을 추적합니다.",
    insights: ["CCgather의 핵심 활성화 퍼널입니다", "CLI 설치 → 첫 제출 단계가 가장 중요합니다"],
  },

  // 분포
  country_distribution: {
    title: "국가별 분포",
    description: "사용자가 어느 국가에서 접속하는지 보여줍니다.",
    insights: ["글로벌 확장 전략에 활용하세요", "특정 국가 집중 시 현지화를 고려하세요"],
  },
  plan_distribution: {
    title: "플랜별 분포",
    description: "사용자들의 Claude Code 구독 플랜 분포입니다.",
    insights: [
      "Free/Pro/Max/Team/Enterprise 비율을 파악합니다",
      "프리미엄 사용자 비율로 서비스 가치를 추정합니다",
    ],
  },
  model_distribution: {
    title: "모델별 사용량",
    description: "사용자들이 주로 사용하는 Claude 모델 분포입니다.",
    insights: [
      "Sonnet/Opus/Haiku 사용 트렌드를 파악합니다",
      "새 모델 출시 시 채택률을 추적할 수 있습니다",
    ],
  },
} as const;
