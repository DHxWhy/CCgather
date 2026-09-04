#!/usr/bin/env bun
/** BADGES 카탈로그 → public/badges/motion/v1/<id>.json (등급별 Lottie 템플릿, 이미지는 /badges/v1/<id>-512.webp 외부 참조). 실행: bun run build:badge-motion */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BADGES } from "../lib/constants/badges";
import { composeBadgeMotion } from "../lib/badges/motion-composer";

const OUT_DIR = path.resolve("public/badges/motion/v1");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let total = 0;
  for (const badge of BADGES) {
    const json = JSON.stringify(composeBadgeMotion(badge.id, badge.rarity));
    await writeFile(path.join(OUT_DIR, `${badge.id}.json`), json);
    total += json.length;
  }
  console.log(
    `[build-badge-motion] ${BADGES.length} files → ${OUT_DIR} (${Math.round(total / 1024)} KB)`
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
