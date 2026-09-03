import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStore, saveStore } from "@/lib/db";
import {
  isGoogleConnected,
  isGoogleOAuthConfigured,
  syncCompanyCalendarToGoogle,
} from "@/lib/google-calendar";
import { isLineEnabled } from "@/lib/line";
import { resolveLineRichMenuId } from "@/lib/line-rich-menu";

function resolveCalendarId(store: Awaited<ReturnType<typeof getStore>>): string {
  return store.googleTokens?.calendarId ?? store.integrationSettings?.googleCalendarId ?? "primary";
}

export async function GET() {
  try {
    await requireAdmin();
    const store = await getStore();
    const richMenuId = await resolveLineRichMenuId();

    return NextResponse.json({
      line: {
        enabled: isLineEnabled(),
        richMenuId: store.integrationSettings?.lineRichMenuId ?? "",
        richMenuActive: Boolean(richMenuId),
      },
      google: {
        oauthConfigured: isGoogleOAuthConfigured(),
        connected: await isGoogleConnected(),
        calendarId: resolveCalendarId(store),
        connectedAt: store.googleTokens?.connectedAt ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const store = await getStore();
    const previousCalendarId = resolveCalendarId(store);
    let calendarChanged = false;

    if (body.lineRichMenuId !== undefined) {
      const id = String(body.lineRichMenuId ?? "").trim();
      store.integrationSettings = {
        ...store.integrationSettings,
        lineRichMenuId: id || undefined,
      };
    }

    if (body.googleCalendarId !== undefined) {
      const calendarId = String(body.googleCalendarId ?? "").trim() || "primary";
      calendarChanged = calendarId !== previousCalendarId;
      store.integrationSettings = {
        ...store.integrationSettings,
        googleCalendarId: calendarId,
      };
      if (store.googleTokens?.refresh_token) {
        store.googleTokens = { ...store.googleTokens, calendarId };
      }

      // 換日曆時清掉舊事件 ID，避免 patch 到錯誤日曆
      if (calendarChanged) {
        for (const leave of store.leaves) {
          if (leave.googleEventId) delete leave.googleEventId;
        }
        for (const event of store.calendarEvents) {
          if (event.googleEventId) delete event.googleEventId;
        }
      }
    }

    await saveStore(store);

    let sync: { synced: number; skipped: number; errors: string[] } | null = null;
    if (body.googleCalendarId !== undefined && (await isGoogleConnected())) {
      sync = await syncCompanyCalendarToGoogle();
    }

    return NextResponse.json({
      ok: true,
      calendarChanged,
      sync,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "儲存失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
