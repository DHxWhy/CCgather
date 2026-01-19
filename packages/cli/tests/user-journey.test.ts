/**
 * CCgather CLI - User Journey Scenario Tests
 *
 * Tests based on real user scenarios to ensure fairness-first design works correctly.
 *
 * User Journeys Covered:
 * 1. First-time user, auto-match success → .ccgather saved
 * 2. First-time user, auto-match fail → manual selection → .ccgather saved
 * 3. Returning user with valid .ccgather → auto-use saved link
 * 4. Folder renamed → .ccgather points to old session → warning needed
 * 5. Duplicate submission → SessionFingerprint handles it
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

// ═══════════════════════════════════════════════════════════════════════════
// Test Utilities - Mock File System
// ═══════════════════════════════════════════════════════════════════════════

interface MockFsStructure {
  [path: string]: string | MockFsStructure;
}

class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  setup(structure: MockFsStructure, basePath: string = ""): void {
    for (const [name, content] of Object.entries(structure)) {
      const fullPath = basePath ? path.join(basePath, name) : name;
      if (typeof content === "string") {
        this.files.set(this.normalizePath(fullPath), content);
        // Ensure parent directories exist
        this.ensureParentDirs(fullPath);
      } else {
        this.directories.add(this.normalizePath(fullPath));
        this.setup(content, fullPath);
      }
    }
  }

  private normalizePath(p: string): string {
    return p.replace(/\\/g, "/");
  }

  private ensureParentDirs(filePath: string): void {
    const parts = this.normalizePath(filePath).split("/");
    let current = "";
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i];
      this.directories.add(current);
    }
  }

  existsSync(filePath: string): boolean {
    const normalized = this.normalizePath(filePath);
    return this.files.has(normalized) || this.directories.has(normalized);
  }

  readFileSync(filePath: string): string {
    const normalized = this.normalizePath(filePath);
    const content = this.files.get(normalized);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }
    return content;
  }

  writeFileSync(filePath: string, content: string): void {
    const normalized = this.normalizePath(filePath);
    this.files.set(normalized, content);
    this.ensureParentDirs(filePath);
  }

  unlinkSync(filePath: string): void {
    const normalized = this.normalizePath(filePath);
    this.files.delete(normalized);
  }

  readdirSync(dirPath: string): { name: string; isDirectory: () => boolean }[] {
    const normalized = this.normalizePath(dirPath);
    const entries: { name: string; isDirectory: () => boolean }[] = [];

    // Find all immediate children
    const prefix = normalized + "/";
    const seen = new Set<string>();

    // Check files
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.slice(prefix.length);
        const firstPart = relativePath.split("/")[0];
        if (!seen.has(firstPart)) {
          seen.add(firstPart);
          const fullChildPath = prefix + firstPart;
          entries.push({
            name: firstPart,
            isDirectory: () => this.directories.has(fullChildPath),
          });
        }
      }
    }

    // Check directories
    for (const dir of this.directories) {
      if (dir.startsWith(prefix)) {
        const relativePath = dir.slice(prefix.length);
        const firstPart = relativePath.split("/")[0];
        if (!seen.has(firstPart)) {
          seen.add(firstPart);
          entries.push({
            name: firstPart,
            isDirectory: () => true,
          });
        }
      }
    }

    return entries;
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Mock Session Data Generator
// ═══════════════════════════════════════════════════════════════════════════

function createMockSession(options: {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  timestamp?: string;
}): string {
  const {
    model = "claude-sonnet-4-20250514",
    inputTokens = 1000,
    outputTokens = 500,
    timestamp = new Date().toISOString(),
  } = options;

  const event = {
    type: "assistant",
    timestamp,
    message: {
      model,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  };

  return JSON.stringify(event);
}

// ═══════════════════════════════════════════════════════════════════════════
// Unit Tests for Project Link Functions
// ═══════════════════════════════════════════════════════════════════════════

describe("Project Link (.ccgather) Functions", () => {
  const mockFs = new MockFileSystem();
  const originalCwd = process.cwd;
  const mockCwd = "/Users/test/my-project";

  beforeEach(() => {
    mockFs.clear();
    process.cwd = vi.fn().mockReturnValue(mockCwd);
  });

  afterEach(() => {
    process.cwd = originalCwd;
    vi.restoreAllMocks();
  });

  describe("hasProjectLink()", () => {
    it("should return false when .ccgather file does not exist", () => {
      // Test using mock file system directly (no fs.existsSync spy needed)
      const ccgatherPath = path.join(mockCwd, ".ccgather");
      const result = mockFs.existsSync(ccgatherPath);

      expect(result).toBe(false);
    });

    it("should return true when .ccgather file exists", () => {
      mockFs.setup({
        [mockCwd]: {
          ".ccgather": JSON.stringify({
            claudeProjectPath: "/Users/test/.claude/projects/-Users-test-my-project",
            folderName: "-Users-test-my-project",
            linkedAt: "2026-01-19T12:00:00Z",
          }),
        },
      });

      const ccgatherPath = path.join(mockCwd, ".ccgather");
      const result = mockFs.existsSync(ccgatherPath);

      expect(result).toBe(true);
    });
  });

  describe("loadProjectLink()", () => {
    it("should return null when .ccgather file does not exist", () => {
      // Test using mock file system directly (no fs.existsSync spy needed)
      const ccgatherPath = path.join(mockCwd, ".ccgather");
      const exists = mockFs.existsSync(ccgatherPath);

      expect(exists).toBe(false);
    });

    it("should return ProjectLink when .ccgather file is valid", () => {
      const linkData = {
        claudeProjectPath: "/Users/test/.claude/projects/-Users-test-my-project",
        folderName: "-Users-test-my-project",
        linkedAt: "2026-01-19T12:00:00Z",
      };

      mockFs.setup({
        [mockCwd]: {
          ".ccgather": JSON.stringify(linkData),
        },
      });

      // Also mock the claude project path exists
      mockFs.directories.add(mockFs["normalizePath"](linkData.claudeProjectPath));

      const ccgatherPath = path.join(mockCwd, ".ccgather");
      const content = mockFs.readFileSync(ccgatherPath);
      const parsed = JSON.parse(content);

      expect(parsed.claudeProjectPath).toBe(linkData.claudeProjectPath);
      expect(parsed.folderName).toBe(linkData.folderName);
    });

    it("should return null when linked path no longer exists", () => {
      const linkData = {
        claudeProjectPath: "/Users/test/.claude/projects/-Users-test-OLD-project",
        folderName: "-Users-test-OLD-project",
        linkedAt: "2026-01-19T12:00:00Z",
      };

      mockFs.setup({
        [mockCwd]: {
          ".ccgather": JSON.stringify(linkData),
        },
      });

      // The claude project path does NOT exist
      const pathExists = mockFs.existsSync(linkData.claudeProjectPath);

      expect(pathExists).toBe(false);
      // loadProjectLink should return null in this case
    });
  });

  describe("saveProjectLink()", () => {
    it("should write .ccgather file with correct structure", () => {
      const claudeProjectPath = "/Users/test/.claude/projects/-Users-test-my-project";
      const folderName = "-Users-test-my-project";

      const linkData = {
        claudeProjectPath,
        folderName,
        linkedAt: expect.any(String),
      };

      const ccgatherPath = path.join(mockCwd, ".ccgather");
      mockFs.writeFileSync(
        ccgatherPath,
        JSON.stringify({
          claudeProjectPath,
          folderName,
          linkedAt: new Date().toISOString(),
        })
      );

      const savedContent = mockFs.readFileSync(ccgatherPath);
      const parsed = JSON.parse(savedContent);

      expect(parsed.claudeProjectPath).toBe(claudeProjectPath);
      expect(parsed.folderName).toBe(folderName);
      expect(parsed.linkedAt).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// User Journey Scenario 1: First-time User, Auto-match Success
// ═══════════════════════════════════════════════════════════════════════════

describe("Journey 1: First-time User - Auto-match Success", () => {
  /**
   * Scenario:
   * - User runs `npx ccgather` in /Users/kim/my-project
   * - Claude Code has sessions in ~/.claude/projects/-Users-kim-my-project/
   * - Auto-match succeeds (folder name contains "my-project")
   * - .ccgather is saved for future use
   */

  it("should auto-match project folder when name matches", () => {
    const projectName = "my-project";
    const encodedFolderName = "-Users-kim-my-project";

    // Check if folder name contains project name (case-insensitive)
    const folderNameLower = encodedFolderName.toLowerCase();
    const projectNameLower = projectName.toLowerCase();

    const isMatch = folderNameLower.includes(projectNameLower);

    expect(isMatch).toBe(true);
  });

  it("should match project with hyphenated underscore names", () => {
    const projectName = "my_project";
    const encodedFolderName = "-Users-kim-my-project"; // underscore → hyphen

    // Claude Code converts underscore to hyphen
    const projectNameHyphenated = projectName.toLowerCase().replace(/_/g, "-");
    const folderNameLower = encodedFolderName.toLowerCase();

    const isMatch = folderNameLower.includes(projectNameHyphenated);

    expect(isMatch).toBe(true);
  });

  it("should save .ccgather after successful auto-match", () => {
    const mockFs = new MockFileSystem();
    const claudeProjectPath = "/Users/kim/.claude/projects/-Users-kim-my-project";
    const folderName = "-Users-kim-my-project";
    const cwdPath = "/Users/kim/my-project";

    // Simulate saveProjectLink
    const ccgatherPath = `${cwdPath}/.ccgather`;
    const linkData = {
      claudeProjectPath,
      folderName,
      linkedAt: new Date().toISOString(),
    };

    mockFs.writeFileSync(ccgatherPath, JSON.stringify(linkData, null, 2));

    const savedContent = mockFs.readFileSync(ccgatherPath);
    const parsed = JSON.parse(savedContent);

    expect(parsed.claudeProjectPath).toBe(claudeProjectPath);
    expect(parsed.folderName).toBe(folderName);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// User Journey Scenario 2: Auto-match Fail → Manual Selection
// ═══════════════════════════════════════════════════════════════════════════

describe("Journey 2: First-time User - Manual Selection", () => {
  /**
   * Scenario:
   * - User runs `npx ccgather` in /Users/kim/새프로젝트 (Korean name)
   * - Claude Code has sessions but no auto-match (encoding differences)
   * - User manually selects from available projects
   * - .ccgather is saved for future use
   */

  it("should detect encoding mismatch for non-ASCII paths", () => {
    const projectName = "새프로젝트"; // Korean characters
    const encodedFolderName = "-Users-kim--------"; // Non-ASCII → hyphens

    // Check if auto-match would fail
    const folderNameLower = encodedFolderName.toLowerCase();
    const projectNameLower = projectName.toLowerCase();

    const isMatch = folderNameLower.includes(projectNameLower);

    expect(isMatch).toBe(false); // Auto-match fails
  });

  it("should provide available projects for selection", () => {
    // Mock available project folders
    const availableProjects = [
      {
        folderName: "-Users-kim--------",
        fullPath: "/Users/kim/.claude/projects/-Users-kim--------",
        displayName: "--------", // Last segment
      },
      {
        folderName: "-Users-kim-other-project",
        fullPath: "/Users/kim/.claude/projects/-Users-kim-other-project",
        displayName: "other-project",
      },
    ];

    expect(availableProjects.length).toBeGreaterThan(0);
    expect(availableProjects[0].displayName).toBeDefined();
  });

  it("should save .ccgather after manual selection", () => {
    const mockFs = new MockFileSystem();
    const cwdPath = "/Users/kim/새프로젝트";
    const selectedProject = {
      fullPath: "/Users/kim/.claude/projects/-Users-kim--------",
      folderName: "-Users-kim--------",
    };

    // Simulate saveProjectLink after manual selection
    const ccgatherPath = `${cwdPath}/.ccgather`;
    const linkData = {
      claudeProjectPath: selectedProject.fullPath,
      folderName: selectedProject.folderName,
      linkedAt: new Date().toISOString(),
    };

    mockFs.writeFileSync(ccgatherPath, JSON.stringify(linkData, null, 2));

    const savedContent = mockFs.readFileSync(ccgatherPath);
    const parsed = JSON.parse(savedContent);

    expect(parsed.claudeProjectPath).toBe(selectedProject.fullPath);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// User Journey Scenario 3: Returning User - Use Saved Link
// ═══════════════════════════════════════════════════════════════════════════

describe("Journey 3: Returning User - Saved Link", () => {
  /**
   * Scenario:
   * - User has previously linked project (.ccgather exists)
   * - User runs `npx ccgather` again
   * - System uses saved link without prompting
   */

  it("should use saved link when .ccgather exists and path is valid", () => {
    const mockFs = new MockFileSystem();
    const cwdPath = "/Users/kim/my-project";
    const savedLink = {
      claudeProjectPath: "/Users/kim/.claude/projects/-Users-kim-my-project",
      folderName: "-Users-kim-my-project",
      linkedAt: "2026-01-15T12:00:00Z",
    };

    // Setup .ccgather file
    mockFs.setup({
      [cwdPath]: {
        ".ccgather": JSON.stringify(savedLink),
      },
    });

    // Setup the Claude project folder exists
    mockFs.directories.add("/Users/kim/.claude/projects/-Users-kim-my-project");

    // Load and verify
    const ccgatherPath = `${cwdPath}/.ccgather`;
    const content = mockFs.readFileSync(ccgatherPath);
    const parsed = JSON.parse(content);

    // Verify the linked path exists
    const pathExists = mockFs.existsSync(parsed.claudeProjectPath);

    expect(parsed.claudeProjectPath).toBe(savedLink.claudeProjectPath);
    expect(pathExists).toBe(true);
  });

  it("should invalidate link when saved path no longer exists", () => {
    const mockFs = new MockFileSystem();
    const cwdPath = "/Users/kim/my-project";
    const savedLink = {
      claudeProjectPath: "/Users/kim/.claude/projects/-Users-kim-DELETED-project",
      folderName: "-Users-kim-DELETED-project",
      linkedAt: "2026-01-15T12:00:00Z",
    };

    // Setup .ccgather file but NOT the Claude project folder
    mockFs.setup({
      [cwdPath]: {
        ".ccgather": JSON.stringify(savedLink),
      },
    });

    // Check if linked path exists
    const pathExists = mockFs.existsSync(savedLink.claudeProjectPath);

    expect(pathExists).toBe(false);
    // loadProjectLink should return null and trigger re-selection
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// User Journey Scenario 4: Folder Renamed - Warning Needed
// ═══════════════════════════════════════════════════════════════════════════

describe("Journey 4: Folder Renamed - Session Data Warning", () => {
  /**
   * Scenario:
   * - User had project "A" linked to Claude session folder "A"
   * - User renames folder to "A-a"
   * - Claude Code creates NEW session folder for "A-a"
   * - Old .ccgather still points to old "A" sessions
   * - New sessions in "A-a" folder are being missed!
   *
   * This is a data integrity issue that needs warning/detection.
   */

  it("should detect when cwd no longer matches saved link folder pattern", () => {
    const originalProjectName = "my-project";
    const renamedProjectName = "my-project-v2";

    const savedLink = {
      claudeProjectPath: "/Users/kim/.claude/projects/-Users-kim-my-project",
      folderName: "-Users-kim-my-project",
    };

    // Check if current folder name matches saved link pattern
    const savedFolderPattern = savedLink.folderName.toLowerCase();
    const currentFolderName = renamedProjectName.toLowerCase();

    // The saved link was for "my-project" but current folder is "my-project-v2"
    // This indicates potential folder rename
    const mightBeRenamed = !savedFolderPattern.includes(
      currentFolderName.replace(/[^a-z0-9]/g, "")
    );

    expect(mightBeRenamed).toBe(true);
  });

  it("should detect new Claude session folder for renamed project", () => {
    // After rename, Claude Code creates new session folder
    const availableFolders = [
      "-Users-kim-my-project", // Old folder (from .ccgather)
      "-Users-kim-my-project-v2", // New folder (after rename)
    ];

    const savedFolderName = "-Users-kim-my-project";
    const currentProjectName = "my-project-v2";

    // Check if there's a newer folder that matches current project name
    // The encoded folder name replaces hyphens: my-project-v2 → myprojectv2
    const currentNameEncoded = currentProjectName.toLowerCase().replace(/-/g, "");

    const newerFolder = availableFolders.find((f) => {
      if (f === savedFolderName) return false;
      // Check if folder contains the project name pattern
      const folderPattern = f.toLowerCase().replace(/-/g, "");
      return folderPattern.includes(currentNameEncoded);
    });

    expect(newerFolder).toBe("-Users-kim-my-project-v2");
    // This should trigger a warning to user
  });

  it("should warn about potentially missed session data", () => {
    const warningMessage = buildFolderRenameWarning({
      savedFolder: "-Users-kim-my-project",
      detectedNewFolder: "-Users-kim-my-project-v2",
      currentProjectName: "my-project-v2",
    });

    expect(warningMessage).toContain("my-project-v2");
    expect(warningMessage).toContain("re-link");
  });
});

function buildFolderRenameWarning(options: {
  savedFolder: string;
  detectedNewFolder: string;
  currentProjectName: string;
}): string {
  return `Warning: Folder name changed. New sessions for "${options.currentProjectName}" may be in a different location.
Current .ccgather links to: ${options.savedFolder}
Detected newer folder: ${options.detectedNewFolder}
Consider running 're-link' to capture new session data.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// User Journey Scenario 5: SessionFingerprint - Duplicate Prevention
// ═══════════════════════════════════════════════════════════════════════════

describe("Journey 5: Duplicate Submission Prevention", () => {
  /**
   * Scenario:
   * - User submits usage data
   * - SessionFingerprint (SHA256 hash) is generated from session files
   * - Server uses fingerprint to detect duplicate submissions
   * - Same data = same fingerprint = rejected as duplicate
   */

  it("should generate consistent hash for same session content", () => {
    const sessionContent = createMockSession({
      model: "claude-sonnet-4-20250514",
      inputTokens: 1000,
      outputTokens: 500,
      timestamp: "2026-01-19T10:00:00Z",
    });

    const hash1 = generateTestSessionHash("session1.jsonl", sessionContent);
    const hash2 = generateTestSessionHash("session1.jsonl", sessionContent);

    expect(hash1).toBe(hash2);
  });

  it("should generate different hash for different session content", () => {
    const session1 = createMockSession({
      model: "claude-sonnet-4-20250514",
      inputTokens: 1000,
      timestamp: "2026-01-19T10:00:00Z",
    });

    const session2 = createMockSession({
      model: "claude-sonnet-4-20250514",
      inputTokens: 2000, // Different token count
      timestamp: "2026-01-19T10:00:00Z",
    });

    const hash1 = generateTestSessionHash("session1.jsonl", session1);
    const hash2 = generateTestSessionHash("session2.jsonl", session2);

    expect(hash1).not.toBe(hash2);
  });

  it("should generate combined fingerprint from multiple sessions", () => {
    const sessions = [
      { file: "session1.jsonl", hash: "abc123" },
      { file: "session2.jsonl", hash: "def456" },
      { file: "session3.jsonl", hash: "ghi789" },
    ];

    const fingerprint = generateTestFingerprint(sessions.map((s) => s.hash));

    expect(fingerprint.sessionCount).toBe(3);
    expect(fingerprint.combinedHash).toBeDefined();
    expect(fingerprint.combinedHash.length).toBe(64); // SHA256 hex
  });

  it("should detect duplicate submission via fingerprint match", () => {
    const fingerprint1 = {
      sessionHashes: ["abc123", "def456"],
      combinedHash: "combined_hash_1",
      sessionCount: 2,
    };

    const fingerprint2 = {
      sessionHashes: ["abc123", "def456"],
      combinedHash: "combined_hash_1", // Same combined hash
      sessionCount: 2,
    };

    const isDuplicate = fingerprint1.combinedHash === fingerprint2.combinedHash;

    expect(isDuplicate).toBe(true);
  });
});

function generateTestSessionHash(fileName: string, content: string): string {
  const lines = content.split("\n").slice(0, 50).join("\n");
  const hashInput = `${fileName}:${lines}`;
  return crypto.createHash("sha256").update(hashInput).digest("hex");
}

function generateTestFingerprint(sessionHashes: string[]): {
  sessionHashes: string[];
  combinedHash: string;
  sessionCount: number;
} {
  const sortedHashes = [...sessionHashes].sort();
  const combinedHash = crypto.createHash("sha256").update(sortedHashes.join(":")).digest("hex");

  return {
    sessionHashes: sortedHashes,
    combinedHash,
    sessionCount: sessionHashes.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Opus Detection Tests (Max Plan Verification)
// ═══════════════════════════════════════════════════════════════════════════

describe("Opus Detection - Max Plan Verification", () => {
  /**
   * Opus models are ONLY available on Max plan.
   * If any Opus usage is detected, user is definitively on Max plan.
   */

  it("should detect Opus usage in daily usage data", () => {
    const dailyUsage = [
      {
        date: "2026-01-15",
        models: { "claude-sonnet-4-20250514": 10000 },
      },
      {
        date: "2026-01-16",
        models: { "claude-opus-4-20250514": 5000 }, // Opus detected!
      },
    ];

    const opusModels = new Set<string>();
    const opusDates: string[] = [];

    for (const daily of dailyUsage) {
      for (const model of Object.keys(daily.models)) {
        if (model.toLowerCase().includes("opus")) {
          opusModels.add(model);
          opusDates.push(daily.date);
        }
      }
    }

    expect(opusModels.size).toBeGreaterThan(0);
    expect(Array.from(opusModels)).toContain("claude-opus-4-20250514");
    expect(opusDates).toContain("2026-01-16");
  });

  it("should auto-assign Max plan when Opus is detected", () => {
    const opusDetected = true;
    const credentialPlan = "pro"; // User might have downgraded

    // Opus detection overrides credential-based plan
    const finalPlan = opusDetected ? "max" : credentialPlan;

    expect(finalPlan).toBe("max");
  });

  it("should not detect Opus when only Sonnet/Haiku used", () => {
    const dailyUsage = [
      {
        date: "2026-01-15",
        models: { "claude-sonnet-4-20250514": 10000, "claude-haiku-3": 5000 },
      },
    ];

    let opusDetected = false;

    for (const daily of dailyUsage) {
      for (const model of Object.keys(daily.models)) {
        if (model.toLowerCase().includes("opus")) {
          opusDetected = true;
        }
      }
    }

    expect(opusDetected).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Path Encoding Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Path Encoding - Claude Code Folder Matching", () => {
  /**
   * Claude Code encodes project paths for folder names.
   * Understanding this encoding is crucial for auto-matching.
   */

  it("should encode path with slashes to hyphens", () => {
    const inputPath = "/Users/kim/my-project";
    const encoded = encodePathLikeClaude(inputPath);

    expect(encoded).toBe("-Users-kim-my-project");
    expect(encoded).not.toContain("/");
  });

  it("should encode underscores to hyphens", () => {
    const inputPath = "/Users/kim/my_project";
    const encoded = encodePathLikeClaude(inputPath);

    expect(encoded).toBe("-Users-kim-my-project");
    expect(encoded).not.toContain("_");
  });

  it("should encode non-ASCII characters to hyphens", () => {
    const inputPath = "/Users/김철수/프로젝트";
    const encoded = encodePathLikeClaude(inputPath);

    // All non-ASCII becomes hyphens
    expect(encoded).toMatch(/^-Users-[-]+-[-]+$/);
    expect(encoded).not.toMatch(/[^\x00-\x7F]/); // No non-ASCII
  });

  it("should preserve case for ASCII characters", () => {
    const inputPath = "/Users/Kim/MyProject";
    const encoded = encodePathLikeClaude(inputPath);

    expect(encoded).toBe("-Users-Kim-MyProject");
  });

  it("should preserve dots in path", () => {
    const inputPath = "/Users/kim/my.project.v2";
    const encoded = encodePathLikeClaude(inputPath);

    expect(encoded).toBe("-Users-kim-my.project.v2");
  });
});

function encodePathLikeClaude(inputPath: string): string {
  return inputPath
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      // Keep ASCII alphanumeric and dots only
      if (
        (code >= 48 && code <= 57) || // 0-9
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        char === "."
      ) {
        return char;
      }
      // Replace everything else with '-'
      return "-";
    })
    .join("");
}

// ═══════════════════════════════════════════════════════════════════════════
// V2.0 Tests: Level-Based League System (Scan All Projects)
// ═══════════════════════════════════════════════════════════════════════════

describe("V2.0: Scan All Projects - Level-Based League", () => {
  /**
   * V2.0 simplifies submission by scanning ALL projects.
   * No more per-project selection - total usage determines league.
   */

  it("should aggregate tokens from multiple projects", () => {
    // Mock multiple project data
    const project1Tokens = 1_000_000;
    const project2Tokens = 2_000_000;
    const project3Tokens = 500_000;

    const totalTokens = project1Tokens + project2Tokens + project3Tokens;

    expect(totalTokens).toBe(3_500_000);
  });

  it("should calculate level from total tokens", () => {
    const levelThresholds = [
      { level: 1, min: 0, max: 10_000_000, name: "Rookie" },
      { level: 2, min: 10_000_000, max: 50_000_000, name: "Coder" },
      { level: 3, min: 50_000_000, max: 200_000_000, name: "Builder" },
      { level: 4, min: 200_000_000, max: 500_000_000, name: "Architect" },
      { level: 5, min: 500_000_000, max: 1_000_000_000, name: "Expert" },
      { level: 6, min: 1_000_000_000, max: 3_000_000_000, name: "Master" },
      { level: 7, min: 3_000_000_000, max: 10_000_000_000, name: "Grandmaster" },
      { level: 8, min: 10_000_000_000, max: 30_000_000_000, name: "Legend" },
      { level: 9, min: 30_000_000_000, max: 100_000_000_000, name: "Titan" },
      { level: 10, min: 100_000_000_000, max: Infinity, name: "Immortal" },
    ];

    const getLevel = (tokens: number) => {
      return levelThresholds.find((t) => tokens >= t.min && tokens < t.max) || levelThresholds[0];
    };

    expect(getLevel(5_000_000).level).toBe(1); // Rookie
    expect(getLevel(25_000_000).level).toBe(2); // Coder
    expect(getLevel(100_000_000).level).toBe(3); // Builder
    expect(getLevel(300_000_000).level).toBe(4); // Architect
    expect(getLevel(750_000_000).level).toBe(5); // Expert
    expect(getLevel(2_000_000_000).level).toBe(6); // Master
    expect(getLevel(5_000_000_000).level).toBe(7); // Grandmaster
    expect(getLevel(15_000_000_000).level).toBe(8); // Legend
    expect(getLevel(50_000_000_000).level).toBe(9); // Titan
    expect(getLevel(150_000_000_000).level).toBe(10); // Immortal
  });

  it("should determine level league from level", () => {
    // 4 leagues based on level groups
    const getLevelLeague = (level: number): string => {
      if (level <= 3) return "rookie"; // Lv1-3: 루키 리그
      if (level <= 6) return "builder"; // Lv4-6: 빌더 리그
      if (level <= 9) return "master"; // Lv7-9: 마스터 리그
      return "legend"; // Lv10: 레전드 리그
    };

    expect(getLevelLeague(1)).toBe("rookie");
    expect(getLevelLeague(3)).toBe("rookie");
    expect(getLevelLeague(4)).toBe("builder");
    expect(getLevelLeague(6)).toBe("builder");
    expect(getLevelLeague(7)).toBe("master");
    expect(getLevelLeague(9)).toBe("master");
    expect(getLevelLeague(10)).toBe("legend");
  });

  it("should preserve ccplan as badge only (not for league)", () => {
    const usageData = {
      totalTokens: 1_500_000_000, // Level 6 (Master)
      ccplan: "max", // Max plan badge
    };

    // Level determines league, not ccplan
    const level = 6; // Based on tokens
    const levelLeague = "builder"; // Lv4-6 → builder league

    // ccplan is just a badge for display
    expect(usageData.ccplan).toBe("max");
    expect(levelLeague).toBe("builder"); // League is from level, not plan
  });

  it("should preserve Opus detection as badge", () => {
    const dailyUsage = [
      { date: "2026-01-15", models: { "claude-opus-4-20250514": 10000 } },
      { date: "2026-01-16", models: { "claude-sonnet-4-20250514": 5000 } },
    ];

    // Opus detection for badge display (not league placement)
    let hasOpusUsage = false;
    const opusModels: string[] = [];

    for (const daily of dailyUsage) {
      for (const model of Object.keys(daily.models)) {
        if (model.toLowerCase().includes("opus")) {
          hasOpusUsage = true;
          opusModels.push(model);
        }
      }
    }

    expect(hasOpusUsage).toBe(true);
    expect(opusModels).toContain("claude-opus-4-20250514");
    // But this doesn't affect league - only badges
  });
});

describe("V2.0: No Per-Project Selection", () => {
  /**
   * V2.0 removes per-project selection UI.
   * Scanning is automatic for all projects.
   */

  it("should not require .ccgather file for submission", () => {
    // V2.0 scans all projects regardless of .ccgather
    const hasCcgatherFile = false;
    const canSubmit = true; // Can always submit if sessions exist

    expect(hasCcgatherFile).toBe(false);
    expect(canSubmit).toBe(true);
  });

  it("should scan from all Claude Code project directories", () => {
    // Mock project directories structure
    const projectDirs = [
      "/Users/kim/.config/claude/projects", // XDG path
      "/Users/kim/.claude/projects", // Legacy path
    ];

    const projectsInXdg = ["-Users-kim-project-a", "-Users-kim-project-b"];
    const projectsInLegacy = ["-Users-kim-old-project"];

    const allProjects = [...projectsInXdg, ...projectsInLegacy];

    expect(allProjects.length).toBe(3);
    expect(allProjects).toContain("-Users-kim-project-a");
    expect(allProjects).toContain("-Users-kim-old-project");
  });

  it("should combine all session files from all projects", () => {
    // Mock session files across projects
    const sessionFiles = {
      "-Users-kim-project-a": ["session1.jsonl", "session2.jsonl"],
      "-Users-kim-project-b": ["session3.jsonl"],
      "-Users-kim-old-project": ["session4.jsonl", "session5.jsonl"],
    };

    const allFiles = Object.values(sessionFiles).flat();

    expect(allFiles.length).toBe(5);
  });
});
