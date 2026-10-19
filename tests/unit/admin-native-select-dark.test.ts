import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { NATIVE_OPTION_CLASS, NATIVE_SELECT_CLASS } from "@/components/admin/native-select";

// 관리자 화면의 브라우저 기본 <select> 는 어두운 색 구성표와 어두운 option 배경을 강제한다.
// 빠지면 사이트 테마가 라이트일 때 펼침 목록이 흰 바탕·흰 글자가 돼 항목이 안 보인다.

const ROOT = join(__dirname, "..", "..");
const ADMIN_DIR = join(ROOT, "app", "(admin)");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

interface Tag {
  file: string;
  line: number;
  text: string;
}

// JSX 여는 태그를 `<tag` 부터 중괄호 깊이 0 의 첫 `>` 까지로 자른다 — 속성 안의
// `(e) => {…}` 화살표 때문에 정규식 `[^>]*` 로는 태그가 중간에 끊긴다.
function findTags(source: string, file: string, tagName: string): Tag[] {
  const open = `<${tagName}`;
  const tags: Tag[] = [];
  let idx = source.indexOf(open);
  while (idx !== -1) {
    const next = source[idx + open.length];
    if (next !== undefined && /[A-Za-z0-9_-]/.test(next)) {
      idx = source.indexOf(open, idx + 1);
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let i = idx + open.length; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) break;
    const line = source.slice(0, idx).split("\n").length;
    tags.push({ file, line, text: source.slice(idx, end + 1) });
    idx = source.indexOf(open, end);
  }
  return tags;
}

describe("관리자 화면 기본 select 는 어두운 펼침 목록을 강제한다", () => {
  const files = walk(ADMIN_DIR);
  const selects: Tag[] = [];
  const options: Tag[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf-8");
    const rel = relative(ROOT, file);
    selects.push(...findTags(src, rel, "select"));
    options.push(...findTags(src, rel, "option"));
  }

  it("상수 자체가 색 구성표와 불투명 배경을 담는다", () => {
    expect(NATIVE_SELECT_CLASS).toContain("[color-scheme:dark]");
    expect(NATIVE_OPTION_CLASS).toMatch(/bg-\[#[0-9a-f]{6}\]/);
    expect(NATIVE_OPTION_CLASS).toContain("text-white");
  });

  it("검사 대상이 비어 있지 않다(양성 대조)", () => {
    expect(selects.length).toBeGreaterThanOrEqual(2);
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  it("모든 <select> 가 NATIVE_SELECT_CLASS 를 쓴다", () => {
    const offenders = selects
      .filter((t) => !t.text.includes("NATIVE_SELECT_CLASS"))
      .map((t) => `${t.file}:${t.line}`);
    expect(offenders).toEqual([]);
  });

  it("모든 <option> 이 NATIVE_OPTION_CLASS 를 쓴다", () => {
    const offenders = options
      .filter((t) => !t.text.includes("NATIVE_OPTION_CLASS"))
      .map((t) => `${t.file}:${t.line}`);
    expect(offenders).toEqual([]);
  });
});
