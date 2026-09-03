import { getStore, saveStore } from "@/lib/db";
import type { GoogleTokens, LeaveRequest } from "@/types/system";

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: "特休",
  sick: "病假",
  personal: "事假",
  other: "其他",
};

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}

export async function getGoogleTokens(): Promise<GoogleTokens | null> {
  const store = await getStore();
  return store.googleTokens ?? null;
}

export async function saveGoogleTokens(tokens: GoogleTokens): Promise<void> {
  const store = await getStore();
  store.googleTokens = tokens;
  await saveStore(store);
}

export async function clearGoogleTokens(): Promise<void> {
  const store = await getStore();
  store.googleTokens = undefined;
  await saveStore(store);
}

export async function isGoogleConnected(): Promise<boolean> {
  const tokens = await getGoogleTokens();
  return Boolean(tokens?.refresh_token);
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth 尚未設定");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`無法更新 Google 存取權杖：${err}`);
  }

  return res.json();
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = await getGoogleTokens();
  if (!tokens?.refresh_token) {
    throw new Error("尚未連結 Google 日曆");
  }

  const now = Date.now();
  if (tokens.access_token && tokens.expiry > now + 60_000) {
    return tokens.access_token;
  }

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  const updated: GoogleTokens = {
    ...tokens,
    access_token: refreshed.access_token,
    expiry: now + refreshed.expires_in * 1000,
  };
  await saveGoogleTokens(updated);
  return updated.access_token;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildLeaveEventPayload(leave: LeaveRequest) {
  const typeLabel = LEAVE_TYPE_LABEL[leave.type] ?? leave.type;
  const summary = `${leave.employeeName} ${typeLabel}`;
  const endExclusive = addDays(leave.endDate, 1);

  return {
    summary,
    description: leave.reason || `請假申請（${leave.days} 天）`,
    start: { date: leave.startDate },
    end: { date: endExclusive },
    colorId: "2",
  };
}

export async function createGoogleCalendarEvent(
  leave: LeaveRequest,
  accessToken: string,
  calendarId = "primary"
): Promise<string> {
  const payload = buildLeaveEventPayload(leave);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`建立 Google 日曆事件失敗：${err}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function syncLeaveToGoogle(leave: LeaveRequest): Promise<string | null> {
  if (leave.status !== "approved") return null;
  if (leave.googleEventId) return leave.googleEventId;
  if (!(await isGoogleConnected())) return null;

  const accessToken = await getValidAccessToken();
  const store = await getStore();
  const tokens = await getGoogleTokens();
  const calendarId =
    store.integrationSettings?.googleCalendarId ??
    tokens?.calendarId ??
    "primary";
  const eventId = await createGoogleCalendarEvent(leave, accessToken, calendarId);

  const stored = store.leaves.find((l) => l.id === leave.id);
  if (stored) {
    stored.googleEventId = eventId;
    await saveStore(store);
  }

  return eventId;
}

export async function syncAllApprovedLeaves(): Promise<{
  synced: number;
  skipped: number;
  errors: string[];
}> {
  const store = await getStore();
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  if (!(await isGoogleConnected())) {
    return { synced: 0, skipped: 0, errors: ["尚未連結 Google 日曆"] };
  }

  for (const leave of store.leaves) {
    if (leave.status !== "approved") continue;
    if (leave.googleEventId) {
      skipped++;
      continue;
    }

    try {
      const eventId = await syncLeaveToGoogle(leave);
      if (eventId) synced++;
      else skipped++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失敗";
      console.error("[google-calendar] sync leave failed:", message);
      errors.push(`${leave.employeeName} (${leave.startDate}): ${message}`);
    }
  }

  return { synced, skipped, errors };
}
