import type { CalendarEventType } from "@/types/system";

/** 會寫入公司 Google 日曆的事件類型（不含請假；請假另處理） */
export const GOOGLE_SYNCABLE_EVENT_TYPES: CalendarEventType[] = [
  "meeting_external",
  "meeting_internal",
  "meeting", // 舊資料相容 → 視為內部會議
  "company_event",
  "milestone",
];

/** 使用者可手動新增的類型 */
export const CREATABLE_EVENT_TYPES: CalendarEventType[] = [
  "meeting_external",
  "meeting_internal",
  "company_event",
  "milestone",
  "other",
];

export const EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  leave: "[休假]",
  meeting_external: "[外部會議]",
  meeting_internal: "[內部會議]",
  meeting: "[內部會議]",
  company_event: "[公司活動]",
  milestone: "[里程碑]",
  training: "[訓練]",
  trip: "[出差]",
  project: "[專案]",
  sprint: "[迭代]",
  other: "其他",
};

/** 請假同步／月曆標題：`[休假] 陳家盈 特休` */
export function formatLeaveTitle(employeeName: string, leaveTypeLabel: string): string {
  return `[休假] ${employeeName} ${leaveTypeLabel}`;
}

export function isGoogleSyncableEventType(type: CalendarEventType): boolean {
  return GOOGLE_SYNCABLE_EVENT_TYPES.includes(type);
}

export function normalizeEventType(type: string): CalendarEventType {
  const allowed: CalendarEventType[] = [
    "leave",
    "meeting_external",
    "meeting_internal",
    "meeting",
    "company_event",
    "milestone",
    "training",
    "trip",
    "project",
    "sprint",
    "other",
  ];
  if (allowed.includes(type as CalendarEventType)) return type as CalendarEventType;
  return "other";
}
