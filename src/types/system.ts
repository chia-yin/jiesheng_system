export type LeaveType = "annual" | "sick" | "personal" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
export type SprintStatus = "planning" | "active" | "completed";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
  googleEventId?: string;
  rejectReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface IntegrationSettings {
  /** LINE 圖文選單 ID，員工綁定成功後自動掛載 */
  lineRichMenuId?: string;
  /** Google 請假同步目標日曆 ID */
  googleCalendarId?: string;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry: number;
  connectedAt: string;
  calendarId?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  pinned: boolean;
  createdAt: string;
}

export interface ProjectPath {
  /** 顯示名稱，如「前端」「API」「GitLab」 */
  label: string;
  /** URL 或本機路徑 */
  url: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  /** 專案路徑組（前後端 / API / GitLab 等），管理員設定 */
  paths?: ProjectPath[];
  status: ProjectStatus;
  managerId?: string;
  managerName?: string;
  memberIds?: string[];
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  /** 舊版專案內迭代才有；公司週期 Sprint 為空 */
  projectId?: string;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  sprintId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  taskTotal: number;
  taskDone: number;
  /** 進行中的公司週期 Sprint（若有） */
  activeSprint?: Sprint;
  /** 本專案納入該 Sprint 的任務數 */
  sprintTaskTotal: number;
  /** 本專案納入該 Sprint 且已完成的任務數 */
  sprintTaskDone: number;
}

export type CalendarEventType =
  | "leave"
  | "meeting_external"
  | "meeting_internal"
  | "meeting"
  | "training"
  | "trip"
  | "project"
  | "sprint"
  | "other";


export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  employeeId?: string;
  projectId?: string;
  leaveId?: string;
  description?: string;
  googleEventId?: string;
  createdAt: string;
}

export interface AggregatedCalendarEvent extends CalendarEvent {
  source: "stored" | "leave" | "project" | "sprint";
  employeeName?: string;
  projectName?: string;
  sprintId?: string;
}

export interface WorkSettings {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  flexBeforeMinutes?: number;
  flexAfterMinutes?: number;
}

export interface SystemStore {
  employees: import("@/types/attendance").Employee[];
  records: import("@/types/attendance").AttendanceRecord[];
  leaves: LeaveRequest[];
  announcements: Announcement[];
  projects: Project[];
  sprints: Sprint[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  workSettings: WorkSettings;
  googleTokens?: GoogleTokens;
  integrationSettings?: IntegrationSettings;
}
