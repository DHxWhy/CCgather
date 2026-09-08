import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHANGELOG,
  CHANGELOG_CATEGORY,
  CHANGELOG_LATEST_ID,
  hasUnseenUpdate,
  readSeenId,
  WHATS_NEW_SEEN_KEY,
} from "@/lib/constants/changelog";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../", p), "utf-8");

describe("변경 이력 데이터", () => {
  it("최신순으로 정렬돼 있고 최신 id 가 첫 항목이다", () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(CHANGELOG_LATEST_ID).toBe(CHANGELOG[0]!.id);
  });

  it("id 는 중복되지 않는다 (열람 표시가 엉키지 않도록)", () => {
    expect(new Set(CHANGELOG.map((e) => e.id)).size).toBe(CHANGELOG.length);
  });

  it("날짜는 YYYY-MM-DD 이고 미래가 아니다", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const entry of CHANGELOG) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.date <= today).toBe(true);
    }
  });

  it("분류는 카테고리 SSOT 에 있는 값만 쓴다", () => {
    for (const entry of CHANGELOG) {
      expect(CHANGELOG_CATEGORY[entry.category]).toBeDefined();
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.summary.length).toBeGreaterThan(0);
    }
  });

  it("모달이 스크롤 어포던스를 줄 만큼 항목이 충분하다 (6번째가 반쯤 걸침)", () => {
    expect(CHANGELOG.length).toBeGreaterThan(6);
  });
});

describe("미열람 표시", () => {
  it("처음 방문(저장값 없음)에는 점을 띄운다", () => {
    expect(hasUnseenUpdate(null, CHANGELOG_LATEST_ID)).toBe(true);
  });

  it("최신 항목을 본 뒤에는 점을 지운다", () => {
    expect(hasUnseenUpdate(CHANGELOG_LATEST_ID, CHANGELOG_LATEST_ID)).toBe(false);
  });

  it("옛 항목만 본 상태면 다시 띄운다", () => {
    expect(hasUnseenUpdate(CHANGELOG[CHANGELOG.length - 1]!.id, CHANGELOG_LATEST_ID)).toBe(true);
  });

  it("저장소 접근이 막힌 브라우저에서도 예외 없이 null 을 돌려준다", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null };
    expect(readSeenId(storage)).toBeNull();
    store.set(WHATS_NEW_SEEN_KEY, "x");
    expect(readSeenId(storage)).toBe("x");
    expect(
      readSeenId({
        getItem: () => {
          throw new Error("blocked");
        },
      })
    ).toBeNull();
  });
});

describe("헤더 배선", () => {
  const header = read("components/layout/header.tsx");

  it("데스크톱 버그 신고 버튼은 설정 드롭다운 안으로 옮겼다", () => {
    expect(header).toContain("<SettingsMenu");
    expect(header).not.toMatch(/aria-label="Send Feedback"/);
    expect(read("components/layout/SettingsMenu.tsx")).toContain("Report a bug");
  });

  it("What's new 버튼이 데스크톱·모바일 양쪽에 있다", () => {
    expect(header).toMatch(/<WhatsNewButton onOpen=/);
    expect(header).toMatch(/variant="menu"/);
  });

  it("모달은 헤더가 소유한다 — 버튼 안에서 렌더하면 모바일 드로어가 닫힐 때 같이 사라진다", () => {
    expect(header).toContain("<WhatsNewModal");
    expect(read("components/layout/WhatsNewButton.tsx")).not.toContain("<WhatsNewModal");
  });

  it("동기화 인원은 UTC '오늘' 이 아니라 최근 24시간 (KST 09시 리셋 뒤 0명 표시 방지)", () => {
    const api = read("app/api/whats-new/route.ts");
    expect(api).toContain("syncedLast24h");
    expect(api).not.toContain("setUTCHours");
    expect(read("components/layout/WhatsNewModal.tsx")).toContain("last 24h");
  });

  it("LIVE 줄의 브랜치는 하드코딩이 아니라 배포 ref 를 쓴다 (프리뷰에서 main@ 오표기)", () => {
    const modal = read("components/layout/WhatsNewModal.tsx");
    expect(modal).not.toContain("main@");
    expect(modal).toContain("live.ref");
    expect(read("next.config.ts")).toContain("VERCEL_GIT_COMMIT_REF");
  });

  it("LIVE API 는 public 라우트다 (비로그인은 307 HTML 을 받아 JSON parse 실패)", () => {
    expect(read("middleware.ts")).toContain('"/api/whats-new"');
  });

  it("changelog 모듈은 런타임 import 가 없다 (클라이언트·vitest 안전)", () => {
    expect(read("lib/constants/changelog.ts").match(/^import (?!type )/gm)).toBeNull();
  });
});
