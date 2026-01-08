"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { UserProfile } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Globe2,
  Terminal,
  Shield,
  ChevronRight,
  Check,
  Clock,
  AlertCircle,
  Copy,
  RefreshCw,
  Trash2,
  Search,
} from "lucide-react";
import { ALL_COUNTRIES, getCountryByCode } from "@/lib/constants/countries";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "country" | "cli" | "danger";

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [countryChangeRequest, setCountryChangeRequest] = useState<{
    status: "idle" | "pending" | "approved" | "rejected";
    requestedCountry?: string;
    reason?: string;
  }>({ status: "idle" });

  // Get current country from user metadata
  const currentCountryCode = (user?.publicMetadata?.country_code as string) || "";
  const currentCountry = currentCountryCode ? getCountryByCode(currentCountryCode) : undefined;

  if (!isLoaded) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(218, 119, 86, 0.05) 0%, transparent 50%)",
          }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-xs text-primary font-medium tracking-wide uppercase mb-2">Account</p>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-muted mt-1">
            Manage your profile, preferences, and account settings
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:w-64 flex-shrink-0"
          >
            <nav className="space-y-1 lg:sticky lg:top-24">
              <TabButton
                active={activeTab === "profile"}
                onClick={() => setActiveTab("profile")}
                icon={User}
                label="Profile"
                description="Account & security"
              />
              <TabButton
                active={activeTab === "country"}
                onClick={() => setActiveTab("country")}
                icon={Globe2}
                label="Country"
                description="League settings"
                badge={countryChangeRequest.status === "pending" ? "Pending" : undefined}
              />
              <TabButton
                active={activeTab === "cli"}
                onClick={() => setActiveTab("cli")}
                icon={Terminal}
                label="CLI"
                description="Connection setup"
              />
              <TabButton
                active={activeTab === "danger"}
                onClick={() => setActiveTab("danger")}
                icon={Shield}
                label="Danger Zone"
                description="Irreversible actions"
                variant="danger"
              />
            </nav>
          </motion.aside>

          {/* Content Area */}
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 min-w-0"
          >
            <AnimatePresence mode="wait">
              {activeTab === "profile" && <ProfileTab key="profile" user={user} />}
              {activeTab === "country" && (
                <CountryTab
                  key="country"
                  currentCountry={currentCountry}
                  countryChangeRequest={countryChangeRequest}
                  setCountryChangeRequest={setCountryChangeRequest}
                />
              )}
              {activeTab === "cli" && <CLITab key="cli" />}
              {activeTab === "danger" && <DangerTab key="danger" />}
            </AnimatePresence>
          </motion.main>
        </div>
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  description,
  badge,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  description: string;
  badge?: string;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
        active
          ? variant === "danger"
            ? "bg-red-500/10 border border-red-500/20"
            : "bg-primary/10 border border-primary/20"
          : "hover:bg-white/[0.03] border border-transparent"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
          active
            ? variant === "danger"
              ? "bg-red-500/20 text-red-400"
              : "bg-primary/20 text-primary"
            : "bg-white/[0.05] text-text-muted"
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-medium",
              active
                ? variant === "danger"
                  ? "text-red-400"
                  : "text-text-primary"
                : "text-text-secondary"
            )}
          >
            {label}
          </span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted truncate">{description}</p>
      </div>
      <ChevronRight
        className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary" : "text-text-muted")}
      />
    </button>
  );
}

// Profile Tab - Clerk UserProfile Integration
function ProfileTab({ user: _user }: { user: ReturnType<typeof useUser>["user"] }) {
  // _user prop available if needed for custom header/info display
  void _user; // explicitly mark as intentionally unused
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="glass rounded-2xl p-6 overflow-hidden"
    >
      <h2 className="text-lg font-semibold text-text-primary mb-6">Profile & Security</h2>

      {/* Clerk UserProfile with custom appearance */}
      <div className="clerk-profile-wrapper">
        <UserProfile
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-transparent shadow-none p-0 w-full",
              navbar: "hidden",
              navbarMobileMenuRow: "hidden",
              pageScrollBox: "p-0",
              page: "p-0",
              profileSection: "p-0 gap-4",
              profileSectionTitle:
                "text-text-secondary text-sm font-medium pb-2 border-b border-white/[0.05]",
              profileSectionTitleText: "text-text-secondary",
              profileSectionContent: "p-0",
              profileSectionPrimaryButton:
                "bg-primary/10 text-primary hover:bg-primary/20 border-0 rounded-xl",
              formButtonPrimary:
                "bg-gradient-to-r from-primary to-[#B85C3D] hover:opacity-90 rounded-xl",
              formButtonReset: "text-text-muted hover:text-text-primary",
              formFieldInput:
                "bg-white/[0.03] border border-white/[0.08] rounded-xl text-text-primary",
              formFieldLabel: "text-text-secondary",
              userPreviewMainIdentifier: "text-text-primary",
              userPreviewSecondaryIdentifier: "text-text-muted",
              userButtonPopoverCard: "bg-[var(--color-bg-card)] border border-white/[0.08]",
              avatarBox: "w-16 h-16 rounded-xl",
              badge: "bg-primary/20 text-primary",
              accordionTriggerButton: "hover:bg-white/[0.03] rounded-xl",
              accordionContent: "pt-4",
            },
          }}
        />
      </div>
    </motion.div>
  );
}

// Country Tab - With Change Request System
function CountryTab({
  currentCountry,
  countryChangeRequest,
  setCountryChangeRequest,
}: {
  currentCountry: ReturnType<typeof getCountryByCode>;
  countryChangeRequest: {
    status: "idle" | "pending" | "approved" | "rejected";
    requestedCountry?: string;
    reason?: string;
  };
  setCountryChangeRequest: (req: typeof countryChangeRequest) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCountries = searchQuery
    ? ALL_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ALL_COUNTRIES.slice(0, 12);

  const handleSubmitRequest = async () => {
    if (!selectedCountry || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to submit country change request
      // await fetch('/api/country-change-request', {
      //   method: 'POST',
      //   body: JSON.stringify({ newCountry: selectedCountry, reason }),
      // });

      setCountryChangeRequest({
        status: "pending",
        requestedCountry: selectedCountry,
        reason,
      });

      // Reset form
      setSelectedCountry("");
      setReason("");
    } catch (error) {
      console.error("Failed to submit request:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Current Country */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Current League</h2>

        {currentCountry ? (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-4xl">{currentCountry.flag}</span>
            <div>
              <p className="font-semibold text-text-primary">{currentCountry.name}</p>
              <p className="text-sm text-text-muted">{currentCountry.code} League</p>
            </div>
            <div className="ml-auto flex items-center gap-2 text-emerald-400">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Active</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <p className="text-sm">No country selected. Complete onboarding to join a league.</p>
          </div>
        )}
      </div>

      {/* Pending Request Status */}
      {countryChangeRequest.status === "pending" && (
        <div className="glass rounded-2xl p-6 border border-amber-500/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-400">Change Request Pending</h3>
              <p className="text-sm text-text-muted mt-1">
                Your request to change to{" "}
                {getCountryByCode(countryChangeRequest.requestedCountry || "")?.flag}{" "}
                {getCountryByCode(countryChangeRequest.requestedCountry || "")?.name} is being
                reviewed by administrators.
              </p>
              <p className="text-xs text-text-muted mt-2">
                Reason: &quot;{countryChangeRequest.reason}&quot;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Request Country Change */}
      {countryChangeRequest.status !== "pending" && currentCountry && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Request Country Change</h2>
          <p className="text-sm text-text-muted mb-6">
            Country changes require admin approval to prevent abuse. Please provide a valid reason
            for your request.
          </p>

          {/* Country Search */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              New Country
            </label>
            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {filteredCountries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => setSelectedCountry(country.code)}
                  disabled={country.code === currentCountry?.code}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all",
                    country.code === currentCountry?.code
                      ? "opacity-50 cursor-not-allowed bg-white/[0.02]"
                      : selectedCountry === country.code
                        ? "bg-primary/20 border border-primary/30 text-text-primary"
                        : "bg-white/[0.02] hover:bg-white/[0.05] text-text-secondary"
                  )}
                >
                  <span className="text-lg">{country.flag}</span>
                  <span className="truncate">{country.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          {selectedCountry && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4"
            >
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Reason for Change <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., I moved to a new country, I selected the wrong country initially..."
                rows={3}
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 resize-none"
              />
              <p className="text-xs text-text-muted mt-1">
                Please provide a clear reason. Abuse may result in account restrictions.
              </p>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmitRequest}
            disabled={!selectedCountry || !reason.trim() || isSubmitting}
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-[#B85C3D] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Change Request"
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// CLI Tab
function CLITab() {
  const [token, setToken] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateToken = async () => {
    setIsGenerating(true);
    try {
      // TODO: Implement token generation API
      // const res = await fetch('/api/cli/token', { method: 'POST' });
      // const data = await res.json();
      // setToken(data.token);

      // Mock for now
      setToken("ccg_" + Math.random().toString(36).substring(2, 15));
    } catch (error) {
      console.error("Failed to generate token:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-2">CLI Setup</h2>
        <p className="text-sm text-text-muted mb-6">
          Connect your local Claude Code CLI to automatically sync your usage stats.
        </p>

        {/* Installation Command */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            1. Install CLI
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl font-mono text-sm text-text-primary overflow-x-auto">
              npx ccgather-cli setup
            </code>
            <button
              onClick={() => handleCopy("npx ccgather-cli setup")}
              className="p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-text-muted hover:text-text-primary transition-colors"
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Token Generation */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            2. Authentication Token
          </label>
          {token ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl font-mono text-sm text-text-primary">
                {token}
              </code>
              <button
                onClick={() => handleCopy(token)}
                className="p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-text-muted hover:text-text-primary transition-colors"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateToken}
              disabled={isGenerating}
              className="px-6 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-text-primary font-medium transition-colors flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate New Token"
              )}
            </button>
          )}
          <p className="text-xs text-text-muted mt-2">
            Keep this token secure. It provides access to your CCgather account.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// Danger Zone Tab
function DangerTab() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="glass rounded-2xl p-6 border border-red-500/20"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
          <p className="text-sm text-text-muted">These actions are irreversible</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Reset Stats */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-text-primary">Reset Statistics</h3>
              <p className="text-sm text-text-muted">Clear all your usage data and start fresh</p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Delete Account */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-text-primary">Delete Account</h3>
              <p className="text-sm text-text-muted">
                Permanently delete your account and all data
              </p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Loading Skeleton
function SettingsPageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-white/10 rounded w-1/4" />
        <div className="flex gap-6">
          <div className="w-64 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl" />
            ))}
          </div>
          <div className="flex-1">
            <div className="h-96 bg-white/5 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
