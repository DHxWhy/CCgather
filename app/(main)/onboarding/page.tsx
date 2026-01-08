"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ALL_COUNTRIES, TOP_COUNTRIES } from "@/lib/constants/countries";
import { CountryCard } from "@/components/onboarding/CountryCard";
import { CountrySearchPalette } from "@/components/onboarding/CountrySearchPalette";
import { Confetti, SparkleEffect } from "@/components/onboarding/Confetti";
import { Globe2, Users, Trophy, ChevronRight, Sparkles } from "lucide-react";
import ReactCountryFlag from "react-country-flag";

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [step, setStep] = useState<"select" | "confirm">("select");

  const selectedCountryData = useMemo(() => {
    return ALL_COUNTRIES.find((c) => c.code === selectedCountry);
  }, [selectedCountry]);

  const handleSelectCountry = useCallback((code: string) => {
    setSelectedCountry(code);
    setShowConfetti(true);
    setStep("confirm");

    // Reset confetti after animation
    setTimeout(() => setShowConfetti(false), 3000);
  }, []);

  const handleSubmit = async () => {
    if (!selectedCountry) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country_code: selectedCountry,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          onboarding_completed: true,
        }),
      });

      if (response.ok) {
        // Small delay to ensure DB update is committed
        await new Promise((resolve) => setTimeout(resolve, 500));
        router.replace("/leaderboard");
      } else {
        const data = await response.json().catch(() => ({}));
        console.error("Failed to update profile:", response.status, data);
        alert(`Failed to join league (${response.status}): ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert(`Network error: ${error instanceof Error ? error.message : "Connection failed"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setSelectedCountry("");
    setStep("select");
  };

  return (
    <div className="min-h-screen bg-bg-primary relative overflow-hidden">
      {/* Confetti celebration */}
      <Confetti active={showConfetti} />
      <SparkleEffect active={step === "confirm"} />

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Radial gradient glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(218, 119, 86, 0.08) 0%, transparent 50%)",
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(218, 119, 86, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(218, 119, 86, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="pt-8 pb-4 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs sm:text-sm text-text-muted uppercase tracking-wider">
              Step 1 of 1 • Account Setup
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-3"
          >
            Join Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#E8A087]">
              Nation&apos;s League
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-text-muted text-sm sm:text-base max-w-md mx-auto"
          >
            Select your country to join regional leaderboards and track your Claude Code usage with
            developers worldwide.
          </motion.p>
        </header>

        {/* Main area */}
        <div className="flex-1 flex flex-col px-4 pb-8">
          <AnimatePresence mode="wait">
            {step === "select" ? (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col max-w-4xl mx-auto w-full"
              >
                {/* Search */}
                <div className="mb-6">
                  <CountrySearchPalette
                    countries={ALL_COUNTRIES}
                    selectedCountry={selectedCountry}
                    onSelectCountry={handleSelectCountry}
                  />
                </div>

                {/* Recommended Leagues */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-text-secondary">Popular Leagues</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {TOP_COUNTRIES.map((country, index) => (
                      <CountryCard
                        key={country.code}
                        country={country}
                        isSelected={selectedCountry === country.code}
                        onClick={() => handleSelectCountry(country.code)}
                        index={index}
                      />
                    ))}
                  </div>

                  {/* Hint to use search */}
                  <p className="text-center text-xs text-text-muted mt-6">
                    Can&apos;t find your country? Use the search above to find it.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full"
              >
                {/* Selected Country Display */}
                <motion.div
                  className="relative mb-8"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  {/* Glow ring */}
                  <div className="absolute inset-0 -m-6 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 rounded-full blur-2xl animate-pulse" />

                  {/* Flag container */}
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-3xl bg-[var(--color-bg-card)] border border-[var(--border-default)] flex items-center justify-center shadow-2xl">
                    {selectedCountryData && (
                      <ReactCountryFlag
                        countryCode={selectedCountryData.code}
                        svg
                        style={{ width: "80px", height: "60px" }}
                      />
                    )}
                  </div>
                </motion.div>

                <motion.div
                  className="text-center mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">
                    Welcome to{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#E8A087]">
                      {selectedCountryData?.name}
                    </span>
                  </h2>
                  <p className="text-text-muted text-sm sm:text-base">
                    You&apos;re about to join the {selectedCountryData?.name} league!
                  </p>
                </motion.div>

                {/* Action buttons */}
                <motion.div
                  className="flex flex-col gap-3 w-full max-w-xs"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-primary to-[#B85C3D] text-white font-semibold hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <span>Joining...</span>
                      </>
                    ) : (
                      <>
                        <span>Join League</span>
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleBack}
                    className="w-full px-6 py-3 rounded-xl text-text-muted text-sm hover:text-text-secondary transition-colors"
                  >
                    Choose Different Country
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info */}
        <motion.footer
          className="border-t border-white/[0.05] py-4 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span>Global community</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-primary" />
              <span>270+ countries</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span>Real-time rankings</span>
            </div>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}
