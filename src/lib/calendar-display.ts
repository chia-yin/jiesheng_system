import type { AggregatedCalendarEvent, CalendarEventType } from "@/types/system";
import { formatEventDisplayTitle } from "@/lib/calendar-types";

const CHIP_LIMIT = 2;

function eventEndDate(event: AggregatedCalendarEvent): string {
  return event.endDate ?? event.startDate;
}

export function eventOnDate(event: AggregatedCalendarEvent, date: string): boolean {
  const end = eventEndDate(event);
  return date >= event.startDate && date <= end;
}

function compactSprintLabel(event: AggregatedCalendarEvent): string {
  const parts = event.title.split(" · ");
  if (parts.length >= 2) {
    const project = parts[0].replace(/專案$/, "");
    return `${project} ${parts[1]}`;
  }
  return event.title.length > 14 ? `${event.title.slice(0, 13)}…` : event.title;
}

function formatEventDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("zh-TW");
}

export function formatEventDateRange(event: AggregatedCalendarEvent): string {
  const end = eventEndDate(event);
  const start = formatEventDateLabel(event.startDate);
  if (end === event.startDate) return start;
  return `${start} – ${formatEventDateLabel(end)}`;
}

export interface ParsedSprintTitle {
  project: string;
  phase: string;
  subtitle?: string;
}

export function parseSprintTitle(title: string): ParsedSprintTitle | null {
  const parts = title.split(" · ");
  if (parts.length < 2) return null;
  return {
    project: parts[0].replace(/專案$/, ""),
    phase: parts[1],
    subtitle: parts[2],
  };
}

export type EventDayPhase = "single" | "start" | "end" | "ongoing";

export function getEventDayPhase(event: AggregatedCalendarEvent, date: string): EventDayPhase {
  const end = eventEndDate(event);
  if (end === event.startDate) return "single";
  if (event.startDate === date) return "start";
  if (end === date) return "end";
  return "ongoing";
}

export function getEventDayStatusLabel(phase: EventDayPhase): string | null {
  switch (phase) {
    case "start":
      return "開始";
    case "end":
      return "結束";
    case "ongoing":
      return "進行中";
    default:
      return null;
  }
}

/** 依類型與日期排序（會議優先，進行中迭代靠後） */
export function sortDayEvents(events: AggregatedCalendarEvent[], date: string): AggregatedCalendarEvent[] {
  const priority = (ev: AggregatedCalendarEvent) => {
    const phase = getEventDayPhase(ev, date);
    const base = chipPriority(ev.type);
    if (phase === "ongoing") return base + 10;
    if (phase === "end") return base + 5;
    return base;
  };
  return [...events].sort((a, b) => priority(a) - priority(b));
}

function chipPriority(type: CalendarEventType): number {
  switch (type) {
    case "meeting_external":
    case "meeting_internal":
    case "meeting":
    case "company_event":
      return 0;
    case "milestone":
      return 1;
    case "project":
      return 2;
    case "leave":
      return 3;
    case "sprint":
      return 4;
    default:
      return 6;
  }
}

export interface MonthCellChip {
  event: AggregatedCalendarEvent;
  label: string;
}

export interface MonthCellDot {
  event: AggregatedCalendarEvent;
  type: CalendarEventType;
}

export interface MonthCellDisplay {
  chips: MonthCellChip[];
  dots: MonthCellDot[];
  moreCount: number;
}

/** 月曆格子：跨日事件在每一天都顯示文字 chip */
export function buildMonthCellDisplay(
  date: string,
  events: AggregatedCalendarEvent[]
): MonthCellDisplay {
  const onDate = events.filter((e) => eventOnDate(e, date));

  const chipCandidates: Array<MonthCellChip & { priority: number }> = [];

  for (const ev of onDate) {
    const base = ev.type === "sprint" ? compactSprintLabel(ev) : ev.title;
    const label = formatEventDisplayTitle(ev.type, base);
    chipCandidates.push({
      event: ev,
      label,
      priority: chipPriority(ev.type),
    });
  }

  chipCandidates.sort((a, b) => a.priority - b.priority);

  const chips = chipCandidates.slice(0, CHIP_LIMIT).map(({ event, label }) => ({ event, label }));
  const moreCount = Math.max(0, chipCandidates.length - CHIP_LIMIT);

  return { chips, dots: [], moreCount };
}
