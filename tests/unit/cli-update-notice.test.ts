import { describe, expect, it } from "vitest";
import {
  cliStatusFromEvent,
  describeCliVersion,
  isOutdatedCliVersion,
  parseDismissal,
  shouldShowCliUpdate,
} from "@/lib/cli/update-notice";
import { readCliVersion } from "@/lib/utils/submit-payload";

const VERSION_STORED_FOR_PRE_2_2_CLI = readCliVersion(undefined);
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-20T08:00:00Z");
const OUTDATED = { version: "2.3.0", outdated: true };

describe("isOutdatedCliVersion — 2.3.3(집계 개선 판)보다 옛 CLI 인가", () => {
  it("판을 보내지 않는 옛 CLI 는 옛 판이다", () => {
    expect(isOutdatedCliVersion(VERSION_STORED_FOR_PRE_2_2_CLI)).toBe(true);
  });

  it("2.3.3 바로 아래까지는 옛 판이다", () => {
    for (const version of ["2.3.2", "2.3.0", "2.2.9", "1.9.9", "2.0.42", "2.3.2-beta.1"]) {
      expect(isOutdatedCliVersion(version), version).toBe(true);
    }
  });

  it("2.3.3 부터는 옛 판이 아니다 — 자리마다 숫자로 비교한다", () => {
    for (const version of ["2.3.3", "2.3.4", "2.3.10", "2.4.0", "2.10.0", "3.0.0", "10.0.0"]) {
      expect(isOutdatedCliVersion(version), version).toBe(false);
    }
  });

  it("판을 알 수 없으면 안내하지 않는다", () => {
    for (const version of [null, undefined, "", "unknown", "invalid", "dev", "2.3", "2.3.x"]) {
      expect(isOutdatedCliVersion(version), String(version)).toBe(false);
    }
  });
});

describe("describeCliVersion — 안내 문장에 넣을 판 이름", () => {
  it("「Your last sync used ___.」에 들어갈 말 — 판 번호 또는 2.2.0 이전", () => {
    expect(describeCliVersion("2.3.0")).toBe("CLI v2.3.0");
    expect(describeCliVersion(VERSION_STORED_FOR_PRE_2_2_CLI)).toBe("a CLI version before 2.2.0");
  });
});

describe("cliStatusFromEvent — 마지막으로 받은 제출의 CLI 판", () => {
  it("받은 제출 기록이 없으면 판 없음 · 안내 없음", () => {
    expect(cliStatusFromEvent(null)).toEqual({ version: null, outdated: false });
    expect(cliStatusFromEvent({ cli_version: null })).toEqual({ version: null, outdated: false });
  });

  it("옛 판과 새 판을 가른다", () => {
    expect(cliStatusFromEvent({ cli_version: "2.3.0" })).toEqual({
      version: "2.3.0",
      outdated: true,
    });
    expect(cliStatusFromEvent({ cli_version: VERSION_STORED_FOR_PRE_2_2_CLI })).toEqual({
      version: VERSION_STORED_FOR_PRE_2_2_CLI,
      outdated: true,
    });
    expect(cliStatusFromEvent({ cli_version: "2.3.4" })).toEqual({
      version: "2.3.4",
      outdated: false,
    });
  });
});

describe("parseDismissal — 닫은 기록 읽기", () => {
  it("판과 시각이 맞는 모양일 때만 읽고, 나머지는 닫은 적 없음으로 본다", () => {
    expect(parseDismissal(JSON.stringify({ version: "2.3.0", at: NOW }))).toEqual({
      version: "2.3.0",
      at: NOW,
    });
    for (const raw of [
      null,
      "",
      "garbage",
      "null",
      "[]",
      '{"version":1,"at":1}',
      '{"version":"2.3.0","at":"x"}',
      '{"version":"2.3.0","at":1e400}',
      '{"version":"2.3.0"}',
    ]) {
      expect(parseDismissal(raw), String(raw)).toBeNull();
    }
  });
});

describe("shouldShowCliUpdate — 안내 띠를 보일까", () => {
  const closedAgo = (ms: number, version = "2.3.0") => ({ version, at: NOW - ms });

  it("옛 판이고 닫은 적이 없으면 보인다", () => {
    expect(shouldShowCliUpdate(OUTDATED, null, NOW)).toBe(true);
  });

  it("새 판 · 판 모름 · 로그인 전에는 보이지 않는다", () => {
    expect(shouldShowCliUpdate({ version: "2.3.4", outdated: false }, null, NOW)).toBe(false);
    expect(shouldShowCliUpdate({ version: null, outdated: false }, null, NOW)).toBe(false);
    expect(shouldShowCliUpdate({ version: null, outdated: true }, null, NOW)).toBe(false);
    expect(shouldShowCliUpdate(null, null, NOW)).toBe(false);
    expect(shouldShowCliUpdate(undefined, null, NOW)).toBe(false);
  });

  it("같은 판에서 닫으면 7일 동안 숨고, 7일이 지나면 다시 보인다", () => {
    expect(shouldShowCliUpdate(OUTDATED, closedAgo(DAY), NOW)).toBe(false);
    expect(shouldShowCliUpdate(OUTDATED, closedAgo(7 * DAY - 1), NOW)).toBe(false);
    expect(shouldShowCliUpdate(OUTDATED, closedAgo(7 * DAY), NOW)).toBe(true);
  });

  it("다른 판에서 닫았다면(판은 바뀌었는데 아직 옛 판) 바로 다시 보인다", () => {
    expect(
      shouldShowCliUpdate(OUTDATED, closedAgo(60_000, VERSION_STORED_FOR_PRE_2_2_CLI), NOW)
    ).toBe(true);
  });

  it("닫은 시각이 미래(시계 어긋남)면 숨긴 채로 둔다", () => {
    expect(shouldShowCliUpdate(OUTDATED, closedAgo(-DAY), NOW)).toBe(false);
  });
});
