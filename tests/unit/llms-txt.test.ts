import { beforeEach, describe, expect, it, vi } from "vitest";
import { BADGES } from "@/lib/constants/badges";
import { CHANGELOG } from "@/lib/constants/changelog";
import { LEVELS } from "@/lib/constants/levels";
import { SITE_FAQ } from "@/lib/seo/site-facts";
import { buildLlmsFullTxt, buildLlmsTxt, formatBigNumber, type LiveNumbers } from "@/lib/seo/llms";

const live = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/seo/live-numbers", () => ({ getLiveNumbers: live.get }));

import * as llmsRoute from "@/app/llms.txt/route";
import * as llmsFullRoute from "@/app/llms-full.txt/route";

const LIVE: LiveNumbers = {
  asOf: "2026-11-19",
  developers: 296,
  countries: 45,
  tokensAllTime: 7_424_227_228_738,
  tokens30d: 1_459_614_687_101,
};

/** llmstxt.org: one H1, then a blockquote, then body without headings, then H2 file lists */
function sections(text: string) {
  const lines = text.split("\n");
  const firstH2 = lines.findIndex((line) => line.startsWith("## "));
  const body = lines.slice(1, firstH2 === -1 ? lines.length : firstH2);
  const lists = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of lines.slice(firstH2 === -1 ? lines.length : firstH2)) {
    if (line.startsWith("## ")) {
      current = line.slice(3);
      lists.set(current, []);
    } else if (current && line.trim()) {
      lists.get(current)!.push(line);
    }
  }
  return { lines, body, lists };
}

describe("llms.txt 형식 (llmstxt.org)", () => {
  it.each([
    ["숫자 있음", LIVE],
    ["숫자 없음", null],
  ])("H1 하나로 시작하고 바로 인용 요약이 온다 — %s", (_, numbers) => {
    const { lines, body } = sections(buildLlmsTxt(numbers));
    expect(lines[0]).toBe("# CCgather");
    expect(lines.filter((line) => /^# /.test(line))).toHaveLength(1);
    expect(body.find((line) => line.trim())).toMatch(/^> /);
  });

  it("본문(첫 H2 앞)에는 제목이 없다", () => {
    const { body } = sections(buildLlmsTxt(LIVE));
    expect(body.filter((line) => /^#{1,6} /.test(line))).toEqual([]);
  });

  it("H2 아래 줄은 모두 [이름](주소): 설명 꼴의 링크다", () => {
    const { lists } = sections(buildLlmsTxt(LIVE));
    expect(lists.size).toBeGreaterThanOrEqual(3);
    for (const [section, items] of lists) {
      expect(items.length, section).toBeGreaterThan(0);
      for (const item of items) {
        expect(item, section).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)\s]+\)(: \S.*)?$/);
      }
    }
  });

  it("Optional 은 마지막 H2 다", () => {
    const { lists } = sections(buildLlmsTxt(LIVE));
    expect([...lists.keys()].at(-1)).toBe("Optional");
  });
});

describe("llms.txt 내용", () => {
  it("숫자 문단: 누적 · 30일 · 하루 평균 · 가입 수와 기준 날짜", () => {
    const text = buildLlmsTxt(LIVE);
    expect(text).toContain("as of 2026-11-19 UTC");
    expect(text).toContain("Since launch, developers have logged 7.42 trillion Claude Code tokens");
    expect(text).toContain(
      "In the last 30 days they logged 1.46 trillion, about 48.7 billion a day."
    );
    expect(text).toContain("296 developers from 45 countries have joined.");
  });

  it("숫자를 하나도 못 얻으면 숫자 문단을 뺀다", () => {
    const text = buildLlmsTxt(null);
    expect(text).not.toContain("**Live (");
    expect(text).not.toMatch(/trillion|billion/);
  });

  it("얻은 숫자만 쓴다 — 0 이나 빠진 값은 문장째 뺀다", () => {
    const text = buildLlmsTxt({ asOf: "2026-11-19", tokens30d: 1_459_614_687_101 });
    expect(text).toContain("In the last 30 days developers logged 1.46 trillion");
    expect(text).not.toContain("Since launch");
    expect(text).not.toContain("have joined");
    const zero = buildLlmsTxt({
      asOf: "2026-11-19",
      developers: 0,
      countries: 0,
      tokensAllTime: 0,
    });
    expect(zero).not.toContain("**Live (");
  });

  it("왜 만들었는지: 30일 뒤 지워지는 기록과 탐구의 흔적 — 대화 기록을 보관한다고 하지 않는다", () => {
    const text = buildLlmsTxt(null);
    expect(text).toContain(
      "**Why it exists:** Claude Code clears its local logs after about 30 days"
    );
    expect(text).toContain("every token is a trace of the spirit of exploration");
    expect(text).not.toMatch(
      /keeps? (your )?(sessions|conversations|transcripts|session history)/i
    );
  });

  it("최신 업데이트는 What's new 첫 항목에서 가져온다", () => {
    const latest = CHANGELOG[0]!;
    expect(buildLlmsTxt(null)).toContain(`Latest update (${latest.date}): ${latest.title}`);
  });

  it("프로필 주소 규칙과 누적 · 월간 순위 링크가 있다", () => {
    const text = buildLlmsTxt(LIVE);
    expect(text).toContain("`https://ccgather.com/leaderboard?u={GitHub username}`");
    expect(text).toContain("(https://ccgather.com/leaderboard?period=all)");
    expect(text).toContain("(https://ccgather.com/stats#season-sprint)");
  });

  it("숨긴 기능 · 옛 사실 · 비교 문구 · 회원 이름 목록이 없다", () => {
    for (const text of [buildLlmsTxt(LIVE), buildLlmsFullTxt(LIVE)]) {
      expect(text).not.toMatch(/translat/i);
      expect(text).not.toMatch(/\bcommunity\b/i);
      expect(text).not.toMatch(/Rookie|\b27 badges|anonymous|Others|Most Actively Maintained/i);
      expect(text).not.toMatch(/twitter\.com/);
    }
  });

  it("full 판: 배지 수 · 레벨 · FAQ · 최근 업데이트 5개를 SSOT 에서 가져온다", () => {
    const full = buildLlmsFullTxt(LIVE);
    expect(full.split("\n").filter((line) => /^# /.test(line))).toHaveLength(1);
    expect(full).toContain(`${BADGES.length} badges`);
    for (const level of LEVELS) expect(full).toContain(level.name);
    for (const faq of SITE_FAQ) expect(full).toContain(faq.question);
    for (const entry of CHANGELOG.slice(0, 5)) {
      expect(full).toContain(entry.title);
      for (const point of entry.points ?? []) expect(full).toContain(`  - ${point}`);
    }
    expect(full).toContain("as of 2026-11-19 UTC");
    expect(full.length).toBeGreaterThan(buildLlmsTxt(LIVE).length);
  });

  it("큰 수 표기", () => {
    expect(formatBigNumber(7_424_227_228_738)).toBe("7.42 trillion");
    expect(formatBigNumber(1_459_614_687_101)).toBe("1.46 trillion");
    expect(formatBigNumber(48_653_822_903)).toBe("48.7 billion");
    expect(formatBigNumber(950_000_000)).toBe("950 million");
    expect(formatBigNumber(12_345)).toBe("12,345");
  });
});

describe("llms.txt · llms-full.txt 라우트", () => {
  beforeEach(() => live.get.mockReset());

  it.each([
    ["llms.txt", llmsRoute],
    ["llms-full.txt", llmsFullRoute],
  ])("%s: 숫자를 못 얻어도 200 과 text/plain 으로 나간다", async (_, route) => {
    live.get.mockRejectedValueOnce(new Error("db down"));
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const text = await res.text();
    expect(text.startsWith("# CCgather")).toBe(true);
    expect(text).not.toContain("**Live (");
  });

  it.each([
    ["llms.txt", llmsRoute],
    ["llms-full.txt", llmsFullRoute],
  ])("%s: 숫자를 얻으면 넣고, 1시간마다 다시 만든다", async (_, route) => {
    live.get.mockResolvedValueOnce(LIVE);
    const res = await route.GET();
    expect(await res.text()).toContain("7.42 trillion");
    expect(route.revalidate).toBe(3600);
  });
});
