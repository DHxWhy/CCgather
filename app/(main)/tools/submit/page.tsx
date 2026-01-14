"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ExternalLink, CheckCircle } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  TOOL_CATEGORIES,
  TOOL_PRICING_TYPES,
  CATEGORY_META,
  PRICING_META,
  type ToolCategory,
  type ToolPricingType,
  type ToolSubmitFormData,
  type ToolSubmitFormErrors,
} from "@/types/tools";

// =====================================================
// Form Validation
// =====================================================

function validateForm(data: ToolSubmitFormData): ToolSubmitFormErrors {
  const errors: ToolSubmitFormErrors = {};

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
// Component
// =====================================================

export default function ToolSubmitPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const [formData, setFormData] = useState<ToolSubmitFormData>({
    name: "",
    website_url: "",
    tagline: "",
    description: "",
    category: "" as ToolCategory,
    pricing_type: "free",
    logo_url: "",
  });

  const [errors, setErrors] = useState<ToolSubmitFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
    if (errors[name as keyof ToolSubmitFormErrors]) {
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit tool");
      }

      setIsSuccess(true);
    } catch (error) {
      console.error("Submit error:", error);
      setErrors({
        name: error instanceof Error ? error.message : "제출 중 오류가 발생했습니다",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success State
  if (isSuccess) {
    return (
      <main className="min-h-screen bg-[var(--color-bg-primary)]">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">제출 완료!</h1>
            <p className="text-[var(--color-text-secondary)] mb-6">
              도구가 성공적으로 제출되었습니다.
              <br />
              관리자 검토 후 승인되면 목록에 표시됩니다.
            </p>
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
                  setFormData({
                    name: "",
                    website_url: "",
                    tagline: "",
                    description: "",
                    category: "" as ToolCategory,
                    pricing_type: "free",
                    logo_url: "",
                  });
                }}
                className="px-4 py-2 rounded-lg bg-[var(--color-claude-coral)] text-white hover:bg-[var(--color-claude-rust)] transition-colors"
              >
                다른 도구 제출
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
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">도구 제출하기</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            유용한 개발 도구를 커뮤니티와 공유하세요
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              도구 이름 <span className="text-red-500">*</span>
            </label>
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
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Website URL */}
          <div>
            <label
              htmlFor="website_url"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              웹사이트 URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="url"
                id="website_url"
                name="website_url"
                value={formData.website_url}
                onChange={handleChange}
                placeholder="https://example.com"
                className={cn(
                  "w-full px-3 py-2 pr-10 rounded-lg",
                  "bg-[var(--color-bg-card)] border",
                  "text-[var(--color-text-primary)]",
                  "placeholder:text-[var(--color-text-muted)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]",
                  errors.website_url ? "border-red-500" : "border-[var(--border-default)]"
                )}
              />
              {formData.website_url && (
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
            {errors.website_url && (
              <p className="mt-1 text-xs text-red-500">{errors.website_url}</p>
            )}
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

          {/* Logo URL */}
          <div>
            <label
              htmlFor="logo_url"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              로고 URL <span className="text-[var(--color-text-muted)]">(선택)</span>
            </label>
            <input
              type="url"
              id="logo_url"
              name="logo_url"
              value={formData.logo_url}
              onChange={handleChange}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              비어있으면 자동으로 파비콘을 가져옵니다
            </p>
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
                  제출 중...
                </>
              ) : (
                "도구 제출하기"
              )}
            </button>
          </div>

          {/* Notice */}
          <p className="text-xs text-center text-[var(--color-text-muted)]">
            제출된 도구는 관리자 검토 후 승인됩니다.
            <br />
            신뢰도 높은 사용자의 제출은 우선 검토됩니다.
          </p>
        </form>
      </div>
    </main>
  );
}
