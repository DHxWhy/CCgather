"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Github,
  Linkedin,
  Globe,
  Check,
  Loader2,
  Trash2,
  CornerDownLeft,
  Mail,
} from "lucide-react";
import { getCountryByCode } from "@/lib/constants/countries";
import { cn } from "@/lib/utils";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { AccountDeleteModal } from "@/components/settings/AccountDeleteModal";

// X (formerly Twitter) icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface SocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
}

export default function SettingsProfilePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [dbCountryCode, setDbCountryCode] = useState<string>("");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [editedLinks, setEditedLinks] = useState<SocialLinks>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<SocialLinks>>({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false); // Track if data is loaded from API
  const socialLinksRef = useRef<SocialLinks>({}); // Ref to access current socialLinks without stale closure

  // Fetch user data from DB
  useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          setDbCountryCode(data.user?.country_code || "");
          // Backend already handles GitHub auto-populate, so we get complete data here
          setSocialLinks(data.user?.social_links || {});
          setEditedLinks(data.user?.social_links || {});
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        // Always mark as loaded (even on failure) to prevent stale state issues
        setIsDataLoaded(true);
      }
    }
    if (isLoaded && user) {
      fetchUserData();
    }
  }, [isLoaded, user]);

  const currentCountryCode = dbCountryCode || (user?.publicMetadata?.country_code as string) || "";
  const currentCountry = currentCountryCode ? getCountryByCode(currentCountryCode) : undefined;
  const githubAccount = user?.externalAccounts?.find((account) => account.provider === "github");

  // Validation
  const validateSocialLink = (key: keyof SocialLinks, value: string): string | null => {
    if (!value || value.trim() === "") return null;
    const trimmed = value.trim();

    switch (key) {
      case "twitter": {
        const usernamePattern = /^[\w]{1,15}$/;
        if (!usernamePattern.test(trimmed)) {
          return "Only letters, numbers, and _ (1-15 chars)";
        }
        break;
      }
      case "linkedin": {
        const usernamePattern = /^[\w-]{3,100}$/;
        if (!usernamePattern.test(trimmed)) {
          return "Only letters, numbers, and - (3+ chars)";
        }
        break;
      }
      case "website": {
        try {
          const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
          new URL(url);
        } catch {
          return "Please enter a valid website URL";
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

  // Keep ref in sync with state to avoid stale closures
  useEffect(() => {
    socialLinksRef.current = socialLinks;
  }, [socialLinks]);

  // Auto-save GitHub from OAuth - Fallback for edge cases where backend couldn't auto-populate
  // Backend /api/me GET already handles this, but client-side Clerk data might have more info
  useEffect(() => {
    const autoSaveGithub = async () => {
      // Wait until data is loaded from API to avoid overwriting existing social links
      if (!isDataLoaded) return;

      // Use ref to get current socialLinks value (avoids stale closure)
      const currentLinks = socialLinksRef.current;
      const githubUsername = githubAccount?.username;

      // Only proceed if we have GitHub OAuth but no github in social links
      if (githubUsername && !currentLinks.github) {
        const newLinks = { ...currentLinks, github: githubUsername };
        setEditedLinks(newLinks);

        try {
          const res = await fetch("/api/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ social_links: newLinks }),
          });
          if (res.ok) {
            setSocialLinks(newLinks);
          }
        } catch (error) {
          console.error("Failed to auto-save GitHub link:", error);
        }
      }
    };
    autoSaveGithub();
  }, [githubAccount?.username, isDataLoaded]);

  const handleSaveSocialLinks = async () => {
    setIsSaving(true);
    try {
      // Normalize website URL before saving
      const normalizedLinks = { ...editedLinks };
      if (normalizedLinks.website && !normalizedLinks.website.startsWith("http")) {
        normalizedLinks.website = `https://${normalizedLinks.website}`;
      }

      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ social_links: normalizedLinks }),
      });
      if (res.ok) {
        setSocialLinks(normalizedLinks);
        setEditedLinks(normalizedLinks);
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
        setSocialLinks(newLinks);
      }
    } catch (error) {
      console.error("Failed to delete social link:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const res = await fetch("/api/me", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete account");
    }
    await signOut();
    router.push("/");
  };

  // Calculate days with CCgather
  const daysWithCCgather = user?.createdAt
    ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  if (!isLoaded || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Profile Card */}
      <section>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Profile</h2>
        <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.fullName || user.username || "Profile"}
              className="w-14 h-14 rounded-xl object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-[#B85C3D] flex items-center justify-center">
              <span className="text-white font-bold text-xl">
                {(user.fullName || user.username || "U").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-[var(--color-text-primary)] truncate">
              {user.fullName || user.username || "Anonymous"}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">@{user.username || "user"}</p>
          </div>
        </div>
      </section>

      {/* Social Links */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Social Links</h2>
          {isSaving && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}
        </div>
        <div className="space-y-2">
          {/* GitHub */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 rounded-lg border",
              githubAccount?.username || editedLinks.github
                ? "bg-green-500/5 border-green-500/20"
                : "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]"
            )}
          >
            <Github
              className={cn(
                "w-4 h-4 flex-shrink-0",
                githubAccount?.username || editedLinks.github
                  ? "text-green-500"
                  : "text-[var(--color-text-muted)]"
              )}
            />
            <span className="hidden sm:inline text-xs text-[var(--color-text-muted)]">
              github.com/
            </span>
            <span className="sm:hidden text-xs text-[var(--color-text-muted)]">@</span>
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
                "flex-1 min-w-0 bg-transparent text-sm focus:outline-none",
                githubAccount?.username || editedLinks.github
                  ? "text-[var(--color-text-primary)] cursor-default"
                  : "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              )}
            />
            {githubAccount?.username ? (
              <span className="text-[10px] text-green-500 flex items-center gap-1 whitespace-nowrap">
                <Check className="w-3 h-3" /> <span className="hidden xs:inline">Connected</span>
              </span>
            ) : editedLinks.github ? (
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : null}
          </div>

          {/* Twitter */}
          <div>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg border",
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
                      : "text-[var(--color-text-muted)]"
                )}
              />
              <span className="hidden sm:inline text-xs text-[var(--color-text-muted)]">
                x.com/
              </span>
              <span className="sm:hidden text-xs text-[var(--color-text-muted)]">@</span>
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
                className="flex-1 min-w-0 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
              />
              {editedLinks.twitter &&
                !errors.twitter &&
                (socialLinks.twitter === editedLinks.twitter ? (
                  <div className="flex items-center gap-1 group/saved">
                    <Check className="w-4 h-4 text-green-500" />
                    <button
                      onClick={() => handleDeleteLink("twitter")}
                      className="p-1 rounded opacity-0 group-hover/saved:opacity-100 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveSocialLinks}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <CornerDownLeft className="w-4 h-4 text-[var(--color-text-muted)]" />
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
                "flex items-center gap-2 px-3 py-2.5 rounded-lg border",
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
                      : "text-[var(--color-text-muted)]"
                )}
              />
              <span className="hidden sm:inline text-xs text-[var(--color-text-muted)]">
                linkedin.com/in/
              </span>
              <span className="sm:hidden text-xs text-[var(--color-text-muted)]">/in/</span>
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
                className="flex-1 min-w-0 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
              />
              {editedLinks.linkedin &&
                !errors.linkedin &&
                (socialLinks.linkedin === editedLinks.linkedin ? (
                  <div className="flex items-center gap-1 group/saved">
                    <Check className="w-4 h-4 text-green-500" />
                    <button
                      onClick={() => handleDeleteLink("linkedin")}
                      className="p-1 rounded opacity-0 group-hover/saved:opacity-100 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveSocialLinks}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <CornerDownLeft className="w-4 h-4 text-[var(--color-text-muted)]" />
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
                "flex items-center gap-2 px-3 py-2.5 rounded-lg border",
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
                      ? "text-emerald-400"
                      : "text-[var(--color-text-muted)]"
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
                className="flex-1 min-w-0 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
              />
              {editedLinks.website &&
                !errors.website &&
                (socialLinks.website === editedLinks.website ? (
                  <div className="flex items-center gap-1 group/saved">
                    <Check className="w-4 h-4 text-green-500" />
                    <button
                      onClick={() => handleDeleteLink("website")}
                      className="p-1 rounded opacity-0 group-hover/saved:opacity-100 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveSocialLinks}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <CornerDownLeft className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </button>
                ))}
            </div>
            {errors.website && (
              <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.website}</p>
            )}
          </div>
        </div>
      </section>

      {/* League Info */}
      {currentCountry && currentCountryCode && (
        <section>
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">League</h2>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
            <FlagIcon countryCode={currentCountryCode} size="md" />
            <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)]">
              {currentCountry.name}
            </span>
            <a
              href={`mailto:ybro0225@gmail.com?subject=[CCgather] Country Change Request&body=Username: ${user?.username || ""}%0AFrom: ${currentCountry.name}%0ATo: `}
              className="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              title="Request country change"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </section>
      )}

      {/* Journey */}
      {user.createdAt && (
        <section>
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Journey</h2>
          <div className="px-4 py-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
            <p className="text-sm text-[var(--color-text-primary)]">
              You&apos;ve been with CCgather for{" "}
              <span className="font-semibold text-[var(--color-claude-coral)]">
                {daysWithCCgather} {daysWithCCgather === 1 ? "day" : "days"}
              </span>
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Member since{" "}
              {new Date(user.createdAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </section>
      )}

      {/* Danger Zone - intentionally pushed down to require scrolling */}
      <section className="mt-16 pt-6 border-t border-[var(--border-default)]">
        <h2 className="text-sm font-medium text-red-400/80 mb-3">Danger Zone</h2>
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-300">Delete Account</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                All data will be deleted (recoverable within 3 days)
              </p>
            </div>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </section>

      {/* Delete Modal */}
      <AccountDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        username={user.username || "user"}
        onConfirmDelete={handleDeleteAccount}
      />
    </div>
  );
}
