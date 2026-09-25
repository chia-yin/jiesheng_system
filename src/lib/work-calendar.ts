import { isTaiwanHoliday, getTaiwanHolidayName } from "@/lib/taiwan-holidays";
import type { CompanyCalendarDay } from "@/types/system";

export type WorkDaySkipReason =
  | "company_holiday"
  | "taiwan_holiday"
  | "weekend"
  | null;

export interface WorkDayDecision {
  /** 是否應發送上下班提醒（需打卡的工作日） */
  isWorkday: boolean;
  reason: WorkDaySkipReason;
  /** 顯示用名稱（放假日或補班日） */
  label?: string;
}

function isWeekendDateKey(dateKey: string): boolean {
  // 以 UTC 正午解析，避免時區偏移造成星期錯位
  const d = new Date(`${dateKey}T12:00:00+08:00`);
  const day = d.getUTCDay(); // 0 Sun … 但用 Taipei 固定偏移後 getDay 在本地…
  // 改用 Intl 以台北時區取 weekday
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    weekday: "short",
  }).format(d);
  return weekday === "Sat" || weekday === "Sun";
}

/**
 * 判斷某日是否為「應提醒打卡」的工作日。
 * 優先順序：公司覆寫（放假／補班）> 國定假日 > 週末。
 */
export function resolveWorkDay(
  dateKey: string,
  companyDays: CompanyCalendarDay[] = []
): WorkDayDecision {
  const override = companyDays.find((d) => d.date === dateKey);
  if (override) {
    if (override.kind === "workday") {
      return { isWorkday: true, reason: null, label: override.name || "公司補班" };
    }
    return {
      isWorkday: false,
      reason: "company_holiday",
      label: override.name || "公司放假",
    };
  }

  if (isTaiwanHoliday(dateKey)) {
    return {
      isWorkday: false,
      reason: "taiwan_holiday",
      label: getTaiwanHolidayName(dateKey),
    };
  }

  if (isWeekendDateKey(dateKey)) {
    return { isWorkday: false, reason: "weekend", label: "週末" };
  }

  return { isWorkday: true, reason: null };
}

export function isReminderWorkday(
  dateKey: string,
  companyDays: CompanyCalendarDay[] = []
): boolean {
  return resolveWorkDay(dateKey, companyDays).isWorkday;
}
