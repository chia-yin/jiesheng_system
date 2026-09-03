import { NextResponse } from "next/server";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getAggregatedEvents,
  getStoredCalendarEvents,
  updateCalendarEvent,
} from "@/lib/calendar";
import type { CalendarEventType } from "@/types/system";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? undefined;
  const date = searchParams.get("date") ?? undefined;
  const storedOnly = searchParams.get("stored") === "true";

  if (storedOnly) {
    const events = await getStoredCalendarEvents();
    return NextResponse.json({ events });
  }

  const events = await getAggregatedEvents(month ?? (date ? date.slice(0, 7) : undefined));

  if (date) {
    return NextResponse.json({
      events: events.filter((e) => {
        const end = e.endDate ?? e.startDate;
        return date >= e.startDate && date <= end;
      }),
    });
  }

  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const type = (body.type ?? "meeting") as CalendarEventType;
    const startDate = String(body.startDate ?? "");
    const endDate = body.endDate ? String(body.endDate) : undefined;
    const startTime = body.startTime ? String(body.startTime) : undefined;
    const endTime = body.endTime ? String(body.endTime) : undefined;
    const description = body.description ? String(body.description) : undefined;

    if (!title || !startDate) {
      return NextResponse.json({ error: "請填寫標題與日期" }, { status: 400 });
    }

    if (!["leave", "meeting", "project", "other"].includes(type)) {
      return NextResponse.json({ error: "事件類型無效" }, { status: 400 });
    }

    const event = await createCalendarEvent({
      title,
      type,
      startDate,
      endDate,
      startTime,
      endTime,
      description,
    });

    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id ?? "");

    if (!id) {
      return NextResponse.json({ error: "缺少事件 ID" }, { status: 400 });
    }

    const event = await updateCalendarEvent(id, {
      title: body.title !== undefined ? String(body.title) : undefined,
      type: body.type as CalendarEventType | undefined,
      startDate: body.startDate !== undefined ? String(body.startDate) : undefined,
      endDate: body.endDate !== undefined ? String(body.endDate) : undefined,
      startTime: body.startTime !== undefined ? String(body.startTime) : undefined,
      endTime: body.endTime !== undefined ? String(body.endTime) : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
    });

    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") ?? "";

    if (!id) {
      return NextResponse.json({ error: "缺少事件 ID" }, { status: 400 });
    }

    const event = await deleteCalendarEvent(id);
    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "刪除失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
