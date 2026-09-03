import { NextResponse } from "next/server";
import { clockInOut, getEmployees, undoClockOut } from "@/lib/attendance";
import type { ClockType } from "@/types/attendance";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const employees = await getEmployees();
  if (session.role === "admin") {
    return NextResponse.json({ employees });
  }
  return NextResponse.json({
    employees: employees.filter((e) => e.id === session.employeeId),
  });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const body = await request.json();
    const type = body.type as ClockType;
    const note = body.note ? String(body.note) : undefined;

    let employeeId = session.employeeId;
    if (session.role === "admin" && body.employeeId) {
      employeeId = String(body.employeeId);
    }

    if (!employeeId || (type !== "in" && type !== "out")) {
      return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
    }

    const result = await clockInOut(employeeId, type, note);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "打卡失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const employeeId = session.employeeId;
    if (!employeeId) {
      return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
    }

    const result = await undoClockOut(employeeId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "撤銷失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
