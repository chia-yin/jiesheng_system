import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { makeupClock } from "@/lib/attendance";
import type { ClockType } from "@/types/attendance";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

    const body = await request.json();
    const { date, time, type, employeeId, force } = body as {
      date?: string;
      time?: string;
      type?: ClockType;
      employeeId?: string;
      force?: boolean;
    };

    if (!date || !time || !type) {
      return NextResponse.json({ error: "請提供 date（YYYY-MM-DD）、time（HH:MM）、type（in/out）" }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: "日期格式 YYYY-MM-DD，時間格式 HH:MM" }, { status: 400 });
    }

    const targetId = session.role === "admin" && employeeId ? employeeId : session.employeeId;
    if (!targetId) return NextResponse.json({ error: "找不到員工" }, { status: 400 });

    const isAdmin = session.role === "admin";
    const result = await makeupClock(targetId, type, date, time, session.employeeId!, session.role as "admin" | "employee", isAdmin && Boolean(force));
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "補卡失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
