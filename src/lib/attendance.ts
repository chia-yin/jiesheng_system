import type {
  AttendanceDayStatus,
  AttendanceRecord,
  ClockType,
  DayMarker,
  EmployeeDaySummary,
} from "@/types/attendance";
import type { LeaveRequest } from "@/types/system";
import { getEventsForDate } from "@/lib/calendar";
import { getStore, newId, saveStore } from "@/lib/db";
import {
  calcEarlyLeaveMinutes,
  calcLateMinutes,
  calcWorkMinutes,
  getDayRecords,
  getWorkSettings,
} from "@/lib/worktime";

export type RecordsScope = "my" | "all";

function isOnLeave(leaves: LeaveRequest[], employeeId: string, date: string): boolean {
  return leaves.some(
    (l) =>
      l.status === "approved" &&
      l.employeeId === employeeId &&
      date >= l.startDate &&
      date <= l.endDate
  );
}

function hasLeaveOnDate(leaves: LeaveRequest[], date: string, employeeIds?: Set<string>): boolean {
  return leaves.some((l) => {
    if (l.status !== "approved") return false;
    if (date < l.startDate || date > l.endDate) return false;
    if (employeeIds && !employeeIds.has(l.employeeId)) return false;
    return true;
  });
}

function computeDayStatus(
  clockIn: AttendanceRecord | undefined,
  clockOut: AttendanceRecord | undefined,
  onLeave: boolean,
  settings: ReturnType<typeof getWorkSettings>
): Pick<EmployeeDaySummary, "status" | "workMinutes" | "lateMinutes" | "earlyLeaveMinutes"> {
  if (onLeave) {
    return { status: "leave", workMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0 };
  }
  if (!clockIn) {
    return { status: "absent", workMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0 };
  }

  const lateMinutes = clockIn.lateMinutes ?? calcLateMinutes(clockIn.timestamp, settings);
  const earlyLeaveMinutes =
    clockOut?.earlyLeaveMinutes ??
    (clockOut ? calcEarlyLeaveMinutes(clockOut.timestamp, settings) : 0);
  const workMinutes = calcWorkMinutes(
    clockIn.timestamp,
    clockOut?.timestamp,
    settings.breakMinutes
  );

  let status: AttendanceDayStatus = "normal";
  if (lateMinutes > 0) status = "late";
  else if (earlyLeaveMinutes > 0) status = "early_leave";

  return { status, workMinutes, lateMinutes, earlyLeaveMinutes };
}

function filterRecordsByScope(
  records: AttendanceRecord[],
  scope: RecordsScope,
  employeeId: string
): AttendanceRecord[] {
  if (scope === "all") return records;
  return records.filter((r) => r.employeeId === employeeId);
}

function getMonthDates(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return dates;
}

export async function getEmployees() {
  const store = await getStore();
  return store.employees.map(({ password: _p, ...rest }) => rest);
}

export async function getRecords(date?: string, employeeId?: string) {
  const store = await getStore();
  let records = store.records;

  if (employeeId) {
    records = records.filter((r) => r.employeeId === employeeId);
  }

  if (!date) {
    return records;
  }

  return records.filter((record) => record.timestamp.startsWith(date));
}

export async function getMonthMarkers(
  month: string,
  scope: RecordsScope,
  employeeId: string,
  filterEmployeeId?: string
): Promise<Record<string, DayMarker>> {
  const store = await getStore();
  const settings = getWorkSettings(store.workSettings);
  const markers: Record<string, DayMarker> = {};

  const effectiveScope: RecordsScope =
    scope === "all" && filterEmployeeId ? "my" : scope;
  const effectiveEmployeeId =
    scope === "all" && filterEmployeeId ? filterEmployeeId : employeeId;

  const employeeIds =
    effectiveScope === "all"
      ? new Set(store.employees.map((e) => e.id))
      : new Set([effectiveEmployeeId]);

  for (const date of getMonthDates(month)) {
    let hasClock = false;
    let hasLate = false;
    let hasEarlyLeave = false;
    let clockedInCount = 0;
    let leaveCount = 0;
    const totalEmployees = employeeIds.size;

    for (const empId of employeeIds) {
      const { clockIn, clockOut } = getDayRecords(store.records, empId, date);
      if (clockIn) {
        hasClock = true;
        clockedInCount++;
        const late = clockIn.lateMinutes ?? calcLateMinutes(clockIn.timestamp, settings);
        if (late > 0) hasLate = true;
      }
      if (clockOut) {
        const early =
          clockOut.earlyLeaveMinutes ?? calcEarlyLeaveMinutes(clockOut.timestamp, settings);
        if (early > 0) hasEarlyLeave = true;
      }
      if (isOnLeave(store.leaves, empId, date)) {
        leaveCount++;
      }
    }

    const hasLeave = hasLeaveOnDate(store.leaves, date, employeeIds) || leaveCount > 0;

    markers[date] = {
      hasClock,
      hasLeave,
      hasLate,
      hasEarlyLeave,
      ...(effectiveScope === "all"
        ? { clockedInCount, totalEmployees, leaveCount }
        : {}),
    };
  }

  return markers;
}

export async function getMonthRecords(
  month: string,
  scope: RecordsScope,
  employeeId: string,
  filterEmployeeId?: string
) {
  const store = await getStore();
  const effectiveScope: RecordsScope =
    scope === "all" && filterEmployeeId ? "my" : scope;
  const effectiveEmployeeId =
    scope === "all" && filterEmployeeId ? filterEmployeeId : employeeId;

  const records = filterRecordsByScope(
    store.records.filter((r) => r.timestamp.startsWith(month)),
    effectiveScope,
    effectiveEmployeeId
  );
  const markers = await getMonthMarkers(
    month,
    scope,
    employeeId,
    filterEmployeeId
  );

  return {
    month,
    scope,
    markers,
    records,
    employees: store.employees.map(({ password: _p, ...e }) => e),
  };
}

export async function getDayDetail(
  date: string,
  scope: RecordsScope,
  employeeId: string,
  filterEmployeeId?: string
) {
  const store = await getStore();
  const settings = getWorkSettings(store.workSettings);
  const calendarEvents = await getEventsForDate(date);

  if (scope === "my") {
    const { clockIn, clockOut, dayRecords } = getDayRecords(store.records, employeeId, date);
    const onLeave = isOnLeave(store.leaves, employeeId, date);
    const dayStatus = computeDayStatus(clockIn, clockOut, onLeave, settings);
    const leaves = store.leaves.filter(
      (l) =>
        l.employeeId === employeeId &&
        l.status === "approved" &&
        date >= l.startDate &&
        date <= l.endDate
    );

    return {
      date,
      scope,
      summary: {
        clockIn: clockIn?.timestamp,
        clockOut: clockOut?.timestamp,
        ...dayStatus,
      },
      records: dayRecords,
      leaves,
      calendarEvents: calendarEvents.filter(
        (e) => !e.employeeId || e.employeeId === employeeId
      ),
    };
  }

  const targetEmployees = filterEmployeeId
    ? store.employees.filter((e) => e.id === filterEmployeeId)
    : store.employees;

  const employees: EmployeeDaySummary[] = targetEmployees.map((emp) => {
    const { clockIn, clockOut } = getDayRecords(store.records, emp.id, date);
    const onLeave = isOnLeave(store.leaves, emp.id, date);
    const dayStatus = computeDayStatus(clockIn, clockOut, onLeave, settings);

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      clockIn: clockIn?.timestamp,
      clockOut: clockOut?.timestamp,
      ...dayStatus,
    };
  });

  const records = filterEmployeeId
    ? store.records.filter(
        (r) => r.employeeId === filterEmployeeId && r.timestamp.startsWith(date)
      )
    : store.records.filter((r) => r.timestamp.startsWith(date));

  const leaves = store.leaves.filter(
    (l) =>
      l.status === "approved" &&
      date >= l.startDate &&
      date <= l.endDate &&
      (!filterEmployeeId || l.employeeId === filterEmployeeId)
  );

  return {
    date,
    scope,
    employees,
    records,
    leaves,
    calendarEvents,
    employeeOptions: store.employees.map(({ password: _p, ...e }) => e),
  };
}

export async function clockInOut(employeeId: string, type: ClockType, note?: string) {
  const store = await getStore();
  const employee = store.employees.find((item) => item.id === employeeId);

  if (!employee) {
    throw new Error("找不到員工");
  }

  const settings = getWorkSettings(store.workSettings);
  const now = new Date().toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  const { clockIn, clockOut } = getDayRecords(store.records, employeeId, today);

  if (type === "in" && clockIn && !clockOut) {
    throw new Error("今日已上班打卡，請先下班打卡");
  }
  if (type === "out" && !clockIn) {
    throw new Error("請先完成上班打卡");
  }
  if (type === "out" && clockOut) {
    throw new Error("今日已完成下班打卡");
  }

  const record: AttendanceRecord = {
    id: newId("rec"),
    employeeId: employee.id,
    employeeName: employee.name,
    type,
    timestamp: now,
    note,
  };

  if (type === "in") {
    record.lateMinutes = calcLateMinutes(now, settings);
  } else {
    record.earlyLeaveMinutes = calcEarlyLeaveMinutes(now, settings);
  }

  store.records.unshift(record);
  await saveStore(store);

  const workMinutes =
    type === "out" && clockIn
      ? calcWorkMinutes(clockIn.timestamp, now, settings.breakMinutes)
      : 0;

  return {
    record,
    lateMinutes: record.lateMinutes ?? 0,
    earlyLeaveMinutes: record.earlyLeaveMinutes ?? 0,
    workMinutes,
    settings,
  };
}

export async function getTodaySummary(date = new Date().toISOString().slice(0, 10)) {
  const store = await getStore();
  const records = await getRecords(date);
  const clockedIn = new Set(records.filter((r) => r.type === "in").map((r) => r.employeeId));
  const lateCount = records.filter((r) => r.type === "in" && (r.lateMinutes ?? 0) > 0).length;

  return {
    date,
    totalEmployees: store.employees.filter((e) => e.role === "employee").length,
    clockedInCount: clockedIn.size,
    lateCount,
    records,
    workSettings: store.workSettings,
  };
}

/**
 * 補卡：管理員或本人插入指定日期+時間的打卡紀錄
 * date: YYYY-MM-DD  time: HH:MM
 */
export async function makeupClock(
  employeeId: string,
  type: ClockType,
  date: string,
  time: string,
  requesterId: string,
  requesterRole: "admin" | "employee",
  force = false   // 管理員可強制覆蓋已有紀錄
) {
  const store = await getStore();
  const employee = store.employees.find((e) => e.id === employeeId);
  if (!employee) throw new Error("找不到員工");
  if (requesterRole !== "admin" && requesterId !== employeeId) {
    throw new Error("僅管理員可替他人補卡");
  }

  const settings = getWorkSettings(store.workSettings);
  const timestamp = new Date(`${date}T${time}:00+08:00`).toISOString();

  const { clockIn, clockOut } = getDayRecords(store.records, employeeId, date);

  if (type === "out" && !clockIn && !force) throw new Error(`${date} 尚無上班打卡，請先補上班`);

  // force 模式：先刪掉同日同類型的舊紀錄再寫新的
  if (force && requesterRole === "admin") {
    store.records = store.records.filter(
      (r) => !(r.employeeId === employeeId && r.timestamp.startsWith(date) && r.type === type)
    );
  } else {
    if (type === "in" && clockIn) throw new Error(`${date} 已有上班打卡，如需修改請聯絡管理員`);
    if (type === "out" && clockOut) throw new Error(`${date} 已有下班打卡，如需修改請聯絡管理員`);
  }

  const record: AttendanceRecord = {
    id: newId("rec"),
    employeeId: employee.id,
    employeeName: employee.name,
    type,
    timestamp,
    note: force ? "管理員修正" : "補卡",
  };

  if (type === "in") {
    record.lateMinutes = calcLateMinutes(timestamp, settings);
  } else {
    record.earlyLeaveMinutes = calcEarlyLeaveMinutes(timestamp, settings);
  }

  store.records.unshift(record);
  await saveStore(store);

  // 取更新後的上班紀錄計算工時
  const { clockIn: newClockIn } = getDayRecords(store.records, employeeId, date);
  const workMinutes =
    type === "out" && newClockIn
      ? calcWorkMinutes(newClockIn.timestamp, timestamp, settings.breakMinutes)
      : 0;

  return { record, lateMinutes: record.lateMinutes ?? 0, earlyLeaveMinutes: record.earlyLeaveMinutes ?? 0, workMinutes, settings };
}

/** 撤銷今日最後一筆下班打卡（誤按保護） */
export async function undoClockOut(employeeId: string) {
  const store = await getStore();
  const employee = store.employees.find((item) => item.id === employeeId);

  if (!employee) {
    throw new Error("找不到員工");
  }

  const today = new Date().toISOString().slice(0, 10);
  const { dayRecords, clockIn } = getDayRecords(store.records, employeeId, today);

  if (!clockIn) {
    throw new Error("今日尚無上班打卡紀錄");
  }

  const lastRecord = dayRecords[dayRecords.length - 1];
  if (!lastRecord || lastRecord.type !== "out") {
    throw new Error("僅可撤銷今日最後一筆下班打卡");
  }

  store.records = store.records.filter((r) => r.id !== lastRecord.id);
  await saveStore(store);

  return {
    undone: lastRecord,
    status: "working" as const,
  };
}
