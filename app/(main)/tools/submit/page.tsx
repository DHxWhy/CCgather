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
    errors.name = "Tool name is required";
  } else if (data.name.length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  if (!data.website_url.trim()) {
    errors.website_url = "Website URL is required";
  } else {
    try {
      new URL(data.website_url);
    } catch {
      errors.website_url = "Please enter a valid URL";
    }
  }

  if (!data.tagline.trim()) {
    errors.tagline = "Tagline is required";
  } else if (data.tagline.length > 100) {
    errors.tagline = "Tagline must be under 100 characters";
  }

  if (!data.category) {
    errors.category = "Please select a category";
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
    pricing_type: "free",
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
          setLogoUploadError("File size must be under 512KB");
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
            setLogoUploadError(data.error || "Upload failed");
          }
        } catch {
          setLogoUploadError("An error occurred during upload");
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
      setErrors((prev) => ({ ...prev, website_url: "Please enter a URL" }));
      return;
    }

    try {
      new URL(formData.website_url);
    } catch {
      setErrors((prev) => ({ ...prev, website_url: "Please enter a valid URL" }));
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
        setAnalysisError(`This tool is already registered: ${data.existing?.name}`);
        return;
      }

      if (data.error === "analysis_failed") {
        setAnalysisError("URL analysis failed. Please fill in the information manually.");
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
      setAnalysisError(
        error instanceof Error ? error.message : "An error occurred during analysis"
      );
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
          setErrors({ general: data.message || "You don't have permission to submit tools" });
        } else {
          throw new Error(data.error || "Failed to submit tool");
        }
        return;
      }

      setIsSuccess(true);
    } catch (error) {
      console.error("Submit error:", error);
      setErrors({
        general: error instanceof Error ? error.message : "An error occurred during submission",
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
            <span className="text-[var(--color-text-secondary)]">Checking eligibility...</span>
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
            Back to Tools
          </Link>

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
              <Lock className="w-8 h-8 text-[var(--color-text-muted)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              Tool Submission Requirements
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              Meet one of the following requirements to submit tools.
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
                            (Current: Lv.{status.current})
                          </span>
                        )}
                        {req.key === "data_days" && status && "current" in status && (
                          <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
                            (Current: {status.current} days)
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
            You only need to meet one of the above requirements.
          </p>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <Link
              href="/tools"
              className="px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
            >
              Back to Tools
            </Link>
            <Link
              href="/leaderboard"
              className="px-4 py-2 rounded-lg bg-[var(--color-claude-coral)] text-white hover:bg-[var(--color-claude-rust)] transition-colors"
            >
              Level Up
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
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              Submission Complete!
            </h1>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Your tool has been submitted successfully.
              <br />
              It will be listed after admin review.
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
                    sizes="24px"
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
                Back to Tools
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
                    pricing_type: "free",
                    logo_url: "",
                    tags: [],
                  });
                }}
                className="px-4 py-2 rounded-lg bg-[var(--color-claude-coral)] text-white hover:bg-[var(--color-claude-rust)] transition-colors"
              >
                Submit Another
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
            Back to Tools
          </Link>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Submit a Tool</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Share useful developer tools with CCgather users
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
                  sizes="20px"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-[10px]">
                  {eligibility.user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-[var(--color-text-secondary)]">Submitted by:</span>
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
              Website URL <span className="text-red-500">*</span>
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
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    AI Analyze
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
                AI filled in the information. Please review and edit.
              </p>
            )}
          </div>

          {/* Name with Logo */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              Tool Name <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3 items-start">
              {/* Logo Preview / Paste Area */}
              <div className="flex-shrink-0">
                <div
                  className={cn(
                    "relative w-14 h-14 rounded-lg border-2 border-dashed overflow-hidden",
                    isUploadingLogo
                      ? "border-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/10"
                      : "border-[var(--border-default)] bg-[var(--color-bg-card)]",
                    !formData.logo_url && !isUploadingLogo && "flex items-center justify-center"
                  )}
                  title="Copy logo and paste with Ctrl+V"
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
                        sizes="64px"
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
                    </div>
                  )}
                </div>
                {/* Paste hint below logo */}
                <p className="text-[9px] text-[var(--color-text-muted)] text-center mt-1">Ctrl+V</p>
              </div>

              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Cursor, Supabase, Vercel"
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
                {!logoUploadError && (
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    Please attach a square logo image separately
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
              Tagline <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="tagline"
              name="tagline"
              value={formData.tagline}
              onChange={handleChange}
              maxLength={100}
              placeholder="Briefly describe what this tool does"
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

          {/* Category - Tag Style */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {TOOL_CATEGORIES.map((cat) => {
                const isSelected = formData.category === cat;
                const meta = CATEGORY_META[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, category: cat }));
                      if (errors.category) {
                        setErrors((prev) => ({ ...prev, category: undefined }));
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium",
                      "transition-all duration-200",
                      "flex items-center gap-1.5",
                      isSelected
                        ? "bg-[var(--color-claude-coral)]/20 text-[var(--color-claude-coral)] ring-1 ring-[var(--color-claude-coral)]/30"
                        : "bg-[var(--color-bg-card)] border border-[var(--border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                    )}
                  >
                    <span>{meta.emoji}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.category && <p className="mt-2 text-xs text-red-500">{errors.category}</p>}
          </div>

          {/* Pricing Type - Tag Style */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Pricing
            </label>
            <div className="flex flex-wrap gap-2">
              {TOOL_PRICING_TYPES.map((type) => {
                const isSelected = formData.pricing_type === type;
                const meta = PRICING_META[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, pricing_type: type }))}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium",
                      "transition-all duration-200",
                      isSelected
                        ? "bg-[var(--color-claude-coral)]/20 text-[var(--color-claude-coral)] ring-1 ring-[var(--color-claude-coral)]/30"
                        : "bg-[var(--color-bg-card)] border border-[var(--border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                    )}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              Description <span className="text-[var(--color-text-muted)]">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Tell us more about this tool. What problems does it solve? Why do you recommend it?"
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
                  Submitting...
                </>
              ) : (
                "Submit Tool"
              )}
            </button>
          </div>

          {/* Notice */}
          <p className="text-xs text-center text-[var(--color-text-muted)]">
            Submitted tools will be reviewed by admins.
            <br />
            Your profile will be shown as the submitter.
          </p>
        </form>
      </div>
    </main>
  );
}
