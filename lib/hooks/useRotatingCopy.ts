"use client";

import { useEffect, useState } from "react";
import { pickRandom } from "@/lib/constants/seasonCopy";

export function useRotatingCopy<T>(pool: readonly T[]): T {
  const [copy, setCopy] = useState<T>(pool[0]!);
  useEffect(() => {
    setCopy(pickRandom(pool));
  }, [pool]);
  return copy;
}
