import { NextResponse } from "next/server";
import {
  getDayDetail,
  getMonthRecords,
  getRecords,
  getTodaySummary,
  type RecordsScope,
} from "@/lib/attendance";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const month = searchParams.get("month") ?? undefined;
  const summary = searchParams.get("summary");
  const filterEmployeeId = searchParams.get("employeeId") ?? undefined;

  const scope: RecordsScope = session.role === "admin" ? "all" : "my";

  if (summary === "today") {
    const data = await getTodaySummary(date ?? undefined);
    return NextResponse.json(data);
  }

  if (month) {
    const data = await getMonthRecords(
      month,
      scope,
      session.employeeId,
      filterEmployeeId
    );
    return NextResponse.json({
      ...data,
      isAdmin: session.role === "admin",
    });
  }

  if (date) {
    const data = await getDayDetail(date, scope, session.employeeId, filterEmployeeId);
    return NextResponse.json({
      ...data,
      isAdmin: session.role === "admin",
    });
  }

  const records = await getRecords(
    undefined,
    scope === "my" ? session.employeeId : undefined
  );

  return NextResponse.json({
    records,
    stats: {
      total: records.length,
      lateCount: records.filter((r) => r.type === "in" && (r.lateMinutes ?? 0) > 0).length,
      earlyLeaveCount: records.filter(
        (r) => r.type === "out" && (r.earlyLeaveMinutes ?? 0) > 0
      ).length,
    },
    isAdmin: session.role === "admin",
  });
}
