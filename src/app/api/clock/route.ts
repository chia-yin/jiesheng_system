import { NextResponse } from "next/server";
import { clockInOut, getEmployees } from "@/lib/attendance";
import type { ClockType } from "@/types/attendance";

export async function GET() {
  const employees = await getEmployees();
  return NextResponse.json({ employees });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const employeeId = String(body.employeeId ?? "");
    const type = body.type as ClockType;
    const note = body.note ? String(body.note) : undefined;

    if (!employeeId || (type !== "in" && type !== "out")) {
      return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
    }

    const record = await clockInOut(employeeId, type, note);
    return NextResponse.json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "打卡失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
