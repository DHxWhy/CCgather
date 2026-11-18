import { describe, expect, it } from "vitest";
import { readCliVersion, readDeclaredCount } from "@/lib/utils/submit-payload";

describe("readCliVersion", () => {
  it("keeps a released version and a pre-release one as sent", () => {
    expect(readCliVersion("2.3.4")).toBe("2.3.4");
    expect(readCliVersion("2.4.0-beta.1+build.5")).toBe("2.4.0-beta.1+build.5");
  });

  it("reads a payload with no version as a CLI older than 2.2.0", () => {
    expect(readCliVersion(undefined)).toBe("pre-2.2.0");
    expect(readCliVersion(234)).toBe("pre-2.2.0");
    expect(readCliVersion(null)).toBe("pre-2.2.0");
  });

  it("does not pass on a string the database would refuse to store", () => {
    expect(readCliVersion("2.3.4\u0000")).toBe("invalid");
    expect(readCliVersion("\u0000")).toBe("invalid");
  });

  it("does not pass on anything but letters, digits, dots, plus and hyphen", () => {
    expect(readCliVersion("2.3.4 ")).toBe("invalid");
    expect(readCliVersion("2.3.4\n@everyone")).toBe("invalid");
    expect(readCliVersion("")).toBe("invalid");
  });

  it("keeps 32 characters and refuses 33", () => {
    expect(readCliVersion("1".repeat(32))).toBe("1".repeat(32));
    expect(readCliVersion("1".repeat(33))).toBe("invalid");
  });
});

describe("readDeclaredCount", () => {
  it("keeps a whole number from 0 up", () => {
    expect(readDeclaredCount(6185)).toBe(6185);
    expect(readDeclaredCount(0)).toBe(0);
  });

  it("reads anything else as 0", () => {
    expect(readDeclaredCount(-1)).toBe(0);
    expect(readDeclaredCount(1.5)).toBe(0);
    expect(readDeclaredCount("12")).toBe(0);
    expect(readDeclaredCount({ count: "\u0000" })).toBe(0);
    expect(readDeclaredCount(Number.NaN)).toBe(0);
    expect(readDeclaredCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(readDeclaredCount(undefined)).toBe(0);
  });
});
