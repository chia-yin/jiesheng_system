import { NextResponse } from "next/server";
import { sendClockReminders } from "@/lib/line-reminder";
import { isLineEnabled } from "@/lib/line";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("x-cron-secret");
  const urlSecret = new URL(request.url).searchParams.get("secret");
  return header === secret || urlSecret === secret;
}

/** Netlify 排程或手動觸發：?kind=in|out */
export async function GET(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  if (!isLineEnabled()) {
    return NextResponse.json({ error: "LINE 未設定" }, { status: 503 });
  }

  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "in" && kind !== "out") {
    return NextResponse.json({ error: "kind 需為 in 或 out" }, { status: 400 });
  }

  const result = await sendClockReminders(kind);
  return NextResponse.json({ ok: true, kind, ...result });
}
