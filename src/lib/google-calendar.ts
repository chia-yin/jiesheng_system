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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Google 不接受 start === end（timeRangeEmpty）。無結束時間時預設 +1 小時。 */
function timedEnd(startDate: string, startTime: string, endDate?: string, endTime?: string): {
  date: string;
  time: string;
} {
  const date = endDate || startDate;
  const time = endTime || startTime;
  const startMs = new Date(`${startDate}T${startTime}:00`).getTime();
  const endMs = new Date(`${date}T${time}:00`).getTime();
  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
    return { date, time };
  }
  const bumped = new Date(`${startDate}T${startTime}:00`);
  bumped.setHours(bumped.getHours() + 1);
  return {
    date: `${bumped.getFullYear()}-${pad2(bumped.getMonth() + 1)}-${pad2(bumped.getDate())}`,
    time: `${pad2(bumped.getHours())}:${pad2(bumped.getMinutes())}`,
  };
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
    const end = timedEnd(event.startDate, event.startTime, event.endDate, event.endTime);
    return {
      summary,
      description,
      start: { dateTime: `${event.startDate}T${event.startTime}:00`, timeZone },
      end: { dateTime: `${end.date}T${end.time}:00`, timeZone },
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

async function putGoogleEvent(
  googleEventId: string,
  payload: GoogleEventPayload,
  accessToken: string,
  calendarId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: "PUT",
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

async function deleteGoogleEvent(
  googleEventId: string,
  accessToken: string,
  calendarId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.text();
    console.error("[google-calendar] delete failed:", err.slice(0, 180));
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

async function upsertPayload(
  existingId: string | undefined,
  payload: GoogleEventPayload,
  accessToken: string,
  calendarId: string
): Promise<string> {
  if (existingId) {
    try {
      await putGoogleEvent(existingId, payload, accessToken, calendarId);
      return existingId;
    } catch (error) {
      console.error(
        "[google-calendar] PUT failed, recreate:",
        error instanceof Error ? error.message : error
      );
      const createdId = await postGoogleEvent(payload, accessToken, calendarId);
      await deleteGoogleEvent(existingId, accessToken, calendarId);
      return createdId;
    }
  }
  return postGoogleEvent(payload, accessToken, calendarId);
}

export async function syncLeaveToGoogle(leave: LeaveRequest): Promise<string | null> {
  if (leave.status !== "approved") return null;
  if (!(await isGoogleConnected())) return null;

  const accessToken = await getValidAccessToken();
  const calendarId = await resolveCalendarId();
  const store = await getStore();
  const stored = store.leaves.find((l) => l.id === leave.id);
  if (!stored) return null;

  const eventId = await upsertPayload(
    stored.googleEventId,
    buildLeaveEventPayload(stored),
    accessToken,
    calendarId
  );
  if (stored.googleEventId !== eventId) {
    stored.googleEventId = eventId;
    await saveStore(store);
  }
  return eventId;
}

export async function syncCalendarEventToGoogle(event: CalendarEvent): Promise<string | null> {
  if (!isGoogleSyncableEventType(event.type)) return null;
  if (!(await isGoogleConnected())) return null;

  const accessToken = await getValidAccessToken();
  const calendarId = await resolveCalendarId();
  const store = await getStore();
  const stored = store.calendarEvents.find((e) => e.id === event.id);
  if (!stored) return null;

  // 用呼叫端傳入的最新欄位（避免剛存檔又讀回舊標題）
  const latest: CalendarEvent = {
    ...stored,
    title: event.title,
    type: event.type,
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    description: event.description,
  };

  const eventId = await upsertPayload(
    stored.googleEventId,
    buildCalendarEventPayload(latest),
    accessToken,
    calendarId
  );
  if (stored.googleEventId !== eventId) {
    stored.googleEventId = eventId;
    await saveStore(store);
  }
  return eventId;
}

const BULK_SYNC_BUDGET_MS = 18_000;

export async function syncCompanyCalendarToGoogle(): Promise<{
  synced: number;
  skipped: number;
  remaining: number;
  errors: string[];
}> {
  const store = await getStore();
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  if (!(await isGoogleConnected())) {
    return { synced: 0, skipped: 0, remaining: 0, errors: ["尚未連結 Google 日曆"] };
  }

  const accessToken = await getValidAccessToken();
  const calendarId = await resolveCalendarId();
  const started = Date.now();
  let dirty = false;
  let remaining = 0;
  let timedOut = false;

  const pendingLeaves = store.leaves.filter((l) => l.status === "approved" && !l.googleEventId);
  const updateLeaves = store.leaves.filter((l) => l.status === "approved" && Boolean(l.googleEventId));
  const pendingEvents = store.calendarEvents.filter(
    (e) => isGoogleSyncableEventType(e.type) && !e.googleEventId
  );
  const updateEvents = store.calendarEvents
    .filter((e) => isGoogleSyncableEventType(e.type) && Boolean(e.googleEventId))
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt));
  skipped += store.calendarEvents.filter((e) => !isGoogleSyncableEventType(e.type)).length;

  async function withinBudget() {
    if (Date.now() - started > BULK_SYNC_BUDGET_MS) {
      timedOut = true;
      return false;
    }
    return true;
  }

  for (const leave of pendingLeaves) {
    if (!(await withinBudget())) break;
    try {
      const eventId = await upsertPayload(undefined, buildLeaveEventPayload(leave), accessToken, calendarId);
      leave.googleEventId = eventId;
      dirty = true;
      synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失敗";
      console.error("[google-calendar] sync leave failed:", message);
      errors.push(`請假 ${leave.employeeName} (${leave.startDate}): ${message}`);
    }
  }

  for (const event of pendingEvents) {
    if (!(await withinBudget())) break;
    try {
      const eventId = await upsertPayload(undefined, buildCalendarEventPayload(event), accessToken, calendarId);
      event.googleEventId = eventId;
      dirty = true;
      synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失敗";
      console.error("[google-calendar] sync event failed:", message);
      errors.push(`事件 ${event.title} (${event.startDate}): ${message}`);
    }
  }

  // 已有 Google 事件 ID 的項目改走 PATCH，讓編輯後的標題／時間寫回日曆
  for (const leave of updateLeaves) {
    if (!(await withinBudget())) break;
    try {
      const eventId = await upsertPayload(
        leave.googleEventId,
        buildLeaveEventPayload(leave),
        accessToken,
        calendarId
      );
      if (leave.googleEventId !== eventId) {
        leave.googleEventId = eventId;
        dirty = true;
      }
      synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失敗";
      console.error("[google-calendar] update leave failed:", message);
      errors.push(`請假 ${leave.employeeName} (${leave.startDate}): ${message}`);
    }
  }

  for (const event of updateEvents) {
    if (!(await withinBudget())) break;
    try {
      const eventId = await upsertPayload(
        event.googleEventId,
        buildCalendarEventPayload(event),
        accessToken,
        calendarId
      );
      if (event.googleEventId !== eventId) {
        event.googleEventId = eventId;
        dirty = true;
      }
      synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失敗";
      console.error("[google-calendar] update event failed:", message);
      errors.push(`事件 ${event.title} (${event.startDate}): ${message}`);
    }
  }

  remaining =
    pendingLeaves.filter((l) => !l.googleEventId).length +
    pendingEvents.filter((e) => !e.googleEventId).length;

  if (timedOut && remaining > 0) {
    errors.unshift(`同步時間較長，已先寫入 ${synced} 筆，尚餘 ${remaining} 筆請再按一次「同步 Google」`);
  }

  if (dirty) {
    await saveStore(store);
  }

  return { synced, skipped, remaining, errors };
}

/** 相容舊名稱 */
export const syncAllApprovedLeaves = syncCompanyCalendarToGoogle;
