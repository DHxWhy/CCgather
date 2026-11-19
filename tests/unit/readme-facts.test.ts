import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BADGES } from "@/lib/constants/badges";
import { LEVELS } from "@/lib/constants/levels";
import { formatTokenThreshold } from "@/lib/seo/site-facts";

const root = join(__dirname, "../..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const readme = read("README.md");
const npmReadme = read("packages/cli/README.md");
const cliIndex = read("packages/cli/src/index.ts");

describe("README 가 코드와 같은 사실을 말한다", () => {
  it("배지 수와 분류 수는 배지 정의와 같다", () => {
    const categories = new Set(BADGES.map((badge) => badge.category)).size;
    expect(readme).toContain(`${BADGES.length} badges in ${categories} categories`);
  });

  it("레벨 표는 화면이 쓰는 레벨 정의(이름 · 아이콘 · 시작 토큰)와 같다", () => {
    // 포매터가 표 칸을 공백으로 맞추므로 칸 사이 공백은 가리지 않는다
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const level of LEVELS) {
      const from = formatTokenThreshold(level.minTokens);
      const row = [String(level.level), level.icon, level.name, from]
        .map(escape)
        .join("\\s*\\|\\s*");
      expect(readme, level.name).toMatch(new RegExp(`\\|\\s*${row}\\s*\\|`));
    }
  });

  it("숨긴 커뮤니티 · 옛 숫자 · 비교표 · 자리표시 글자가 없다", () => {
    for (const text of [readme, npmReadme]) {
      expect(text).not.toMatch(/translat/i);
      expect(text).not.toMatch(/community\.gif|Hall of Fame posts/);
      expect(text).not.toMatch(/\b27 badges|Rookie|anonymous/i);
      expect(text).not.toMatch(/\|\s*Others\s*\|/);
      expect(text).not.toMatch(/<sub>📎/);
    }
  });

  it("README 가 가리키는 저장소 그림은 모두 있고, 가볍다", () => {
    const paths = [...readme.matchAll(/\]\((assets\/[^)\s]+)\)|src="(assets\/[^"]+)"/g)].map(
      (m) => m[1] ?? m[2]!
    );
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(existsSync(join(root, path)), path).toBe(true);
      expect(statSync(join(root, path)).size, path).toBeLessThan(1_000_000);
    }
  });

  it("README 와 npm README 의 CLI 명령은 CLI 에 실제로 있다", () => {
    expect(cliIndex).toContain('.command("submit")');
    expect(cliIndex).toContain('.command("autosubmit")');
    for (const sub of ["on", "off", "status"]) expect(cliIndex).toContain(`.command("${sub}")`);
    for (const text of [readme, npmReadme]) {
      expect(text).toContain("npx ccgather@latest");
      expect(text).toContain("autosubmit on");
    }
  });
});
