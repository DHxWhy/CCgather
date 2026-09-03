#!/usr/bin/env bun
/** assets/badges/masters/<id>.webp (512 마스터) → public/badges/v1/<id>-{96,192,512}.webp. 96/192 = 34px 타일 1x/2x, 192 = 팝오버, 512 = 획득 모달. */
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC_DIR = path.resolve("assets/badges/masters");
const OUT_DIR = path.resolve("public/badges/v1");
const MASTER_PX = 512;
const SIZES = [
  { px: 96, quality: 82 },
  { px: 192, quality: 84 },
  { px: 512, quality: 88 },
] as const;

class BadgeBuildError extends Error {
  constructor(message: string) {
    super(`[build-badges] ${message}`);
    this.name = "BadgeBuildError";
  }
}

async function buildOne(file: string): Promise<number> {
  const id = path.basename(file, path.extname(file));
  if (!/^[a-z0-9_]+$/.test(id)) throw new BadgeBuildError(`invalid badge id in filename: ${file}`);
  const master = sharp(path.join(SRC_DIR, file));
  const meta = await master.metadata();
  if (meta.width !== MASTER_PX || meta.height !== MASTER_PX || !meta.hasAlpha) {
    throw new BadgeBuildError(
      `${file}: master must be ${MASTER_PX}x${MASTER_PX} with alpha (got ${meta.width}x${meta.height}, alpha=${meta.hasAlpha})`
    );
  }
  let bytes = 0;
  for (const { px, quality } of SIZES) {
    const out = path.join(OUT_DIR, `${id}-${px}.webp`);
    const info = await master
      .clone()
      .resize(px, px, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality, effort: 6 })
      .toFile(out);
    bytes += info.size;
  }
  return bytes;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SRC_DIR)).filter((f) => /\.(webp|png)$/i.test(f)).sort();
  if (files.length === 0) throw new BadgeBuildError(`no masters found in ${SRC_DIR}`);
  let total = 0;
  for (const file of files) total += await buildOne(file);
  console.log(
    `[build-badges] ${files.length} badges × ${SIZES.length} sizes → ${OUT_DIR} (${Math.round(total / 1024)} KB)`
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
