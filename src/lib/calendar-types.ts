import type { CalendarEventType } from "@/types/system";

/** 會寫入公司 Google 日曆的事件類型（不含請假；請假另處理） */
export const GOOGLE_SYNCABLE_EVENT_TYPES: CalendarEventType[] = [
  "meeting_external",
  "meeting_internal",
  "meeting", // 舊資料相容
  "training",
  "trip",
];

/** 使用者可手動新增的類型 */
export const CREATABLE_EVENT_TYPES: CalendarEventType[] = [
  "meeting_external",
  "meeting_internal",
  "training",
  "trip",
  "other",
];

export const EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  leave: "請假",
  meeting_external: "例行對外",
  meeting_internal: "例行對內",
  meeting: "會議",
  training: "訓練",
  trip: "出差",
  project: "專案",
  sprint: "迭代",
  other: "其他",
};

export function isGoogleSyncableEventType(type: CalendarEventType): boolean {
  return GOOGLE_SYNCABLE_EVENT_TYPES.includes(type);
}

export function normalizeEventType(type: string): CalendarEventType {
  const allowed: CalendarEventType[] = [
    "leave",
    "meeting_external",
    "meeting_internal",
    "meeting",
    "training",
    "trip",
    "project",
    "sprint",
    "other",
  ];
  if (allowed.includes(type as CalendarEventType)) return type as CalendarEventType;
  return "other";
}
