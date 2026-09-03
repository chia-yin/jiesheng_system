export type ClockType = "in" | "out";
export type UserRole = "admin" | "employee";

export interface Employee {
  id: string;
  name: string;
  department: string;
  role: UserRole;
  username: string;
  /** 開發階段明文密碼，正式環境應改為 bcrypt passwordHash */
  password: string;
  /** Google 帳號 email（登入比對用） */
  email?: string;
  /** Google OAuth sub */
  googleId?: string;
  /** LINE 使用者 ID（Webhook 綁定後） */
  lineUserId?: string;
  /** Supabase Auth user id（階段 3） */
  supabaseUserId?: string;
  /** 一次性 LINE 綁定碼 */
  lineBindCode?: string;
  lineBindExpiresAt?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: ClockType;
  timestamp: string;
  note?: string;
  /** 上班打卡遲到分鐘數（相對 workSettings.startTime） */
  lateMinutes?: number;
  /** 下班打卡早退分鐘數（相對 workSettings.endTime） */
  earlyLeaveMinutes?: number;
}

export interface AttendanceStore {
  employees: Employee[];
  records: AttendanceRecord[];
}

export interface WorkSettings {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  /** 上班前彈性分鐘數（如 60 = 可提前 1 小時打卡不算遲到） */
  flexBeforeMinutes?: number;
  /** 上班後彈性分鐘數（如 60 = 可延後 1 小時打卡不算遲到） */
  flexAfterMinutes?: number;
}

export interface DayAttendanceSummary {
  date: string;
  clockIn?: string;
  clockOut?: string;
  workMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: "not_started" | "working" | "finished";
  needsBreakReminder: boolean;
}

export interface WeekAttendanceSummary {
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  standardMinutes: number;
  overtimeMinutes: number;
  days: DayAttendanceSummary[];
}

/** 出勤日狀態（紀錄頁用） */
export type AttendanceDayStatus = "normal" | "late" | "early_leave" | "leave" | "absent";

/** 月曆日期標記 */
export interface DayMarker {
  hasClock: boolean;
  hasLeave: boolean;
  hasLate: boolean;
  hasEarlyLeave: boolean;
  /** 管理員全員視圖：當日已打卡人數 */
  clockedInCount?: number;
  /** 管理員全員視圖：員工總數 */
  totalEmployees?: number;
  /** 管理員全員視圖：當日請假人數 */
  leaveCount?: number;
}

/** 全員紀錄表格列 */
export interface EmployeeDaySummary {
  employeeId: string;
  employeeName: string;
  department: string;
  clockIn?: string;
  clockOut?: string;
  workMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: AttendanceDayStatus;
}
