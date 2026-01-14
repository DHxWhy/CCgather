"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  ExternalLink,
  CheckCircle,
  Sparkles,
  AlertCircle,
  Lock,
  TrendingUp,
  Calendar,
  Clipboard,
  X,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  TOOL_CATEGORIES,
  TOOL_PRICING_TYPES,
  CATEGORY_META,
  PRICING_META,
  type ToolCategory,
  type ToolPricingType,
} from "@/types/tools";

// =====================================================
// Types
// =====================================================

interface ToolFormData {
  name: string;
  website_url: string;
  tagline: string;
  description: string;
  category: ToolCategory | "";
  pricing_type: ToolPricingType;
  logo_url: string;
  tags: string[];
}

interface FormErrors {
  name?: string;
  website_url?: string;
  tagline?: string;
  category?: string;
  general?: string;
}

interface EligibilityData {
  eligible: boolean;
  eligible_path: "level" | "data_days" | null;
  trust_tier: string;
  vote_weight: number;
  message: string;
  requirements: {
    level: { met: boolean; current: number; required: number; name: string };
    data_days: { met: boolean; current: number; required: number };
  };
  allRequirements: Array<{ key: string; label: string; description: string }>;
  user: {
    username: string;
    avatar_url: string | null;
    current_level: number;
    unique_data_days: number;
  };
}

// =====================================================
// Form Validation
// =====================================================

function validateForm(data: ToolFormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.name.trim()) {
    errors.name = "도구 이름을 입력해주세요";
  } else if (data.name.length < 2) {
    errors.name = "이름은 최소 2자 이상이어야 합니다";
  }

  if (!data.website_url.trim()) {
    errors.website_url = "웹사이트 URL을 입력해주세요";
  } else {
    try {
      new URL(data.website_url);
    } catch {
      errors.website_url = "유효한 URL을 입력해주세요";
    }
  }

  if (!data.tagline.trim()) {
    errors.tagline = "한 줄 설명을 입력해주세요";
  } else if (data.tagline.length > 100) {
    errors.tagline = "한 줄 설명은 100자 이내로 작성해주세요";
  }

  if (!data.category) {
    errors.category = "카테고리를 선택해주세요";
  }

  return errors;
}

// =====================================================
// Requirement Icons
// =====================================================

const RequirementIcon = ({ reqKey }: { reqKey: string }) => {
  switch (reqKey) {
    case "level":
      return <TrendingUp className="w-4 h-4" />;
    case "data_days":
      return <Calendar className="w-4 h-4" />;
    default:
      return null;
  }
};

// =====================================================
// Component
// =====================================================

export default function ToolSuggestPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  // Eligibility state
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(true);

  // Form state
  const [formData, setFormData] = useState<ToolFormData>({
    name: "",
    website_url: "",
    tagline: "",
    description: "",
    category: "",
    pricing_type: "freemium",
    logo_url: "",
    tags: [],
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // URL analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Logo upload state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // Logo paste handler
  const handleLogoPaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        // File size check (512KB)
        if (file.size > 512 * 1024) {
          setLogoUploadError("파일 크기는 512KB 이하여야 합니다");
          return;
        }

        setIsUploadingLogo(true);
        setLogoUploadError(null);

        try {
          const uploadFormData = new FormData();
          uploadFormData.append("file", file);

          const response = await fetch("/api/tools/logo", {
            method: "POST",
            body: uploadFormData,
          });

          const data = await response.json();

          if (data.success) {
            setFormData((prev) => ({ ...prev, logo_url: data.url }));
          } else {
            setLogoUploadError(data.error || "업로드 실패");
          }
        } catch {
          setLogoUploadError("업로드 중 오류가 발생했습니다");
        } finally {
          setIsUploadingLogo(false);
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handleLogoPaste);
    return () => document.removeEventListener("paste", handleLogoPaste);
  }, [handleLogoPaste]);

  // Check eligibility on mount
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function checkEligibility() {
      try {
        const res = await fetch("/api/tools/eligibility");
        if (res.ok) {
          const data = await res.json();
          setEligibility(data);
        }
      } catch (error) {
        console.error("Failed to check eligibility:", error);
      } finally {
        setIsLoadingEligibility(false);
      }
    }

    checkEligibility();
  }, [isLoaded, isSignedIn]);

  // Analyze URL handler
  const analyzeUrl = useCallback(async () => {
    if (!formData.website_url.trim()) {
      setErrors((prev) => ({ ...prev, website_url: "URL을 입력해주세요" }));
      return;
    }

    try {
      new URL(formData.website_url);
    } catch {
      setErrors((prev) => ({ ...prev, website_url: "유효한 URL을 입력해주세요" }));
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setErrors((prev) => ({ ...prev, website_url: undefined }));

    try {
      const res = await fetch("/api/tools/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formData.website_url.trim() }),
      });

      const data = await res.json();

      if (res.status === 409) {
        // Duplicate tool
        setAnalysisError(`이미 등록된 도구입니다: ${data.existing?.name}`);
        return;
      }

      if (data.error === "analysis_failed") {
        setAnalysisError("URL 분석에 실패했습니다. 직접 정보를 입력해주세요.");
        setHasAnalyzed(true);
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || data.error);
      }

      // Fill form with analyzed data
      if (data.tool) {
        setFormData((prev) => ({
          ...prev,
          name: data.tool.name || prev.name,
          tagline: data.tool.tagline || prev.tagline,
          description: data.tool.description || prev.description,
          category: data.tool.category || prev.category,
          pricing_type: data.tool.pricing_type || prev.pricing_type,
          logo_url: data.tool.logo_url || prev.logo_url,
          tags: data.tool.tags || prev.tags,
        }));
        setHasAnalyzed(true);
      }
    } catch (error) {
      console.error("Analysis error:", error);
      setAnalysisError(error instanceof Error ? error.message : "분석 중 오류가 발생했습니다");
    } finally {
      setIsAnalyzing(false);
    }
  }, [formData.website_url]);

  // Auth check
  if (isLoaded && !isSignedIn) {
    router.push("/sign-in?redirect_url=/tools/submit");
    return null;
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          website_url: formData.website_url.trim(),
          tagline: formData.tagline.trim(),
          description: formData.description.trim() || undefined,
          category: formData.category,
          pricing_type: formData.pricing_type,
          logo_url: formData.logo_url.trim() || undefined,
          tags: formData.tags,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setErrors({ general: data.message || "도구 추천 권한이 없습니다" });
        } else {
          throw new Error(data.error || "Failed to suggest tool");
        }
        return;
      }

      setIsSuccess(true);
    } catch (error) {
      console.error("Submit error:", error);
      setErrors({
        general: error instanceof Error ? error.message : "제출 중 오류가 발생했습니다",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoadingEligibility) {
    return (
      <main className="min-h-screen bg-[var(--color-bg-primary)]">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-claude-coral)]" />
            <span className="text-[var(--color-text-secondary)]">자격 확인 중...</span>
          </div>
        </div>
      </main>
    );
  }

  // Not eligible state
  if (eligibility && !eligibility.eligible) {
    return (
      <main className="min-h-screen bg-[var(--color-bg-primary)]">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            도구 목록으로
          </Link>

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
              <Lock className="w-8 h-8 text-[var(--color-text-muted)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              도구 추천 자격이 필요합니다
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              신뢰할 수 있는 추천을 위해 다음 요건을 충족해야 합니다.
            </p>
          </div>

          {/* Requirements */}
          <div className="space-y-4 mb-8">
            {eligibility.allRequirements.map((req) => {
              const status =
                eligibility.requirements[req.key as keyof typeof eligibility.requirements];
              const isMet = status && "met" in status ? status.met : false;

              return (
                <div
                  key={req.key}
                  className={cn(
                    "p-4 rounded-lg border",
                    isMet
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-[var(--color-bg-card)] border-[var(--border-default)]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        isMet
                          ? "bg-green-500/20 text-green-500"
                          : "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
                      )}
                    >
                      {isMet ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <RequirementIcon reqKey={req.key} />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3
                        className={cn(
                          "font-medium",
                          isMet ? "text-green-500" : "text-[var(--color-text-primary)]"
                        )}
                      >
                        {req.label}
                        {req.key === "level" && status && "current" in status && (
                          <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
                            (현재: Lv.{status.current})
                          </span>
                        )}
                        {req.key === "data_days" && status && "current" in status && (
                          <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
                            (현재: {status.current}일)
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {req.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* OR divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-[var(--border-default)]" />
            <span className="text-sm font-medium text-[var(--color-text-muted)]">OR</span>
            <div className="flex-1 h-px bg-[var(--border-default)]" />
          </div>

          <p className="text-center text-sm text-[var(--color-text-secondary)] mb-8">
            둘 중 하나의 조건만 충족하면 도구를 추천할 수 있습니다.
          </p>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <Link
              href="/tools"
              className="px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
            >
              도구 목록으로
            </Link>
            <Link
              href="/leaderboard"
              className="px-4 py-2 rounded-lg bg-[var(--color-claude-coral)] text-white hover:bg-[var(--color-claude-rust)] transition-colors"
            >
              레벨업하기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Success State
  if (isSuccess) {
    return (
      <main className="min-h-screen bg-[var(--color-bg-primary)]">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">추천 완료!</h1>
            <p className="text-[var(--color-text-secondary)] mb-6">
              도구가 성공적으로 추천되었습니다.
              <br />
              관리자 검토 후 목록에 표시됩니다.
            </p>

            {/* Suggester info */}
            {eligibility?.user && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--border-default)] mb-6">
                {eligibility.user.avatar_url ? (
                  <Image
                    src={eligibility.user.avatar_url}
                    alt={eligibility.user.username}
                    width={24}
                    height={24}
                    className="rounded-full"
                    unoptimized
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-xs">
                    {eligibility.user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-[var(--color-text-primary)]">
                  {eligibility.user.username}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  Lv.{eligibility.user.current_level}
                </span>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Link
                href="/tools"
                className="px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
              >
                도구 목록으로
              </Link>
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setHasAnalyzed(false);
                  setFormData({
                    name: "",
                    website_url: "",
                    tagline: "",
                    description: "",
                    category: "",
                    pricing_type: "freemium",
                    logo_url: "",
                    tags: [],
                  });
                }}
                className="px-4 py-2 rounded-lg bg-[var(--color-claude-coral)] text-white hover:bg-[var(--color-claude-rust)] transition-colors"
              >
                다른 도구 추천
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            도구 목록으로
          </Link>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">도구 추천하기</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            유용한 개발 도구를 커뮤니티와 공유하세요
          </p>

          {/* Suggester badge */}
          {eligibility?.user && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--border-default)]">
              {eligibility.user.avatar_url ? (
                <Image
                  src={eligibility.user.avatar_url}
                  alt={eligibility.user.username}
                  width={20}
                  height={20}
                  className="rounded-full"
                  unoptimized
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-[10px]">
                  {eligibility.user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-[var(--color-text-secondary)]">추천자:</span>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {eligibility.user.username}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Lv.{eligibility.user.current_level}
              </span>
            </div>
          )}
        </header>

        {/* General Error */}
        {errors.general && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-500">{errors.general}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL with Analyze Button */}
          <div>
            <label
              htmlFor="website_url"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              웹사이트 URL <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="url"
                  id="website_url"
                  name="website_url"
                  value={formData.website_url}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  disabled={isAnalyzing}
                  className={cn(
                    "w-full px-3 py-2 pr-10 rounded-lg",
                    "bg-[var(--color-bg-card)] border",
                    "text-[var(--color-text-primary)]",
                    "placeholder:text-[var(--color-text-muted)]",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]",
                    "disabled:opacity-50",
                    errors.website_url ? "border-red-500" : "border-[var(--border-default)]"
                  )}
                />
                {formData.website_url && !isAnalyzing && (
                  <a
                    href={formData.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={analyzeUrl}
                disabled={isAnalyzing || !formData.website_url.trim()}
                className={cn(
                  "px-4 py-2 rounded-lg flex items-center gap-2",
                  "bg-[var(--color-bg-elevated)] border border-[var(--border-default)]",
                  "text-[var(--color-text-primary)]",
                  "hover:bg-[var(--color-bg-card-hover)] transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "whitespace-nowrap"
                )}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    AI 분석
                  </>
                )}
              </button>
            </div>
            {errors.website_url && (
              <p className="mt-1 text-xs text-red-500">{errors.website_url}</p>
            )}
            {analysisError && <p className="mt-1 text-xs text-orange-500">{analysisError}</p>}
            {hasAnalyzed && !analysisError && (
              <p className="mt-1 text-xs text-green-500">
                AI가 정보를 자동으로 채웠습니다. 확인 후 수정하세요.
              </p>
            )}
          </div>

          {/* Name with Logo */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              도구 이름 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3 items-center">
              {/* Logo Preview / Paste Area */}
              <div
                className={cn(
                  "relative w-14 h-14 rounded-lg border-2 border-dashed overflow-hidden flex-shrink-0",
                  isUploadingLogo
                    ? "border-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/10"
                    : "border-[var(--border-default)] bg-[var(--color-bg-card)]",
                  !formData.logo_url && !isUploadingLogo && "flex items-center justify-center"
                )}
                title="이미지를 복사 후 Ctrl+V로 붙여넣기"
              >
                {isUploadingLogo ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--color-claude-coral)]" />
                  </div>
                ) : formData.logo_url ? (
                  <>
                    <Image
                      src={formData.logo_url}
                      alt="Logo preview"
                      fill
                      className="object-contain p-1"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, logo_url: "" }))}
                      className="absolute -top-1 -right-1 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-1">
                    <Clipboard className="w-4 h-4 text-[var(--color-text-muted)] mx-auto" />
                    <span className="text-[8px] text-[var(--color-text-muted)]">Ctrl+V</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="예: Cursor, Supabase, Vercel"
                  className={cn(
                    "w-full px-3 py-2 rounded-lg",
                    "bg-[var(--color-bg-card)] border",
                    "text-[var(--color-text-primary)]",
                    "placeholder:text-[var(--color-text-muted)]",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]",
                    errors.name ? "border-red-500" : "border-[var(--border-default)]"
                  )}
                />
                {logoUploadError && <p className="text-[10px] text-red-500">{logoUploadError}</p>}
                {!formData.logo_url && !logoUploadError && (
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    로고 이미지를 복사하고 Ctrl+V로 붙여넣기
                  </p>
                )}
              </div>
            </div>
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Tagline */}
          <div>
            <label
              htmlFor="tagline"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              한 줄 설명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="tagline"
              name="tagline"
              value={formData.tagline}
              onChange={handleChange}
              maxLength={100}
              placeholder="이 도구가 무엇인지 간단히 설명해주세요"
              className={cn(
                "w-full px-3 py-2 rounded-lg",
                "bg-[var(--color-bg-card)] border",
                "text-[var(--color-text-primary)]",
                "placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]",
                errors.tagline ? "border-red-500" : "border-[var(--border-default)]"
              )}
            />
            <div className="mt-1 flex justify-between">
              {errors.tagline ? <p className="text-xs text-red-500">{errors.tagline}</p> : <span />}
              <span className="text-xs text-[var(--color-text-muted)]">
                {formData.tagline.length}/100
              </span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              카테고리 <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={cn(
                "w-full px-3 py-2 rounded-lg",
                "bg-[var(--color-bg-card)] border",
                "text-[var(--color-text-primary)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]",
                errors.category ? "border-red-500" : "border-[var(--border-default)]"
              )}
            >
              <option value="">카테고리 선택</option>
              {TOOL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                </option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
          </div>

          {/* Pricing Type */}
          <div>
            <label
              htmlFor="pricing_type"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              가격 유형
            </label>
            <select
              id="pricing_type"
              name="pricing_type"
              value={formData.pricing_type}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--border-default)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
            >
              {TOOL_PRICING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PRICING_META[type].label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              상세 설명 <span className="text-[var(--color-text-muted)]">(선택)</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="도구에 대해 더 자세히 설명해주세요. 어떤 문제를 해결하나요? 왜 추천하시나요?"
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)] resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full py-3 rounded-lg",
                "bg-[var(--color-claude-coral)] text-white font-medium",
                "hover:bg-[var(--color-claude-rust)] transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-claude-coral)] focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  추천 중...
                </>
              ) : (
                "도구 추천하기"
              )}
            </button>
          </div>

          {/* Notice */}
          <p className="text-xs text-center text-[var(--color-text-muted)]">
            추천된 도구는 관리자 검토 후 승인됩니다.
            <br />
            당신의 프로필이 추천자로 표시됩니다.
          </p>
        </form>
      </div>
    </main>
  );
}
