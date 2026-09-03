import { NextResponse } from "next/server";
import { handleLineWebhookEvents, isLineEnabled, verifyLineSignature, type LineWebhookBody } from "@/lib/line";

export async function POST(request: Request) {
  if (!isLineEnabled()) {
    return NextResponse.json({ error: "LINE 未設定" }, { status: 503 });
  }

  const bodyText = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(bodyText, signature)) {
    return NextResponse.json({ error: "簽章驗證失敗" }, { status: 401 });
  }

  let payload: LineWebhookBody;
  try {
    payload = JSON.parse(bodyText) as LineWebhookBody;
  } catch {
    return NextResponse.json({ error: "無效 JSON" }, { status: 400 });
  }

  const events = payload.events ?? [];
  if (events.length) {
    await handleLineWebhookEvents(events);
  }

  return NextResponse.json({ ok: true });
}
