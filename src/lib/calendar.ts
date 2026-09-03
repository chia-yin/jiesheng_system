import { getStore, newId, saveStore } from "@/lib/db";
import { formatSprintDisplay } from "@/lib/project-ui";
import type { CalendarEvent, CalendarEventType, AggregatedCalendarEvent } from "@/types/system";

export { WEEKDAYS, getMonthGrid, toDateStr, parseMonthKey } from "@/lib/calendar-grid";
export type { DayCell } from "@/lib/calendar-grid";

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: "特休",
  sick: "病假",
  personal: "事假",
  other: "其他",
};

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function eachDateInRange(start: string, end?: string): string[] {
  const dates: string[] = [];
  const startDate = parseDate(start);
  const endDate = parseDate(end ?? start);
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function eventOccursOnDate(event: AggregatedCalendarEvent, date: string): boolean {
  const end = event.endDate ?? event.startDate;
  return date >= event.startDate && date <= end;
}

export async function getStoredCalendarEvents(): Promise<CalendarEvent[]> {
  const store = await getStore();
  return store.calendarEvents.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getAggregatedEvents(month?: string): Promise<AggregatedCalendarEvent[]> {
  const store = await getStore();
  const events: AggregatedCalendarEvent[] = [];

  for (const leave of store.leaves) {
    if (leave.status !== "approved") continue;
    events.push({
      id: `leave-${leave.id}`,
      title: `${leave.employeeName} ${LEAVE_TYPE_LABEL[leave.type] ?? leave.type}`,
      type: "leave",
      startDate: leave.startDate,
      endDate: leave.endDate,
      employeeId: leave.employeeId,
      leaveId: leave.id,
      description: leave.reason,
      googleEventId: leave.googleEventId,
      createdAt: leave.createdAt,
      source: "leave",
      employeeName: leave.employeeName,
    });
  }

  const projectById = new Map(store.projects.map((p) => [p.id, p]));

  for (const sprint of store.sprints) {
    if (!sprint.projectId) {
      events.push({
        id: `sprint-${sprint.id}`,
        title: formatSprintDisplay(sprint.name),
        type: "sprint",
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        sprintId: sprint.id,
        description: sprint.goal,
        createdAt: sprint.createdAt,
        source: "sprint",
      });
      continue;
    }

    const project = projectById.get(sprint.projectId);
    if (!project) continue;

    events.push({
      id: `sprint-${sprint.id}`,
      title: `${project.name} · ${formatSprintDisplay(sprint.name)}`,
      type: "sprint",
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      projectId: project.id,
      sprintId: sprint.id,
      description: sprint.goal,
      createdAt: sprint.createdAt,
      source: "sprint",
      projectName: project.name,
    });
  }

  for (const project of store.projects) {
    if (project.startDate) {
      events.push({
        id: `proj-start-${project.id}`,
        title: `${project.name} 啟動`,
        type: "project",
        startDate: project.startDate,
        projectId: project.id,
        description: project.description,
        createdAt: project.createdAt,
        source: "project",
        projectName: project.name,
      });
    }
    if (project.endDate) {
      events.push({
        id: `proj-end-${project.id}`,
        title: `${project.name} 結束`,
        type: "project",
        startDate: project.endDate,
        projectId: project.id,
        description: project.description,
        createdAt: project.createdAt,
        source: "project",
        projectName: project.name,
      });
    }
  }

  for (const event of store.calendarEvents) {
    events.push({ ...event, source: "stored" });
  }

  if (!month) return events;

  return events.filter((event) => {
    const range = eachDateInRange(event.startDate, event.endDate);
    return range.some((d) => d.startsWith(month));
  });
}

export async function getEventsForDate(date: string): Promise<AggregatedCalendarEvent[]> {
  const events = await getAggregatedEvents(date.slice(0, 7));
  return events.filter((event) => eventOccursOnDate(event, date));
}

export async function createCalendarEvent(input: {
  title: string;
  type: CalendarEventType;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  employeeId?: string;
  projectId?: string;
}) {
  const store = await getStore();

  if (input.endDate && input.endDate < input.startDate) {
    throw new Error("結束日期不可早於開始日期");
  }

  const event: CalendarEvent = {
    id: newId("cal"),
    title: input.title.trim(),
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    startTime: input.startTime,
    endTime: input.endTime,
    description: input.description?.trim(),
    employeeId: input.employeeId,
    projectId: input.projectId,
    createdAt: new Date().toISOString(),
  };

  store.calendarEvents.unshift(event);
  await saveStore(store);

  try {
    const { syncCalendarEventToGoogle } = await import("@/lib/google-calendar");
    await syncCalendarEventToGoogle(event);
  } catch (error) {
    console.error("[calendar] auto sync after create failed:", error);
  }

  const refreshed = (await getStore()).calendarEvents.find((e) => e.id === event.id);
  return refreshed ?? event;
}

export async function updateCalendarEvent(
  id: string,
  input: Partial<{
    title: string;
    type: CalendarEventType;
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    description?: string;
  }>
) {
  const store = await getStore();
  const event = store.calendarEvents.find((e) => e.id === id);

  if (!event) {
    throw new Error("找不到事件");
  }

  if (input.title !== undefined) event.title = input.title.trim();
  if (input.type !== undefined) event.type = input.type;
  if (input.startDate !== undefined) event.startDate = input.startDate;
  if (input.endDate !== undefined) event.endDate = input.endDate;
  if (input.startTime !== undefined) event.startTime = input.startTime;
  if (input.endTime !== undefined) event.endTime = input.endTime;
  if (input.description !== undefined) event.description = input.description?.trim();

  if (event.endDate && event.endDate < event.startDate) {
    throw new Error("結束日期不可早於開始日期");
  }

  await saveStore(store);

  try {
    const { syncCalendarEventToGoogle } = await import("@/lib/google-calendar");
    await syncCalendarEventToGoogle(event);
  } catch (error) {
    console.error("[calendar] auto sync after update failed:", error);
  }

  const refreshed = (await getStore()).calendarEvents.find((e) => e.id === id);
  return refreshed ?? event;
}

export async function deleteCalendarEvent(id: string) {
  const store = await getStore();
  const index = store.calendarEvents.findIndex((e) => e.id === id);

  if (index === -1) {
    throw new Error("找不到事件");
  }

  const [removed] = store.calendarEvents.splice(index, 1);
  await saveStore(store);
  return removed;
}

function escapeIcalText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcalDateTime(date: string, time?: string): string {
  if (time) {
    const [h, m] = time.split(":");
    const d = parseDate(date);
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(h), Number(m));
    return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }
  return date.replace(/-/g, "");
}

export async function generateIcsContent(): Promise<string> {
  const events = await getAggregatedEvents();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//杰勝科技//考勤系統//ZH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:杰勝科技公司行事曆",
  ];

  for (const event of events) {
    if (event.type === "other") continue;
    const uid = `${event.id}@jiesheng-system`;
    const endDate = event.endDate ?? event.startDate;
    const isAllDay = !event.startTime;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`SUMMARY:${escapeIcalText(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcalText(event.description)}`);
    }

    if (isAllDay) {
      const nextDay = parseDate(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${toIcalDateTime(event.startDate)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDate(nextDay).replace(/-/g, "")}`);
    } else {
      lines.push(`DTSTART:${toIcalDateTime(event.startDate, event.startTime)}`);
      lines.push(`DTEND:${toIcalDateTime(endDate, event.endTime ?? event.startTime)}`);
    }

    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function buildGoogleCalendarUrl(event: AggregatedCalendarEvent): string {
  const endDate = event.endDate ?? event.startDate;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.description ?? "",
  });

  if (event.startTime) {
    const start = toIcalDateTime(event.startDate, event.startTime);
    const end = toIcalDateTime(endDate, event.endTime ?? event.startTime);
    params.set("dates", `${start}/${end}`);
  } else {
    const nextDay = parseDate(endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    params.set("dates", `${toIcalDateTime(event.startDate)}/${formatDate(nextDay).replace(/-/g, "")}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export type { AggregatedCalendarEvent };
