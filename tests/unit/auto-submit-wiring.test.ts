import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTO_SUBMIT_LABELS, AUTO_SUBMIT_STATES } from "@/lib/admin/auto-submit-state";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../", p), "utf-8");

// 2026-10-19: 관리자 표 "자동 제출" 열은 CLI 표식 → 서버 기록 → 관리자 API → 표 까지
// 네 군데가 같은 이름을 써야 한다. 한 곳이 빠지면 열은 조용히 전원 "미확인"이 된다.
describe("자동 제출 표시 배선", () => {
  it("제출 라우트는 출처를 리터럴이 아니라 scheduled 분기 상수로 쓴다", () => {
    const src = read("app/api/cli/submit/route.ts");
    expect(src).not.toMatch(/submission_source:\s*"cli"/);
    expect(
      (src.match(/submission_source:\s*submissionSource/g) ?? []).length
    ).toBeGreaterThanOrEqual(3);
    expect(src).toMatch(/const scheduled = body\.scheduled === true/);
    expect(src).toContain("last_scheduled_submit_at");
    expect(src).toContain("auto_sync_reported_at");
  });

  it("관리자 사용자 API 는 신호 3종을 내려준다", () => {
    const src = read("app/api/admin/users/route.ts");
    for (const col of ["auto_sync_enabled", "auto_sync_reported_at", "last_scheduled_submit_at"]) {
      expect(src).toContain(col);
    }
    expect(src).toMatch(/fetchAutoSubmitSignals\(supabase\)/);
  });

  it("CLI 보고 라우트는 enabled 불리언만 받고 보고 시각을 적는다", () => {
    const src = read("app/api/cli/autosubmit/route.ts");
    expect(src).toMatch(/typeof body\.enabled !== "boolean"/);
    expect(src).toContain("auto_sync_reported_at");
    expect(src).toMatch(/\.eq\("api_key", apiToken\)/);
  });

  it("관리자 표는 판정·라벨을 SSOT 에서 가져온다", () => {
    const src = read("app/(admin)/superadmin/page.tsx");
    expect(src).toContain('from "@/lib/admin/auto-submit-state"');
    expect(src).toMatch(/deriveAutoSubmitState\(/);
    expect(src).toMatch(/AUTO_SUBMIT_STATES\.map\(/);
    // 라벨 리터럴 금지(옛 문장 전체로) — 라벨은 AUTO_SUBMIT_LABELS 로만
    expect(src.includes(">켬·멈춤<") || src.includes('"켬·멈춤"')).toBe(false);
    expect(AUTO_SUBMIT_STATES.every((s) => AUTO_SUBMIT_LABELS[s].length > 0)).toBe(true);
  });

  it("CLI 는 예약 제출에 scheduled 표식을, on/off 에 서버 보고를 보낸다", () => {
    expect(read("packages/cli/src/commands/submit.ts")).toMatch(
      /\.\.\.\(scheduled \? \{ scheduled: true \} : \{\}\)/
    );
    const auto = read("packages/cli/src/commands/autosubmit.ts");
    expect(auto).toMatch(/reportState\(context, true\)/);
    expect(auto).toMatch(/reportState\(context, false\)/);
    expect(read("packages/cli/src/lib/api.ts")).toContain('"/cli/autosubmit"');
  });
});
