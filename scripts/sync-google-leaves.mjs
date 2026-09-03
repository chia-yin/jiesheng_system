/**
 * 把尚未同步的已核准請假寫入 Google 日曆
 * 優先使用 DB 內尚未過期的 access_token；若需 refresh 才讀 GOOGLE_CLIENT_*。
 */
import { createClient } from "@supabase/supabase-js";

const LEAVE_TYPE_LABEL = {
  annual: "特休",
  sick: "病假",
  personal: "事假",
  other: "其他",
};

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("缺少 Supabase 環境變數");

  const sb = createClient(url, key);
  const { data: settings, error: sErr } = await sb
    .from("app_settings")
    .select("integration_settings, google_tokens")
    .eq("id", "default")
    .single();
  if (sErr) throw sErr;

  const tokens = settings.google_tokens;
  if (!tokens?.refresh_token && !tokens?.access_token) {
    throw new Error("尚未連結 Google");
  }

  const calendarId =
    settings.integration_settings?.googleCalendarId ||
    tokens.calendarId ||
    "primary";

  console.log("calendarId =", calendarId);

  let accessToken = tokens.access_token;
  const stillValid = tokens.access_token && Number(tokens.expiry) > Date.now() + 30_000;

  if (!stillValid) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "access_token 已過期，且缺少 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET（請補到 Netlify 與 .env.local）"
      );
    }
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) throw new Error("refresh failed: " + tokenText);
    const refreshed = JSON.parse(tokenText);
    accessToken = refreshed.access_token;
    await sb
      .from("app_settings")
      .update({
        google_tokens: {
          ...tokens,
          access_token: accessToken,
          expiry: Date.now() + refreshed.expires_in * 1000,
          calendarId,
        },
      })
      .eq("id", "default");
    console.log("refreshed access_token");
  } else {
    console.log("using existing access_token");
  }

  const { data: leaves, error: lErr } = await sb
    .from("leave_requests")
    .select("*")
    .eq("status", "approved")
    .is("google_event_id", null);
  if (lErr) throw lErr;

  console.log("pending leaves =", leaves?.length ?? 0);

  let synced = 0;
  const errors = [];

  for (const leave of leaves ?? []) {
    const typeLabel = LEAVE_TYPE_LABEL[leave.type] ?? leave.type;
    const payload = {
      summary: `${leave.employee_name} ${typeLabel}`,
      description: leave.reason || `請假申請（${leave.days} 天）`,
      start: { date: leave.start_date },
      end: { date: addDays(leave.end_date, 1) },
      colorId: "2",
    };

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
    const text = await res.text();
    if (!res.ok) {
      console.error("FAIL", leave.id, res.status, text.slice(0, 500));
      errors.push(`${leave.employee_name}: ${text.slice(0, 200)}`);
      continue;
    }
    const event = JSON.parse(text);
    const { error: uErr } = await sb
      .from("leave_requests")
      .update({ google_event_id: event.id })
      .eq("id", leave.id);
    if (uErr) {
      errors.push(`${leave.employee_name}: db ${uErr.message}`);
      continue;
    }
    console.log("OK", leave.employee_name, leave.start_date, "->", event.id);
    synced++;
  }

  console.log(JSON.stringify({ synced, errors }, null, 2));
}

main().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
