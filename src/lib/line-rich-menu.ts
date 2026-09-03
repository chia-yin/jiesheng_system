import { getStore } from "@/lib/db";
import { isLineEnabled } from "@/lib/line";

export async function resolveLineRichMenuId(): Promise<string | null> {
  const store = await getStore();
  const fromDb = store.integrationSettings?.lineRichMenuId?.trim();
  if (fromDb) return fromDb;
  const fromEnv = process.env.LINE_RICH_MENU_ID?.trim();
  return fromEnv || null;
}

export async function linkLineRichMenu(lineUserId: string): Promise<void> {
  if (!isLineEnabled()) return;

  const richMenuId = await resolveLineRichMenuId();
  if (!richMenuId) return;

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
  const res = await fetch(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu/${encodeURIComponent(richMenuId)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[line-rich-menu] link failed:", err);
  }
}

export async function unlinkLineRichMenu(lineUserId: string): Promise<void> {
  if (!isLineEnabled()) return;

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
  const res = await fetch(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    console.error("[line-rich-menu] unlink failed:", err);
  }
}
