import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FEEDBACK_NOTIFICATION_TYPES, getNotificationDetail } from "@/lib/notifications/display";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../", p), "utf-8");

const notification = (
  type: string,
  body: string | null,
  data: Record<string, unknown> | null = null
) => ({ type, title: null, body, data });

// 2026-10-21: an admin's reply to feedback is stored as data.admin_note on a
// feedback_* notification, but the bell and /notifications fell back to
// "System announcement" for those types and never showed the reply.
describe("notification detail", () => {
  it("shows the admin reply, quoting the user's own feedback", () => {
    expect(
      getNotificationDetail(
        notification("feedback_resolved", "My numbers differ", {
          admin_note: "  Here is why.\n\nSecond paragraph.  ",
        })
      )
    ).toEqual({ quotedFeedback: "My numbers differ", text: "Here is why.\n\nSecond paragraph." });
  });

  it("covers every feedback status the admin can notify", () => {
    for (const type of FEEDBACK_NOTIFICATION_TYPES) {
      expect(getNotificationDetail(notification(type, null, { admin_note: "Reply" }))).toEqual({
        quotedFeedback: null,
        text: "Reply",
      });
    }
  });

  it("has nothing to expand when the admin left no reply", () => {
    expect(getNotificationDetail(notification("feedback_resolved", "Bug", null))).toBeNull();
    expect(
      getNotificationDetail(notification("feedback_resolved", "Bug", { admin_note: "   " }))
    ).toBeNull();
    expect(
      getNotificationDetail(notification("feedback_closed", "Bug", { admin_note: 42 }))
    ).toBeNull();
  });

  it("keeps system notices expandable by their body", () => {
    expect(getNotificationDetail(notification("system_notice", "Maintenance tonight"))).toEqual({
      quotedFeedback: null,
      text: "Maintenance tonight",
    });
    expect(getNotificationDetail(notification("system_notice", null))).toBeNull();
  });

  it("does not expand other notification types", () => {
    expect(getNotificationDetail(notification("post_like", "x", { admin_note: "y" }))).toBeNull();
  });
});

describe("notification detail wiring", () => {
  it("every status the feedback API notifies about is a known feedback type", () => {
    const route = read("app/api/feedback/route.ts");
    const block = /const NOTIFIABLE_STATUSES[^{]*\{([^}]*)\}/.exec(route)?.[1] ?? "";
    const statuses = [...block.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
    expect(statuses.length).toBeGreaterThan(0);
    for (const status of statuses) {
      expect(FEEDBACK_NOTIFICATION_TYPES).toContain(`feedback_${status}`);
    }
  });

  it("the feedback API stores the reply where the display reads it", () => {
    const route = read("app/api/feedback/route.ts");
    expect(route).toMatch(/type: `feedback_\$\{notificationStatus\}`/);
    expect(route).toMatch(/admin_note: admin_note \|\| null/);
  });

  for (const file of [
    "components/community/NotificationBell.tsx",
    "app/(main)/notifications/page.tsx",
  ]) {
    it(`${file} expands through getNotificationDetail, not a system-notice-only gate`, () => {
      const src = read(file);
      expect(src).toContain('from "@/lib/notifications/display"');
      expect(src).toMatch(/getNotificationDetail\(notification\)/);
      expect(src).not.toContain('notification.type === "system_notice" && notification.body');
      for (const type of FEEDBACK_NOTIFICATION_TYPES) {
        expect(src).toContain(`${type}: {`);
      }
    });
  }
});
