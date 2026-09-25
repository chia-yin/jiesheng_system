import { getStore } from "@/lib/db";
import { pushLineMessages } from "@/lib/line";
import { buildReminderFlex } from "@/lib/line-messages";
import { sendSprintTaskDigest } from "@/lib/sprint-line-digest";
import { resolveWorkDay } from "@/lib/work-calendar";
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
  digestSent: number;
  digestSkipped: number;
  errors: string[];
  today: string;
}> {
  const store = await getStore();
  const settings = getWorkSettings(store.workSettings);
  const today = getTaipeiDateKey();
  const errors: string[] = [];
  const companyDays = store.workSettings?.companyCalendarDays ?? [];
  const day = resolveWorkDay(today, companyDays);

  if (!day.isWorkday) {
    const label =
      day.reason === "company_holiday"
        ? `公司放假不提醒（${day.label ?? today}）`
        : day.reason === "taiwan_holiday"
          ? `國定假日不提醒（${day.label ?? today}）`
          : "週末不提醒";
    return { sent: 0, skipped: 0, digestSent: 0, digestSkipped: 0, errors: [label], today };
  }

  let sent = 0;
  let skipped = 0;
  let digestSent = 0;
  let digestSkipped = 0;

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
    let clockPushed = false;

    if (kind === "in") {
      if (!clockIn) {
        try {
          await pushLineMessages(employee.lineUserId, [
            buildReminderFlex("in", employee.name, settings.startTime),
          ]);
          sent++;
          clockPushed = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "推播失敗";
          console.error(`[clock-reminder] in failed for ${employee.name}:`, message);
          errors.push(`${employee.name}: ${message}`);
        }
      }
    } else if (clockIn && !clockOut) {
      try {
        await pushLineMessages(employee.lineUserId, [
          buildReminderFlex("out", employee.name, settings.endTime),
        ]);
        sent++;
        clockPushed = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "推播失敗";
        console.error(`[clock-reminder] out failed for ${employee.name}:`, message);
        errors.push(`${employee.name}: ${message}`);
      }
    }

    if (!clockPushed) {
      skipped++;
    }

    // 即使已打卡略過打卡推播，仍推 Sprint 任務摘要
    try {
      const result = await sendSprintTaskDigest({
        lineUserId: employee.lineUserId,
        employeeId: employee.id,
        employeeName: employee.name,
        kind,
      });
      if (result === "sent") digestSent++;
      else digestSkipped++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "任務摘要推播失敗";
      console.error(`[sprint-digest] failed for ${employee.name}:`, message);
      errors.push(`${employee.name} 任務摘要: ${message}`);
      digestSkipped++;
    }
  }

  return { sent, skipped, digestSent, digestSkipped, errors, today };
}
