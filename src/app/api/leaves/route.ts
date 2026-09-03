import { NextResponse } from "next/server";
import { createLeave, getLeaves, updateLeaveStatus } from "@/lib/leaves";
import type { LeaveStatus, LeaveType } from "@/types/system";
import { getSession, requireAdmin } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const leaves = await getLeaves();
  if (session.role === "admin") {
    return NextResponse.json({ leaves });
  }
  return NextResponse.json({
    leaves: leaves.filter((l) => l.employeeId === session.employeeId),
  });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const body = await request.json();
    let employeeId = session.employeeId;
    if (session.role === "admin" && body.employeeId) {
      employeeId = String(body.employeeId);
    }

    const type = body.type as LeaveType;
    const startDate = String(body.startDate ?? "");
    const endDate = String(body.endDate ?? "");
    const reason = String(body.reason ?? "").trim();

    if (!employeeId || !startDate || !endDate || !reason) {
      return NextResponse.json({ error: "請填寫完整資料" }, { status: 400 });
    }

    const leave = await createLeave({ employeeId, type, startDate, endDate, reason });
    return NextResponse.json({ leave });
  } catch (error) {
    const message = error instanceof Error ? error.message : "申請失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const id = String(body.id ?? "");
    const status = body.status as LeaveStatus;
    const rejectReason = body.rejectReason ? String(body.rejectReason).trim() : undefined;

    if (!id || !["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
    }

    const leave = await updateLeaveStatus(id, status, {
      rejectReason,
      reviewedBy: session.name,
    });
    return NextResponse.json({ leave });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
