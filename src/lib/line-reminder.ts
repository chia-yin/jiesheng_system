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

export async function sendClockReminders(kind: "in" | "out"): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
  today: string;
}> {
  const store = await getStore();
  const settings = getWorkSettings(store.workSettings);
  const today = getTaipeiDateKey();
  const errors: string[] = [];

  if (isWeekendTaipei()) {
    return { sent: 0, skipped: 0, errors: ["週末不提醒"], today };
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
      try {
        await pushLineMessages(employee.lineUserId, [
          buildReminderFlex("in", employee.name, settings.startTime),
        ]);
        sent++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "推播失敗";
        console.error(`[clock-reminder] in failed for ${employee.name}:`, message);
        errors.push(`${employee.name}: ${message}`);
      }
      continue;
    }

    // 下班提醒：已上班且尚未下班
    if (!clockIn || clockOut) {
      skipped++;
      continue;
    }

    try {
      await pushLineMessages(employee.lineUserId, [
        buildReminderFlex("out", employee.name, settings.endTime),
      ]);
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "推播失敗";
      console.error(`[clock-reminder] out failed for ${employee.name}:`, message);
      errors.push(`${employee.name}: ${message}`);
    }
  }

  return { sent, skipped, errors, today };
}
