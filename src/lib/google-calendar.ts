import { getStore, saveStore } from "@/lib/db";
import { isGoogleSyncableEventType, EVENT_TYPE_LABEL, formatLeaveTitle } from "@/lib/calendar-types";
import type { CalendarEvent, GoogleTokens, LeaveRequest } from "@/types/system";

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

async function resolveCalendarId(): Promise<string> {
  const store = await getStore();
  const tokens = await getGoogleTokens();
  return (
    store.integrationSettings?.googleCalendarId ??
    tokens?.calendarId ??
    "primary"
  );
}

type GoogleEventPayload = {
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  colorId?: string;
};

export function buildLeaveEventPayload(leave: LeaveRequest): GoogleEventPayload {
  const typeLabel = LEAVE_TYPE_LABEL[leave.type] ?? leave.type;
  return {
    summary: formatLeaveTitle(leave.employeeName, typeLabel),
    description: leave.reason || `請假申請（${leave.days} 天）`,
    start: { date: leave.startDate },
    end: { date: addDays(leave.endDate, 1) },
    colorId: "2",
  };
}

export function buildCalendarEventPayload(event: CalendarEvent): GoogleEventPayload {
  const typeLabel = EVENT_TYPE_LABEL[event.type] ?? event.type;
  const summary = typeLabel.startsWith("[")
    ? `${typeLabel} ${event.title}`
    : event.title;

  const description = [typeLabel, event.description].filter(Boolean).join("\n");
  const timeZone = "Asia/Taipei";

  if (event.startTime) {
    const endTime = event.endTime || event.startTime;
    const endDate = event.endDate ?? event.startDate;
    return {
      summary,
      description,
      start: { dateTime: `${event.startDate}T${event.startTime}:00`, timeZone },
      end: { dateTime: `${endDate}T${endTime}:00`, timeZone },
      colorId:
        event.type === "meeting_external"
          ? "9"
          : event.type === "company_event"
            ? "4"
            : event.type === "milestone"
              ? "11"
              : "7",
    };
  }

  const endExclusive = addDays(event.endDate ?? event.startDate, 1);
  return {
    summary,
    description,
    start: { date: event.startDate },
    end: { date: endExclusive },
    colorId:
      event.type === "meeting_external"
        ? "9"
        : event.type === "company_event"
          ? "4"
          : event.type === "milestone"
            ? "11"
            : "7",
  };
}

async function postGoogleEvent(
  payload: GoogleEventPayload,
  accessToken: string,
  calendarId: string
): Promise<string> {
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

async function patchGoogleEvent(
  googleEventId: string,
  payload: GoogleEventPayload,
  accessToken: string,
  calendarId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`更新 Google 日曆事件失敗：${err}`);
  }
}

/** @deprecated 使用 createGoogleLeaveEvent */
export async function createGoogleCalendarEvent(
  leave: LeaveRequest,
  accessToken: string,
  calendarId = "primary"
): Promise<string> {
  return postGoogleEvent(buildLeaveEventPayload(leave), accessToken, calendarId);
}

export async function syncLeaveToGoogle(leave: LeaveRequest): Promise<string | null> {
  if (leave.status !== "approved") return null;
  if (!(await isGoogleConnected())) return null;

  const accessToken = await getValidAccessToken();
  const calendarId = await resolveCalendarId();
  const payload = buildLeaveEventPayload(leave);

  const store = await getStore();
  const stored = store.leaves.find((l) => l.id === leave.id);
  if (!stored) return null;

  if (stored.googleEventId) {
    try {
      await patchGoogleEvent(stored.googleEventId, payload, accessToken, calendarId);
      return stored.googleEventId;
    } catch {
      // 遠端已刪則改新建
    }
  }

  const eventId = await postGoogleEvent(payload, accessToken, calendarId);
  stored.googleEventId = eventId;
  await saveStore(store);
  return eventId;
}

export async function syncCalendarEventToGoogle(event: CalendarEvent): Promise<string | null> {
  if (!isGoogleSyncableEventType(event.type)) return null;
  if (!(await isGoogleConnected())) return null;

  const accessToken = await getValidAccessToken();
  const calendarId = await resolveCalendarId();
  const payload = buildCalendarEventPayload(event);

  const store = await getStore();
  const stored = store.calendarEvents.find((e) => e.id === event.id);
  if (!stored) return null;

  if (stored.googleEventId) {
    try {
      await patchGoogleEvent(stored.googleEventId, payload, accessToken, calendarId);
      return stored.googleEventId;
    } catch {
      // 若遠端已刪，改為新建
    }
  }

  const eventId = await postGoogleEvent(payload, accessToken, calendarId);
  stored.googleEventId = eventId;
  await saveStore(store);
  return eventId;
}

export async function syncCompanyCalendarToGoogle(): Promise<{
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
    try {
      const hadId = Boolean(leave.googleEventId);
      const eventId = await syncLeaveToGoogle(leave);
      if (eventId) {
        if (hadId) skipped++;
        else synced++;
      } else skipped++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失敗";
      console.error("[google-calendar] sync leave failed:", message);
      errors.push(`請假 ${leave.employeeName} (${leave.startDate}): ${message}`);
    }
  }

  for (const event of store.calendarEvents) {
    if (!isGoogleSyncableEventType(event.type)) {
      skipped++;
      continue;
    }
    try {
      const hadId = Boolean(event.googleEventId);
      const eventId = await syncCalendarEventToGoogle(event);
      if (eventId) {
        if (hadId) skipped++;
        else synced++;
      } else skipped++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失敗";
      console.error("[google-calendar] sync event failed:", message);
      errors.push(`事件 ${event.title} (${event.startDate}): ${message}`);
    }
  }

  return { synced, skipped, errors };
}

/** 相容舊名稱 */
export const syncAllApprovedLeaves = syncCompanyCalendarToGoogle;
