"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Activity,
  ChevronRight,
  Calendar,
  LogOut,
  Mail,
  Github,
  Linkedin,
  Globe,
  Check,
  Loader2,
  Trash2,
  CornerDownLeft,
} from "lucide-react";
import { getCountryByCode } from "@/lib/constants/countries";
import { cn } from "@/lib/utils";

// X (formerly Twitter) icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

type SettingsTab = "profile" | "activity";

interface SocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [dbCountryCode, setDbCountryCode] = useState<string>("");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});

  // Close on escape key
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

  // Fetch user data from Supabase DB
  useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          setDbCountryCode(data.user?.country_code || "");
          setSocialLinks(data.user?.social_links || {});
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      }
    }
    if (isOpen && isLoaded && user) {
      fetchUserData();
    }
  }, [isOpen, isLoaded, user]);

  const currentCountryCode = dbCountryCode || (user?.publicMetadata?.country_code as string) || "";
  const currentCountry = currentCountryCode ? getCountryByCode(currentCountryCode) : undefined;

  if (!isOpen) return null;

  const handleSignOut = async () => {
    onClose();
    await signOut();
    router.push("/");
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 pointer-events-none">
        <motion.div
          className="pointer-events-auto w-full h-full md:h-auto md:max-w-4xl md:max-h-[85vh] bg-[var(--color-bg-secondary)] md:border border-[var(--border-default)] md:rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Header */}
          <div
            className="md:hidden flex items-center justify-between p-4 border-b border-[var(--border-default)]"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
          >
            <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Tab Navigation */}
          <div className="md:hidden flex items-center gap-1 px-4 py-2 border-b border-[var(--border-default)] overflow-x-auto">
            <MobileTabButton
              active={activeTab === "profile"}
              onClick={() => setActiveTab("profile")}
              icon={User}
              label="Profile"
            />
            <MobileTabButton
              active={activeTab === "activity"}
              onClick={() => setActiveTab("activity")}
              icon={Activity}
              label="Activity"
            />
          </div>

          {/* Desktop Sidebar */}
          <div className="hidden md:flex w-56 bg-white/[0.02] border-r border-[var(--border-default)] flex-col">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-default)]">
              <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
              <SidebarButton
                active={activeTab === "profile"}
                onClick={() => setActiveTab("profile")}
                icon={User}
                label="Profile"
              />
              <SidebarButton
                active={activeTab === "activity"}
                onClick={() => setActiveTab("activity")}
                icon={Activity}
                label="Activity"
              />
            </nav>

            {/* Sign Out */}
            <div className="p-2 border-t border-[var(--border-default)]">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Desktop Close Button */}
            <div className="hidden md:flex justify-end p-3 border-b border-[var(--border-default)]">
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 md:min-h-[400px]">
              <AnimatePresence mode="wait">
                {!isLoaded ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    {activeTab === "profile" && (
                      <ProfileContent
                        key="profile"
                        currentCountry={currentCountry}
                        onSignOut={handleSignOut}
                        socialLinks={socialLinks}
                        onSocialLinksChange={setSocialLinks}
                      />
                    )}
                    {activeTab === "activity" && <ActivityContent key="activity" />}
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

// Mobile Tab Button
function MobileTabButton({
  active,
  onClick,
  icon: Icon,
  label,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
        active
          ? variant === "danger"
            ? "bg-red-500/10 text-red-400"
            : "bg-primary/10 text-text-primary"
          : variant === "danger"
            ? "text-text-muted hover:text-red-400"
            : "text-text-muted hover:text-text-primary"
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

// Sidebar Button
function SidebarButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  badge?: string;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm",
        active
          ? variant === "danger"
            ? "bg-red-500/10 text-red-400"
            : "bg-primary/10 text-text-primary"
          : variant === "danger"
            ? "text-text-muted hover:text-red-400 hover:bg-red-500/5"
            : "text-text-muted hover:text-text-primary hover:bg-white/[0.03]"
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1 font-medium">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
          {badge}
        </span>
      )}
      {active && <ChevronRight className="w-4 h-4 opacity-50" />}
    </button>
  );
}

// Profile Content
function ProfileContent({
  currentCountry,
  onSignOut,
  socialLinks,
  onSocialLinksChange,
}: {
  currentCountry?: ReturnType<typeof getCountryByCode>;
  onSignOut: () => void;
  socialLinks: SocialLinks;
  onSocialLinksChange: (links: SocialLinks) => void;
}) {
  const { user } = useUser();
  const [editedLinks, setEditedLinks] = useState<SocialLinks>(socialLinks);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<SocialLinks>>({});

  // Validation functions
  const validateSocialLink = (key: keyof SocialLinks, value: string): string | null => {
    if (!value || value.trim() === "") return null;

    const trimmed = value.trim();

    switch (key) {
      case "twitter": {
        // Only allow valid username (alphanumeric and underscore)
        const usernamePattern = /^[\w]{1,15}$/;
        if (!usernamePattern.test(trimmed)) {
          return "영문, 숫자, _ 만 사용 (1-15자)";
        }
        break;
      }
      case "linkedin": {
        // Only allow valid username (alphanumeric, hyphen)
        const usernamePattern = /^[\w-]{3,100}$/;
        if (!usernamePattern.test(trimmed)) {
          return "영문, 숫자, - 만 사용 (3자 이상)";
        }
        break;
      }
      case "website": {
        // Must be a valid URL
        try {
          const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
          new URL(url);
        } catch {
          return "유효한 웹사이트 URL을 입력해주세요";
        }
        break;
      }
    }
    return null;
  };

  const handleLinkChange = (key: keyof SocialLinks, value: string) => {
    setEditedLinks((prev) => ({ ...prev, [key]: value }));
    const error = validateSocialLink(key, value);
    setErrors((prev) => ({ ...prev, [key]: error || undefined }));
  };

  // Sync editedLinks when socialLinks changes
  useEffect(() => {
    setEditedLinks(socialLinks);
    setErrors({});
  }, [socialLinks]);

  const githubAccount = user?.externalAccounts?.find((account) => account.provider === "github");

  // Auto-fill and auto-save GitHub from connected account if not set in DB
  useEffect(() => {
    const autoSaveGithub = async () => {
      if (githubAccount?.username && !socialLinks.github) {
        const newLinks = { ...socialLinks, github: githubAccount.username };
        setEditedLinks(newLinks);

        // Auto-save to database
        try {
          const res = await fetch("/api/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ social_links: newLinks }),
          });
          if (res.ok) {
            onSocialLinksChange(newLinks);
          }
        } catch (error) {
          console.error("Failed to auto-save GitHub link:", error);
        }
      }
    };
    autoSaveGithub();
  }, [githubAccount?.username, socialLinks.github]);

  const handleSaveSocialLinks = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ social_links: editedLinks }),
      });
      if (res.ok) {
        onSocialLinksChange(editedLinks);
      }
    } catch (error) {
      console.error("Failed to save social links:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLink = async (key: keyof SocialLinks) => {
    const newLinks = { ...editedLinks, [key]: "" };
    setEditedLinks(newLinks);
    setErrors((prev) => ({ ...prev, [key]: undefined }));

    setIsSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ social_links: newLinks }),
      });
      if (res.ok) {
        onSocialLinksChange(newLinks);
      }
    } catch (error) {
      console.error("Failed to delete social link:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-6"
    >
      <h3 className="text-lg font-semibold text-text-primary">Profile</h3>

      {/* Profile Card */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={user.fullName || user.username || "Profile"}
            className="w-16 h-16 rounded-lg object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary to-[#B85C3D] flex items-center justify-center">
            <span className="text-white font-bold text-2xl">
              {(user.fullName || user.username || "U").charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1">
          <p className="text-lg font-semibold text-text-primary">
            {user.fullName || user.username || "Anonymous"}
          </p>
          <p className="text-sm text-text-muted">@{user.username || "user"}</p>
        </div>
      </div>

      {/* Social Links */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-text-secondary">Social Links</h4>
          {isSaving && (
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <Loader2 className="w-3 h-3 animate-spin" /> 저장 중...
            </span>
          )}
        </div>
        <div className="space-y-2">
          {/* GitHub - Read-only if connected via OAuth */}
          <div
            className={cn(
              "flex items-center gap-2 p-2.5 rounded-lg border",
              githubAccount?.username || editedLinks.github
                ? "bg-green-500/5 border-green-500/20"
                : "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]"
            )}
          >
            <Github
              className={cn(
                "w-4 h-4 flex-shrink-0",
                githubAccount?.username || editedLinks.github ? "text-green-500" : "text-text-muted"
              )}
            />
            <span className="text-xs text-text-muted">github.com/</span>
            <input
              type="text"
              placeholder="username"
              value={githubAccount?.username || editedLinks.github || ""}
              onChange={
                githubAccount?.username
                  ? undefined
                  : (e) => setEditedLinks((prev) => ({ ...prev, github: e.target.value }))
              }
              readOnly={!!githubAccount?.username}
              className={cn(
                "flex-1 bg-transparent text-sm focus:outline-none",
                githubAccount?.username || editedLinks.github
                  ? "text-text-primary cursor-default"
                  : "text-text-primary placeholder:text-text-muted"
              )}
            />
            {githubAccount?.username ? (
              <span className="text-[10px] text-green-500 flex items-center gap-1 whitespace-nowrap">
                <Check className="w-3 h-3" /> OAuth 연결됨
              </span>
            ) : editedLinks.github ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : null}
          </div>
          {/* X (formerly Twitter) */}
          <div>
            <div
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-lg border",
                errors.twitter
                  ? "bg-red-500/5 border-red-500/30"
                  : socialLinks.twitter && editedLinks.twitter === socialLinks.twitter
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]"
              )}
            >
              <XIcon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  errors.twitter
                    ? "text-red-500"
                    : socialLinks.twitter && editedLinks.twitter === socialLinks.twitter
                      ? "text-green-500"
                      : "text-text-muted"
                )}
              />
              <span className="text-xs text-text-muted">x.com/</span>
              <input
                type="text"
                placeholder="username"
                value={editedLinks.twitter || ""}
                onChange={(e) => handleLinkChange("twitter", e.target.value.replace(/^@/, ""))}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !errors.twitter &&
                  editedLinks.twitter &&
                  handleSaveSocialLinks()
                }
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              {editedLinks.twitter &&
                !errors.twitter &&
                (socialLinks.twitter === editedLinks.twitter ? (
                  <div className="flex items-center gap-1 group/saved">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    <button
                      onClick={() => handleDeleteLink("twitter")}
                      className="p-0.5 rounded opacity-0 group-hover/saved:opacity-100 hover:bg-red-500/20 transition-all"
                      title="삭제"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveSocialLinks}
                    className="p-0.5 rounded hover:bg-white/10 transition-colors"
                    title="Enter로 저장"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                ))}
            </div>
            {errors.twitter && (
              <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.twitter}</p>
            )}
          </div>
          {/* LinkedIn */}
          <div>
            <div
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-lg border",
                errors.linkedin
                  ? "bg-red-500/5 border-red-500/30"
                  : socialLinks.linkedin && editedLinks.linkedin === socialLinks.linkedin
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]"
              )}
            >
              <Linkedin
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  errors.linkedin
                    ? "text-red-500"
                    : socialLinks.linkedin && editedLinks.linkedin === socialLinks.linkedin
                      ? "text-[#0A66C2]"
                      : "text-text-muted"
                )}
              />
              <span className="text-xs text-text-muted">linkedin.com/in/</span>
              <input
                type="text"
                placeholder="username"
                value={editedLinks.linkedin || ""}
                onChange={(e) => handleLinkChange("linkedin", e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !errors.linkedin &&
                  editedLinks.linkedin &&
                  handleSaveSocialLinks()
                }
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              {editedLinks.linkedin &&
                !errors.linkedin &&
                (socialLinks.linkedin === editedLinks.linkedin ? (
                  <div className="flex items-center gap-1 group/saved">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    <button
                      onClick={() => handleDeleteLink("linkedin")}
                      className="p-0.5 rounded opacity-0 group-hover/saved:opacity-100 hover:bg-red-500/20 transition-all"
                      title="삭제"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveSocialLinks}
                    className="p-0.5 rounded hover:bg-white/10 transition-colors"
                    title="Enter로 저장"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                ))}
            </div>
            {errors.linkedin && (
              <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.linkedin}</p>
            )}
          </div>
          {/* Website */}
          <div>
            <div
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-lg border",
                errors.website
                  ? "bg-red-500/5 border-red-500/30"
                  : socialLinks.website && editedLinks.website === socialLinks.website
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]"
              )}
            >
              <Globe
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  errors.website
                    ? "text-red-500"
                    : socialLinks.website && editedLinks.website === socialLinks.website
                      ? "text-[var(--color-claude-coral)]"
                      : "text-text-muted"
                )}
              />
              <input
                type="url"
                placeholder="https://example.com"
                value={editedLinks.website || ""}
                onChange={(e) => handleLinkChange("website", e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !errors.website &&
                  editedLinks.website &&
                  handleSaveSocialLinks()
                }
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              {editedLinks.website &&
                !errors.website &&
                (socialLinks.website === editedLinks.website ? (
                  <div className="flex items-center gap-1 group/saved">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    <button
                      onClick={() => handleDeleteLink("website")}
                      className="p-0.5 rounded opacity-0 group-hover/saved:opacity-100 hover:bg-red-500/20 transition-all"
                      title="삭제"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveSocialLinks}
                    className="p-0.5 rounded hover:bg-white/10 transition-colors"
                    title="Enter로 저장"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                ))}
            </div>
            {errors.website && (
              <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.website}</p>
            )}
          </div>
        </div>
      </div>

      {/* League Info */}
      {currentCountry && (
        <div>
          <h4 className="text-sm font-medium text-text-secondary mb-3">League</h4>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
            <span className="text-2xl">{currentCountry.flag}</span>
            <span className="flex-1 font-medium text-text-primary">{currentCountry.name}</span>
            <a
              href={`mailto:ybro0225@gmail.com?subject=[CCgather] Country Change Request&body=Username: ${user?.username || ""}%0AFrom: ${currentCountry.name}%0ATo: `}
              className="p-1.5 rounded hover:bg-[var(--color-bg-secondary)] text-text-muted hover:text-text-secondary transition-colors"
              title="Request country change"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Member Since */}
      <div>
        <h4 className="text-sm font-medium text-text-secondary mb-3">Account Info</h4>
        <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted">Member since</span>
            <span className="text-sm text-text-primary">
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Unknown"}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Sign Out */}
      <div className="md:hidden pt-4">
        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </motion.div>
  );
}

// Activity Content
function ActivityContent() {
  const [history, setHistory] = useState<{ date: string; tokens: number; cost: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const meRes = await fetch("/api/me");
        if (!meRes.ok) throw new Error("Failed to fetch user");
        const meData = await meRes.json();
        const userId = meData.user?.id;
        if (!userId) throw new Error("User ID not found");

        const historyRes = await fetch(`/api/users/${userId}/history?days=30`);
        if (!historyRes.ok) throw new Error("Failed to fetch history");
        const historyData = await historyRes.json();
        setHistory(historyData.history || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setIsLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
    >
      <h3 className="text-lg font-semibold text-text-primary mb-2">Submission History</h3>
      <p className="text-sm text-text-muted mb-4">Your daily usage data (last 30 days)</p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-50" />
          <p className="text-text-muted text-sm">No submission history yet</p>
          <p className="text-text-muted text-xs mt-1">
            Run <code className="text-primary">npx ccgather</code> to submit
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {history
            .slice()
            .reverse()
            .map((entry) => (
              <div
                key={entry.date}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {formatDate(entry.date)}
                    </p>
                    <p className="text-xs text-text-muted">{entry.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {formatNumber(entry.tokens)}
                    </p>
                    <p className="text-xs text-text-muted">tokens</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-400">${entry.cost.toFixed(2)}</p>
                    <p className="text-xs text-text-muted">cost</p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </motion.div>
  );
}

export default SettingsModal;
