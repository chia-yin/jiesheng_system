import { NextResponse } from "next/server";
import { getEmployeeAttendanceSummary } from "@/lib/worktime";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const employeeId = searchParams.get("employeeId") ?? session.employeeId;

  if (session.role !== "admin" && employeeId !== session.employeeId) {
    return NextResponse.json({ error: "權限不足" }, { status: 403 });
  }

  const summary = await getEmployeeAttendanceSummary(employeeId, date);
  return NextResponse.json(summary);
}
