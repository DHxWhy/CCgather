const DISCORD_TIMEOUT_MS = 3000;

export async function alertOps(title: string, detail: Record<string, unknown>): Promise<void> {
  const payload = { evt: "ops_alert", title, ...detail, ts: new Date().toISOString() };
  console.error(JSON.stringify(payload));

  const webhookUrl = (process.env.DISCORD_WEBHOOK_ISSUE ?? process.env.DISCORD_WEBHOOK_NEW_USER)
    ?.replace(/\\n$/, "")
    .trim();
  if (!webhookUrl) return;

  const fields = Object.entries(detail)
    .slice(0, 8)
    .map(([name, value]) => ({
      name: name.slice(0, 256),
      value: String(value).slice(0, 1000),
      inline: true,
    }));

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
      body: JSON.stringify({
        username: "CCgather Ops",
        embeds: [
          {
            title: `🚨 ${title}`.slice(0, 256),
            color: 0xef4444,
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error) {
    console.warn("[ops-alert] Discord push failed:", error);
  }
}
