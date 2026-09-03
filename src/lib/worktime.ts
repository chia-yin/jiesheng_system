import type { AttendanceRecord, WorkSettings } from "@/types/attendance";
import { getStore } from "@/lib/db";

const DEFAULT_WORK_SETTINGS: WorkSettings = {
  startTime: "09:00",
  endTime: "18:00",
  breakMinutes: 60,
  flexBeforeMinutes: 60,
  flexAfterMinutes: 60,
};

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function isoToMinutesOfDay(iso: string): number {
  // 使用台北時區取得當地時與分，避免伺服器時區（UTC）影響計算
  const d = new Date(iso);
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d); // "HH:MM"
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function getDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function getWorkSettings(settings?: WorkSettings): WorkSettings {
  return {
    ...DEFAULT_WORK_SETTINGS,
    ...settings,
    flexBeforeMinutes: settings?.flexBeforeMinutes ?? DEFAULT_WORK_SETTINGS.flexBeforeMinutes,
    flexAfterMinutes: settings?.flexAfterMinutes ?? DEFAULT_WORK_SETTINGS.flexAfterMinutes,
  };
}

/** 上班彈性窗口（最早可打卡 ~ 最晚不算遲到） */
export function getClockInFlexWindow(settings: WorkSettings): { from: string; to: string } {
  const s = getWorkSettings(settings);
  const startMin = parseTimeToMinutes(s.startTime);
  return {
    from: minutesToTimeStr(startMin - (s.flexBeforeMinutes ?? 0)),
    to: minutesToTimeStr(startMin + (s.flexAfterMinutes ?? 0)),
  };
}

/** 下班彈性窗口（最早不算早退 ~ 最晚可打卡） */
export function getClockOutFlexWindow(settings: WorkSettings): { from: string; to: string } {
  const s = getWorkSettings(settings);
  const endMin = parseTimeToMinutes(s.endTime);
  return {
    from: minutesToTimeStr(endMin - (s.flexBeforeMinutes ?? 0)),
    to: minutesToTimeStr(endMin + (s.flexAfterMinutes ?? 0)),
  };
}

export function calcLateMinutes(clockInIso: string, settings: WorkSettings | string): number {
  const s = typeof settings === "string" ? getWorkSettings({ ...DEFAULT_WORK_SETTINGS, startTime: settings }) : getWorkSettings(settings);
  const startMin = parseTimeToMinutes(s.startTime);
  const latestAllowed = startMin + (s.flexAfterMinutes ?? 0);
  const actual = isoToMinutesOfDay(clockInIso);
  return Math.max(0, actual - latestAllowed);
}

export function calcEarlyLeaveMinutes(clockOutIso: string, settings: WorkSettings | string): number {
  const s = typeof settings === "string" ? getWorkSettings({ ...DEFAULT_WORK_SETTINGS, endTime: settings }) : getWorkSettings(settings);
  const endMin = parseTimeToMinutes(s.endTime);
  const earliestAllowed = endMin - (s.flexBeforeMinutes ?? 0);
  const actual = isoToMinutesOfDay(clockOutIso);
  return Math.max(0, earliestAllowed - actual);
}

export function calcWorkMinutes(
  clockIn?: string,
  clockOut?: string,
  breakMinutes = 60
): number {
  if (!clockIn) return 0;
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  const gross = Math.max(0, Math.floor((end - start) / 60000));
  return clockOut ? Math.max(0, gross - breakMinutes) : gross;
}

export function needsBreakReminder(workMinutes: number): boolean {
  return workMinutes >= 240;
}

export function getDayRecords(records: AttendanceRecord[], employeeId: string, date: string) {
  const dayRecords = records
    .filter((r) => r.employeeId === employeeId && r.timestamp.startsWith(date))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const clockIn = dayRecords.find((r) => r.type === "in");
  const clockOut = [...dayRecords].reverse().find((r) => r.type === "out");

  return { clockIn, clockOut, dayRecords };
}

export async function getEmployeeAttendanceSummary(employeeId: string, date?: string) {
  const store = await getStore();
  const settings = getWorkSettings(store.workSettings);
  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  const { clockIn, clockOut } = getDayRecords(store.records, employeeId, targetDate);
  const workMinutes = calcWorkMinutes(clockIn?.timestamp, clockOut?.timestamp, settings.breakMinutes);

  let status: "not_started" | "working" | "finished" = "not_started";
  if (clockIn && !clockOut) status = "working";
  if (clockIn && clockOut) status = "finished";

  const clockInFlex = getClockInFlexWindow(settings);
  const clockOutFlex = getClockOutFlexWindow(settings);

  return {
    date: targetDate,
    settings: {
      ...settings,
      flexWindows: {
        clockIn: clockInFlex,
        clockOut: clockOutFlex,
      },
    },
    today: {
      date: targetDate,
      clockIn: clockIn?.timestamp,
      clockOut: clockOut?.timestamp,
      workMinutes,
      lateMinutes:
        clockIn?.lateMinutes ?? (clockIn ? calcLateMinutes(clockIn.timestamp, settings) : 0),
      earlyLeaveMinutes:
        clockOut?.earlyLeaveMinutes ??
        (clockOut ? calcEarlyLeaveMinutes(clockOut.timestamp, settings) : 0),
      status,
      needsBreakReminder: needsBreakReminder(workMinutes) && status === "working",
      canUndoClockOut: status === "finished",
    },
    laborLaw: {
      dailyStandardHours: 8,
      breakAfterHours: 4,
      breakMinutes: 30,
    },
  };
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} 小時 ${m} 分`;
}

export function minutesToTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

export function scheduledEndMinutes(settings: WorkSettings): number {
  return parseTimeToMinutes(settings.endTime) - parseTimeToMinutes(settings.startTime) - settings.breakMinutes;
}
