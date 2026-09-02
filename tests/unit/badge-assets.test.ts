import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BADGES } from "@/lib/constants/badges";
import { PIN_ASSET_SIZES } from "@/lib/badges/pin-motion";

const PUBLIC_DIR = path.resolve(__dirname, "../../public/badges/v1");
const MASTER_DIR = path.resolve(__dirname, "../../assets/badges/v4");
const SIZES = Array.from(new Set(Object.values(PIN_ASSET_SIZES)));

describe("badge pin assets (build:badges 산출물 ↔ 카탈로그 SSOT)", () => {
  const withImage = BADGES.filter((b) => b.image);

  it("모든 배지가 핀 이미지를 갖는다", () => {
    expect(withImage.length).toBe(BADGES.length);
  });

  it("image 경로는 /badges/v1/<id> 형식이며 id 와 일치한다", () => {
    for (const b of withImage) expect(b.image).toBe(`/badges/v1/${b.id}`);
  });

  it("각 배지의 모든 크기 파일과 마스터가 존재한다", () => {
    const missing: string[] = [];
    for (const b of withImage) {
      for (const px of SIZES) {
        const f = path.join(PUBLIC_DIR, `${b.id}-${px}.webp`);
        if (!existsSync(f)) missing.push(path.basename(f));
      }
      if (!existsSync(path.join(MASTER_DIR, `${b.id}.webp`))) missing.push(`master:${b.id}`);
    }
    expect(missing).toEqual([]);
  });

  it("폐기된 34px 단순화판(-small-) 파일이 남아 있지 않다", () => {
    const stale = readdirSync(PUBLIC_DIR).filter((f) => f.includes("-small-"));
    expect(stale).toEqual([]);
  });
});
