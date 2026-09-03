import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createLineBindCode, isLineEnabled, unbindLine } from "@/lib/line";
import { getStore } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const store = await getStore();
  const employee = store.employees.find((e) => e.id === session.employeeId);

  return NextResponse.json({
    enabled: isLineEnabled(),
    bound: Boolean(employee?.lineUserId),
    bindCode: employee?.lineBindCode ?? null,
    bindExpiresAt: employee?.lineBindExpiresAt ?? null,
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  if (!isLineEnabled()) {
    return NextResponse.json({ error: "LINE Bot 尚未設定（需 LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN）" }, { status: 503 });
  }

  try {
    const { code, expiresAt } = await createLineBindCode(session.employeeId);
    return NextResponse.json({ code, expiresAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "產生綁定碼失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  try {
    await unbindLine(session.employeeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "解除綁定失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
