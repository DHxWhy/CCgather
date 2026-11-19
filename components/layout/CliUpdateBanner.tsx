"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useMe } from "@/hooks/use-me";
import { CliUpdateNotice } from "@/components/layout/CliUpdateNotice";
import {
  CLI_UPDATE_DISMISS_KEY,
  parseDismissal,
  shouldShowCliUpdate,
  type CliStatus,
  type CliUpdateDismissal,
} from "@/lib/cli/update-notice";

async function fetchCliStatus(): Promise<CliStatus | null> {
  try {
    const response = await fetch("/api/me/cli-status", { cache: "no-store" });
    return response.ok ? ((await response.json()) as CliStatus) : null;
  } catch {
    return null;
  }
}

function readDismissal(): CliUpdateDismissal | null {
  try {
    return parseDismissal(window.localStorage.getItem(CLI_UPDATE_DISMISS_KEY));
  } catch {
    return null;
  }
}

function saveDismissal(dismissal: CliUpdateDismissal): void {
  try {
    window.localStorage.setItem(CLI_UPDATE_DISMISS_KEY, JSON.stringify(dismissal));
  } catch {
    return;
  }
}

export function CliUpdateBanner() {
  const { isSignedIn } = useUser();
  const { data: me } = useMe({ enabled: isSignedIn === true });
  const { data: status } = useQuery({
    queryKey: ["me", "cli-status"],
    queryFn: fetchCliStatus,
    enabled: Boolean(me),
    staleTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [dismissal, setDismissal] = useState<CliUpdateDismissal | null | undefined>(undefined);
  const [openedAt, setOpenedAt] = useState(0);

  useEffect(() => {
    setDismissal(readDismissal());
    setOpenedAt(Date.now());
  }, []);

  const version = status?.version;
  if (dismissal === undefined || !version || !shouldShowCliUpdate(status, dismissal, openedAt)) {
    return null;
  }

  const dismiss = () => {
    const next = { version, at: Date.now() };
    saveDismissal(next);
    setDismissal(next);
  };

  return <CliUpdateNotice version={version} onDismiss={dismiss} />;
}
