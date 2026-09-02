"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMe } from "@/hooks/use-me";
import { useUserBadgeRows } from "@/hooks/use-user-profile";
import { BADGES } from "@/lib/constants/badges";
import {
  latestEarnedAt,
  readSeenAt,
  selectUnseenBadgeIds,
  writeSeenAt,
} from "@/lib/badges/reveal-queue";
import { BadgeRevealModal } from "@/components/badges/BadgeRevealModal";

export function BadgeRevealTrigger() {
  const { isSignedIn } = useUser();
  const { data: me } = useMe({ enabled: isSignedIn === true });
  const { data: badges } = useUserBadgeRows(me?.id ?? null);
  const [queue, setQueue] = useState<string[]>([]);
  const [consumedFor, setConsumedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!me?.id || !badges || consumedFor === me.id) return;
    setConsumedFor(me.id);
    const seenAt = readSeenAt(window.localStorage);
    if (seenAt === null) {
      writeSeenAt(window.localStorage, latestEarnedAt(badges, new Date().toISOString()));
      return;
    }
    const unseen = selectUnseenBadgeIds(badges, seenAt);
    if (unseen.length > 0) setQueue(unseen);
  }, [me?.id, badges, consumedFor]);

  const advance = useCallback(() => {
    setQueue((q) => {
      const rest = q.slice(1);
      if (rest.length === 0 && badges) {
        writeSeenAt(window.localStorage, latestEarnedAt(badges, new Date().toISOString()));
      }
      return rest;
    });
  }, [badges]);

  const current = queue.length > 0 ? BADGES.find((b) => b.id === queue[0]) : undefined;
  if (!current) return null;

  return <BadgeRevealModal badge={current} remaining={queue.length - 1} onNext={advance} />;
}
