import { getStore, newId, saveStore } from "@/lib/db";
import { syncLeaveToGoogle } from "@/lib/google-calendar";
import { isLineEnabled, pushLineMessages } from "@/lib/line";
import { buildLeaveApplicationFlex } from "@/lib/line-messages";
import type { LeaveRequest, LeaveStatus, LeaveType } from "@/types/system";

export async function getLeaves() {
  const store = await getStore();
  return store.leaves.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function notifyAdminsNewLeave(leave: LeaveRequest): Promise<void> {
  if (!isLineEnabled()) return;

  try {
    const store = await getStore();
    const admins = store.employees.filter((e) => e.role === "admin" && e.lineUserId);
    if (!admins.length) return;

    const message = buildLeaveApplicationFlex({
      employeeName: leave.employeeName,
      type: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: leave.days,
      reason: leave.reason,
    });

    await Promise.allSettled(
      admins.map((admin) => pushLineMessages(admin.lineUserId!, message))
    );
  } catch (error) {
    console.error("[leave] LINE notify admins failed:", error);
  }
}

export async function createLeave(input: {
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  const store = await getStore();
  const employee = store.employees.find((e) => e.id === input.employeeId);

  if (!employee) {
    throw new Error("找不到員工");
  }

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (end < start) {
    throw new Error("結束日期不可早於開始日期");
  }

  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const leave: LeaveRequest = {
    id: newId("leave"),
    employeeId: employee.id,
    employeeName: employee.name,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    days,
    reason: input.reason,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  store.leaves.unshift(leave);
  await saveStore(store);

  // 不阻擋申請流程；推播失敗只記 log
  void notifyAdminsNewLeave(leave);

  return leave;
}

export async function updateLeaveStatus(
  id: string,
  status: LeaveStatus,
  options?: { rejectReason?: string; reviewedBy?: string }
) {
  const store = await getStore();
  const leave = store.leaves.find((l) => l.id === id);

  if (!leave) {
    throw new Error("找不到請假申請");
  }

  leave.status = status;

  if (status === "approved" || status === "rejected") {
    leave.reviewedAt = new Date().toISOString();
    leave.reviewedBy = options?.reviewedBy;
    if (status === "rejected" && options?.rejectReason) {
      leave.rejectReason = options.rejectReason;
    }
    if (status === "approved") {
      delete leave.rejectReason;
    }
  }

  await saveStore(store);

  if (status === "approved") {
    try {
      await syncLeaveToGoogle(leave);
    } catch (error) {
      console.error("[leaves] google sync after approve failed:", error);
    }
  }

  return leave;
}
