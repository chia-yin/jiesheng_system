async function trigger(kind: "in" | "out") {
  const base = (process.env.URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET?.trim();
  if (!base || !secret) {
    console.error("clock-reminder: missing URL or CRON_SECRET");
    return new Response(JSON.stringify({ error: "missing config" }), { status: 500 });
  }

  const res = await fetch(`${base}/api/cron/clock-reminder?kind=${kind}`, {
    headers: { "x-cron-secret": secret },
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}

export default async () => trigger("out");

export const config = {
  /** 週一至五 18:05 台北（UTC 10:05） */
  schedule: "5 10 * * 1-5",
};
