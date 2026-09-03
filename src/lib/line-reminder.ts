import { getStore } from "@/lib/db";
import { pushLineMessages } from "@/lib/line";
import { buildReminderFlex } from "@/lib/line-messages";
import { getDayRecords, getWorkSettings } from "@/lib/worktime";
import type { LeaveRequest } from "@/types/system";

/** 台北時區 YYYY-MM-DD */
export function getTaipeiDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);
}

export function isWeekendTaipei(date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", weekday: "short" }).format(date);
  return weekday === "Sat" || weekday === "Sun";
}

export function isOnApprovedLeave(employeeId: string, dateKey: string, leaves: LeaveRequest[]): boolean {
  return leaves.some(
    (l) =>
      l.employeeId === employeeId &&
      l.status === "approved" &&
      dateKey >= l.startDate.slice(0, 10) &&
      dateKey <= l.endDate.slice(0, 10)
  );
}

export async function sendClockReminders(kind: "in" | "out"): Promise<{ sent: number; skipped: number }> {
  const store = await getStore();
  const settings = getWorkSettings(store.workSettings);
  const today = getTaipeiDateKey();

  if (isWeekendTaipei()) {
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;

  for (const employee of store.employees) {
    if (!employee.lineUserId) {
      skipped++;
      continue;
    }

    if (isOnApprovedLeave(employee.id, today, store.leaves)) {
      skipped++;
      continue;
    }

    const { clockIn, clockOut } = getDayRecords(store.records, employee.id, today);

    if (kind === "in") {
      if (clockIn) {
        skipped++;
        continue;
      }
      await pushLineMessages(employee.lineUserId, [
        buildReminderFlex("in", employee.name, settings.startTime),
      ]);
      sent++;
      continue;
    }

    if (!clockIn || clockOut) {
      skipped++;
      continue;
    }

    await pushLineMessages(employee.lineUserId, [
      buildReminderFlex("out", employee.name, settings.endTime),
    ]);
    sent++;
  }

  return { sent, skipped };
}
