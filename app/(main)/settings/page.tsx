"use client";

import { useState, useEffect, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Github, Linkedin, Globe, Loader2 } from "lucide-react";
import { getCountryByCode } from "@/lib/constants/countries";
import {
  ProfileCard,
  SocialLinkInput,
  LeagueSection,
  JourneySection,
  DangerZone,
  AccountDeleteModal,
  InviteFriendsSection,
} from "@/components/settings";

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

  const [dbCountryCode, setDbCountryCode] = useState<string>("");
  const [dbUsername, setDbUsername] = useState<string>("");
  const [dbDisplayName, setDbDisplayName] = useState<string>("");
  const [dbAvatarUrl, setDbAvatarUrl] = useState<string>("");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [editedLinks, setEditedLinks] = useState<SocialLinks>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingGithub, setIsSyncingGithub] = useState(false);
  const [errors, setErrors] = useState<Partial<SocialLinks>>({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [hideProfileOnInvite, setHideProfileOnInvite] = useState<boolean>(false);
  const socialLinksRef = useRef<SocialLinks>({});

  // Fetch user data from DB
  useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          setDbCountryCode(data.user?.country_code || "");
          setDbUsername(data.user?.username || "");
          setDbDisplayName(data.user?.display_name || "");
          setDbAvatarUrl(data.user?.avatar_url || "");
          setSocialLinks(data.user?.social_links || {});
          setEditedLinks(data.user?.social_links || {});
          setReferralCode(data.user?.referral_code || null);
          setReferralCount(data.user?.referral_count || 0);
          setHideProfileOnInvite(data.user?.hide_profile_on_invite || false);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
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

  // Keep ref in sync with state
  useEffect(() => {
    socialLinksRef.current = socialLinks;
  }, [socialLinks]);

  // Auto-save GitHub from OAuth
  useEffect(() => {
    const autoSaveGithub = async () => {
      if (!isDataLoaded) return;
      const currentLinks = socialLinksRef.current;
      const githubUsername = githubAccount?.username;

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

  const handleToggleHideProfile = async (value: boolean) => {
    setHideProfileOnInvite(value);
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hide_profile_on_invite: value }),
      });
    } catch (error) {
      console.error("Failed to update hide profile setting:", error);
      setHideProfileOnInvite(!value); // Revert on error
    }
  };

  const handleDeleteAccount = async () => {
    const res = await fetch("/api/me", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete account");
    }
    signOut({ redirectUrl: "/" });
  };

  const handleSyncGithub = async () => {
    setIsSyncingGithub(true);
    try {
      const res = await fetch("/api/me/sync-github", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.synced) {
        // Update local state with new values (use functional updates to avoid stale closure)
        if (data.profile) {
          if (data.profile.username) setDbUsername(data.profile.username);
          if (data.profile.display_name) setDbDisplayName(data.profile.display_name);
          if (data.profile.avatar_url) setDbAvatarUrl(data.profile.avatar_url);
          // Also update social links if GitHub username changed
          if (data.profile.username) {
            setSocialLinks((prev) => ({ ...prev, github: data.profile.username }));
            setEditedLinks((prev) => ({ ...prev, github: data.profile.username }));
          }
        }
        alert("Profile synced from GitHub!");
      } else if (res.ok && !data.synced) {
        alert("Profile is already up to date.");
      } else {
        alert(data.error || "Failed to sync from GitHub");
      }
    } catch (error) {
      console.error("Failed to sync from GitHub:", error);
      alert("Failed to sync from GitHub");
    } finally {
      setIsSyncingGithub(false);
    }
  };

  if (!isLoaded || !user || !isDataLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Profile Card - Use DB data, with GitHub sync */}
      <ProfileCard
        imageUrl={dbAvatarUrl || user.imageUrl}
        fullName={dbDisplayName || user.fullName}
        username={dbUsername || user.username}
        onSync={handleSyncGithub}
        isSyncing={isSyncingGithub}
      />

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
          <SocialLinkInput
            icon={<Github className="w-4 h-4" />}
            prefix="github.com/"
            prefixMobile="@"
            placeholder="username"
            value={githubAccount?.username || editedLinks.github || ""}
            savedValue={githubAccount?.username || socialLinks.github}
            isReadOnly={!!githubAccount?.username}
            isConnected={!!githubAccount?.username}
            onChange={
              githubAccount?.username
                ? undefined
                : (v) => setEditedLinks((prev) => ({ ...prev, github: v }))
            }
            onSave={handleSaveSocialLinks}
          />

          {/* Twitter */}
          <SocialLinkInput
            icon={<XIcon className="w-4 h-4" />}
            prefix="x.com/"
            prefixMobile="@"
            placeholder="username"
            value={editedLinks.twitter || ""}
            savedValue={socialLinks.twitter}
            error={errors.twitter}
            onChange={(v) => handleLinkChange("twitter", v.replace(/^@/, ""))}
            onSave={handleSaveSocialLinks}
            onDelete={() => handleDeleteLink("twitter")}
          />

          {/* LinkedIn */}
          <SocialLinkInput
            icon={<Linkedin className="w-4 h-4" />}
            prefix="linkedin.com/in/"
            prefixMobile="/in/"
            placeholder="username"
            value={editedLinks.linkedin || ""}
            savedValue={socialLinks.linkedin}
            error={errors.linkedin}
            onChange={(v) => handleLinkChange("linkedin", v)}
            onSave={handleSaveSocialLinks}
            onDelete={() => handleDeleteLink("linkedin")}
          />

          {/* Website */}
          <SocialLinkInput
            icon={<Globe className="w-4 h-4" />}
            placeholder="https://example.com"
            value={editedLinks.website || ""}
            savedValue={socialLinks.website}
            error={errors.website}
            onChange={(v) => handleLinkChange("website", v)}
            onSave={handleSaveSocialLinks}
            onDelete={() => handleDeleteLink("website")}
          />
        </div>
      </section>

      {/* Invite Friends */}
      {referralCode && (
        <InviteFriendsSection
          referralCode={referralCode}
          referralCount={referralCount}
          hideProfileOnInvite={hideProfileOnInvite}
          onToggleHideProfile={handleToggleHideProfile}
        />
      )}

      {/* League Info */}
      {currentCountry && currentCountryCode && (
        <LeagueSection
          countryCode={currentCountryCode}
          country={currentCountry}
          username={user.username}
        />
      )}

      {/* Journey */}
      {user.createdAt && <JourneySection createdAt={user.createdAt} />}

      {/* Danger Zone */}
      <DangerZone onDeleteClick={() => setIsDeleteModalOpen(true)} />

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
