import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStore, saveStore } from "@/lib/db";
import { listTaiwanHolidays } from "@/lib/taiwan-holidays";
import { resolveWorkDay } from "@/lib/work-calendar";
import type { CompanyCalendarDay } from "@/types/system";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDay(raw: unknown): CompanyCalendarDay | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const date = String(obj.date ?? "").trim();
  const kind = String(obj.kind ?? "").trim();
  const name = String(obj.name ?? "").trim();
  if (!DATE_RE.test(date)) return null;
  if (kind !== "holiday" && kind !== "workday") return null;
  return {
    date,
    kind,
    name: name || (kind === "workday" ? "公司補班" : "公司放假"),
  };
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const store = await getStore();
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    const companyDays = [...(store.workSettings?.companyCalendarDays ?? [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const taiwan = listTaiwanHolidays(Number.isFinite(year) ? year : undefined);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
    const todayDecision = resolveWorkDay(today, companyDays);

    return NextResponse.json({
      today,
      todayDecision,
      companyDays,
      taiwanHolidays: taiwan,
      year: Number.isFinite(year) ? year : new Date().getFullYear(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** 新增或覆寫單日公司設定 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const day = normalizeDay(body);
    if (!day) {
      return NextResponse.json({ error: "請提供有效的 date、kind（holiday|workday）、name" }, { status: 400 });
    }

    const store = await getStore();
    const list = [...(store.workSettings.companyCalendarDays ?? [])].filter((d) => d.date !== day.date);
    list.push(day);
    list.sort((a, b) => a.date.localeCompare(b.date));
    store.workSettings = {
      ...store.workSettings,
      companyCalendarDays: list,
    };
    await saveStore(store);

    return NextResponse.json({ ok: true, day, companyDays: list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "儲存失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** 刪除公司覆寫日：body { date } 或 ?date= */
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    let date = url.searchParams.get("date")?.trim() ?? "";
    if (!date) {
      try {
        const body = await request.json();
        date = String(body.date ?? "").trim();
      } catch {
        // ignore
      }
    }
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: "請提供 date（YYYY-MM-DD）" }, { status: 400 });
    }

    const store = await getStore();
    const list = (store.workSettings.companyCalendarDays ?? []).filter((d) => d.date !== date);
    store.workSettings = {
      ...store.workSettings,
      companyCalendarDays: list,
    };
    await saveStore(store);

    return NextResponse.json({ ok: true, companyDays: list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "刪除失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
