"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Link2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  User,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  buildMonthCellDisplay,
  eventOnDate,
  formatEventDateRange,
  getEventDayPhase,
  getEventDayStatusLabel,
  parseSprintTitle,
  sortDayEvents,
} from "@/lib/calendar-display";
import type { AggregatedCalendarEvent, CalendarEventType } from "@/types/system";
import { CREATABLE_EVENT_TYPES, EVENT_TYPE_LABEL, isGoogleSyncableEventType } from "@/lib/calendar-types";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const TYPE_CONFIG: Record<
  CalendarEventType,
  { label: string; chip: string; legend: string; dot: string }
> = {
  leave: {
    label: EVENT_TYPE_LABEL.leave,
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    legend: "cal-legend-chip bg-emerald-50 text-emerald-700 border-emerald-200/60",
    dot: "bg-emerald-500",
  },
  meeting_external: {
    label: EVENT_TYPE_LABEL.meeting_external,
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
    legend: "cal-legend-chip bg-indigo-50 text-indigo-700 border-indigo-200/60",
    dot: "bg-indigo-500",
  },
  meeting_internal: {
    label: EVENT_TYPE_LABEL.meeting_internal,
    chip: "bg-blue-50 text-blue-700 border-blue-200/60",
    legend: "cal-legend-chip bg-blue-50 text-blue-700 border-blue-200/60",
    dot: "bg-blue-500",
  },
  meeting: {
    label: EVENT_TYPE_LABEL.meeting,
    chip: "bg-blue-50 text-blue-700 border-blue-200/60",
    legend: "cal-legend-chip bg-blue-50 text-blue-700 border-blue-200/60",
    dot: "bg-blue-500",
  },
  training: {
    label: EVENT_TYPE_LABEL.training,
    chip: "bg-cyan-50 text-cyan-700 border-cyan-200/60",
    legend: "cal-legend-chip bg-cyan-50 text-cyan-700 border-cyan-200/60",
    dot: "bg-cyan-500",
  },
  trip: {
    label: EVENT_TYPE_LABEL.trip,
    chip: "bg-orange-50 text-orange-700 border-orange-200/60",
    legend: "cal-legend-chip bg-orange-50 text-orange-700 border-orange-200/60",
    dot: "bg-orange-500",
  },
  project: {
    label: EVENT_TYPE_LABEL.project,
    chip: "bg-amber-50 text-amber-700 border-amber-200/60",
    legend: "cal-legend-chip bg-amber-50 text-amber-700 border-amber-200/60",
    dot: "bg-amber-500",
  },
  sprint: {
    label: EVENT_TYPE_LABEL.sprint,
    chip: "bg-violet-50 text-violet-700 border-violet-200/60",
    legend: "cal-legend-chip bg-violet-50 text-violet-700 border-violet-200/60",
    dot: "bg-violet-500",
  },
  other: {
    label: EVENT_TYPE_LABEL.other,
    chip: "bg-slate-50 text-slate-600 border-slate-200/60",
    legend: "cal-legend-chip bg-slate-50 text-slate-600 border-slate-200/60",
    dot: "bg-slate-400",
  },
};

const LEGEND_TYPES: CalendarEventType[] = [
  "leave",
  "meeting_external",
  "meeting_internal",
  "training",
  "trip",
  "project",
  "sprint",
  "other",
];


interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
  isAdmin: boolean;
}

function formatMonthLabel(year: number, month: number) {
  return `${year}年${month}月`;
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildGoogleUrl(event: AggregatedCalendarEvent) {
  const endDate = event.endDate ?? event.startDate;
  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title });
  if (event.description) params.set("details", event.description);

  if (event.startTime) {
    const fmt = (d: string, t: string) => d.replace(/-/g, "") + "T" + t.replace(":", "") + "00";
    params.set("dates", `${fmt(event.startDate, event.startTime)}/${fmt(endDate, event.endTime ?? event.startTime)}`);
  } else {
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    const endStr = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, "0")}${String(end.getDate()).padStart(2, "0")}`;
    params.set("dates", `${event.startDate.replace(/-/g, "")}/${endStr}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

interface DayCell {
  date: string;
  day: number;
  inMonth: boolean;
  isWeekend: boolean;
}

function getMonthGrid(year: number, month: number): DayCell[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();
  const cells: DayCell[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    const dow = new Date(y, m - 1, day).getDay();
    cells.push({ date: toDateStr(y, m, day), day, inMonth: false, isWeekend: dow === 0 || dow === 6 });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    cells.push({ date: toDateStr(year, month, d), day: d, inMonth: true, isWeekend: dow === 0 || dow === 6 });
  }

  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    const dow = new Date(y, m - 1, d).getDay();
    cells.push({ date: toDateStr(y, m, d), day: d, inMonth: false, isWeekend: dow === 0 || dow === 6 });
  }

  return cells;
}

function formatDayTitle(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function CalendarEventCard({
  event,
  viewDate,
  onClick,
}: {
  event: AggregatedCalendarEvent;
  viewDate?: string;
  onClick: () => void;
}) {
  const config = TYPE_CONFIG[event.type];
  const sprint = event.type === "sprint" ? parseSprintTitle(event.title) : null;
  const phase = viewDate ? getEventDayPhase(event, viewDate) : "single";
  const statusLabel = getEventDayStatusLabel(phase);

  return (
    <button type="button" onClick={onClick} className={`cal-event-item cal-event-item--${event.type}`}>
      <div className="cal-event-item-head">
        <span className="cal-event-type">
          <span className={`cal-event-type-dot ${config.dot}`} />
          {config.label}
        </span>
        {statusLabel && <span className="cal-event-status">{statusLabel}</span>}
      </div>
      {sprint ? (
        <>
          <p className="cal-event-project">{sprint.project}</p>
          <p className="cal-event-title">
            {sprint.phase}
            {sprint.subtitle ? ` · ${sprint.subtitle}` : ""}
          </p>
        </>
      ) : (
        <p className="cal-event-title">{event.title}</p>
      )}
      <p className="cal-event-meta">
        <Calendar className="h-3 w-3 shrink-0" />
        {formatEventDateRange(event)}
        {event.startTime && (
          <span>
            · {event.startTime}
            {event.endTime ? ` – ${event.endTime}` : ""}
          </span>
        )}
      </p>
    </button>
  );
}

function CalendarEventDetail({ event }: { event: AggregatedCalendarEvent }) {
  const config = TYPE_CONFIG[event.type];
  const sprint = event.type === "sprint" ? parseSprintTitle(event.title) : null;

  return (
    <div className={`cal-event-detail cal-event-detail--${event.type}`}>
      <div className="cal-event-detail-top">
        <span className={`cal-event-detail-badge ${config.chip}`}>
          <span className={`cal-event-type-dot ${config.dot}`} />
          {config.label}
        </span>
        {(event.source === "leave" ||
          (event.source === "stored" && isGoogleSyncableEventType(event.type))) && (
          <span
            className={`cal-event-sync-chip ${
              event.googleEventId ? "synced" : "pending"
            }`}
          >
            {event.googleEventId ? "已同步 Google" : "尚未同步"}
          </span>
        )}
        {event.source === "stored" && event.type === "other" && (
          <span className="cal-event-sync-chip pending">僅系統內</span>
        )}
      </div>

      {sprint ? (
        <div className="cal-event-detail-title-block">
          <p className="cal-event-detail-kicker">{sprint.project}</p>
          <h3 className="cal-event-detail-title">
            {sprint.phase}
            {sprint.subtitle ? ` · ${sprint.subtitle}` : ""}
          </h3>
        </div>
      ) : (
        <h3 className="cal-event-detail-title">{event.title}</h3>
      )}

      <div className="cal-event-detail-rows">
        <div className="cal-event-detail-row">
          <Calendar className="h-4 w-4 shrink-0 text-[var(--primary)]" />
          <div>
            <p className="cal-event-detail-row-label">日期</p>
            <p className="cal-event-detail-row-value">{formatEventDateRange(event)}</p>
          </div>
        </div>
        {(event.startTime || event.endTime) && (
          <div className="cal-event-detail-row">
            <Clock className="h-4 w-4 shrink-0 text-[var(--primary)]" />
            <div>
              <p className="cal-event-detail-row-label">時間</p>
              <p className="cal-event-detail-row-value">
                {event.startTime}
                {event.endTime ? ` – ${event.endTime}` : ""}
              </p>
            </div>
          </div>
        )}
        {event.employeeName && (
          <div className="cal-event-detail-row">
            <User className="h-4 w-4 shrink-0 text-[var(--primary)]" />
            <div>
              <p className="cal-event-detail-row-label">人員</p>
              <p className="cal-event-detail-row-value">{event.employeeName}</p>
            </div>
          </div>
        )}
        {event.projectName && (
          <div className="cal-event-detail-row">
            <MapPin className="h-4 w-4 shrink-0 text-[var(--primary)]" />
            <div>
              <p className="cal-event-detail-row-label">專案</p>
              <p className="cal-event-detail-row-value">{event.projectName}</p>
            </div>
          </div>
        )}
      </div>

      {event.description && (
        <div className="cal-event-detail-desc">
          <p className="cal-event-detail-row-label">說明</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">{event.description}</p>
        </div>
      )}
    </div>
  );
}

type ModalMode = "create" | "edit" | "detail" | "day" | "subscribe" | null;

export default function Page() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-[var(--muted)]">載入行事曆…</div>}>
      <CalendarPage />
    </Suspense>
  );
}

function CalendarPage() {
  const searchParams = useSearchParams();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState<AggregatedCalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate()));
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEvent, setSelectedEvent] = useState<AggregatedCalendarEvent | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);

  const [form, setForm] = useState({
    title: "",
    type: "meeting_internal" as CalendarEventType,
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    description: "",
  });

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const loadEvents = useCallback(async () => {
    const res = await fetch(`/api/calendar?month=${monthKey}`);
    const data = await res.json();
    setEvents(data.events ?? []);
  }, [monthKey]);

  const loadGoogleStatus = useCallback(async () => {
    const res = await fetch("/api/calendar/google-status");
    if (res.ok) {
      setGoogleStatus(await res.json());
    }
  }, []);

  useEffect(() => {
    loadEvents();
    loadGoogleStatus();
  }, [loadEvents, loadGoogleStatus]);

  useEffect(() => {
    const oauth = searchParams.get("oauth");
    const error = searchParams.get("error");

    if (oauth === "connected") {
      showToast("已成功連結 Google 日曆");
      loadGoogleStatus();
      window.history.replaceState({}, "", "/calendar");
    } else if (error === "oauth_not_configured") {
      showToast("請管理員設定 Google OAuth 憑證");
      window.history.replaceState({}, "", "/calendar");
    } else if (error) {
      showToast("Google 日曆連結失敗，請重試");
      window.history.replaceState({}, "", "/calendar");
    }
  }, [searchParams, showToast, loadGoogleStatus]);

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const dayEvents = useMemo(
    () => sortDayEvents(events.filter((e) => eventOnDate(e, selectedDate)), selectedDate),
    [events, selectedDate]
  );

  function closeModal() {
    setModalMode(null);
    setSelectedEvent(null);
    setEditingId(null);
    setMessage("");
  }

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function goToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDate(toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate()));
  }

  function openCreateForm(date?: string) {
    setEditingId(null);
    setSelectedEvent(null);
    setForm({
      title: "",
      type: "meeting_internal",
      startDate: date ?? selectedDate,
      endDate: date ?? selectedDate,
      startTime: "09:00",
      endTime: "10:00",
      description: "",
    });
    setModalMode("create");
  }

  function openEditForm(event: AggregatedCalendarEvent) {
    setEditingId(event.id);
    setSelectedEvent(event);
    const editType =
      event.type === "meeting" ? "meeting_internal" : event.type;
    setForm({
      title: event.title,
      type: CREATABLE_EVENT_TYPES.includes(editType) ? editType : "meeting_internal",
      startDate: event.startDate,
      endDate: event.endDate ?? event.startDate,
      startTime: event.startTime ?? "",
      endTime: event.endTime ?? "",
      description: event.description ?? "",
    });
    setModalMode("edit");
  }

  function openEventDetail(event: AggregatedCalendarEvent, e?: React.MouseEvent) {
    e?.stopPropagation();
    setSelectedEvent(event);
    setModalMode("detail");
  }

  function openDayModal(date: string) {
    setSelectedDate(date);
    setModalMode("day");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        endDate: form.endDate || form.startDate,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
      };

      const res = await fetch("/api/calendar", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "儲存失敗");

      closeModal();
      await loadEvents();
      showToast(editingId ? "事件已更新" : "事件已新增");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除此事件？")) return;
    await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
    closeModal();
    await loadEvents();
    showToast("事件已刪除");
  }

  async function copySubscribeLink() {
    const url = `${window.location.origin}/api/calendar/export.ics`;
    await navigator.clipboard.writeText(url);
    showToast("訂閱連結已複製到剪貼簿");
  }

  async function handleManualSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "同步失敗");
      if (data.errors?.length) {
        showToast(`同步 ${data.synced} 筆；${data.errors.length} 筆失敗`);
      } else {
        showToast(`已同步 ${data.synced} 筆至 Google 日曆（請假／會議等）`);
      }
      await loadEvents();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "同步失敗");
    } finally {
      setSyncing(false);
    }
  }

  function handleGoogleConnect() {
    if (!googleStatus?.configured) {
      showToast("請管理員設定 Google OAuth 憑證");
      return;
    }
    window.location.href = "/api/auth/google";
  }

  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const formContent = (
    <form id="calendar-form" onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">標題</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="input-field"
          placeholder="輸入會議或事件名稱"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">類型</label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as CalendarEventType })}
          className="input-field"
        >
          {CREATABLE_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABEL[t]}
              {t === "other" ? "（不同步 Google）" : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--faint)]">
          例行對外／對內、訓練、出差會同步公司 Google；「其他」僅系統內顯示。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">開始日期</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">結束日期</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className="input-field"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">開始時間</label>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">結束時間</label>
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            className="input-field"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">說明</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input-field min-h-[88px]"
          placeholder="選填：會議議程或備註"
        />
      </div>
      {message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--red)]">{message}</p>}
    </form>
  );

  return (
    <div className="space-y-5">
      {/* 工具列 */}
      <section className="cal-toolbar">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={prevMonth} className="btn-secondary p-2" aria-label="上個月">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="min-w-[120px] text-center text-lg font-semibold tracking-tight">
              {formatMonthLabel(year, month)}
            </h2>
            <button type="button" onClick={nextMonth} className="btn-secondary p-2" aria-label="下個月">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={goToday} className="btn-secondary px-3 py-1.5 text-xs">
            今天
          </button>

          {googleStatus && (
            <span
              className={`cal-status-badge ${googleStatus.connected ? "connected" : "disconnected"}`}
            >
              {googleStatus.connected ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  已連結 Google 日曆
                </>
              ) : (
                <>尚未連結 Google 日曆</>
              )}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModalMode("subscribe")}
            className="btn-secondary gap-1.5 px-3 py-2 text-xs"
          >
            <Link2 className="h-3.5 w-3.5" />
            訂閱
          </button>

          {googleStatus?.isAdmin && !googleStatus.connected && (
            <button
              type="button"
              onClick={handleGoogleConnect}
              className="btn-secondary gap-1.5 px-3 py-2 text-xs"
              title={!googleStatus.configured ? "請管理員設定 Google OAuth 憑證" : undefined}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              連結 Google
            </button>
          )}
          {googleStatus?.isAdmin && googleStatus.connected && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncing}
              className="btn-secondary gap-1.5 px-3 py-2 text-xs disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              同步 Google
            </button>
          )}

          <button type="button" onClick={() => openCreateForm()} className="btn-primary gap-1.5 px-3 py-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            新增事件
          </button>
        </div>
      </section>

      {/* 圖例 */}
      <div className="flex flex-wrap items-center gap-2">
        {LEGEND_TYPES.map((type) => (
          <span key={type} className={TYPE_CONFIG[type].legend}>
            <span className={`h-2 w-2 rounded-full ${TYPE_CONFIG[type].dot}`} />
            {TYPE_CONFIG[type].label}
          </span>
        ))}
      </div>

      {/* 月曆 */}
      <section className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--line)] bg-gradient-to-b from-slate-50 to-white">
          {WEEKDAYS.map((wd, i) => (
            <div
              key={wd}
              className={`py-2.5 text-center text-xs font-semibold ${
                i === 0 || i === 6 ? "text-[var(--faint)]" : "text-[var(--muted)]"
              }`}
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((cell) => {
            const { chips, dots, moreCount } = buildMonthCellDisplay(cell.date, events);
            const isToday = cell.date === todayStr;
            const isSelected = cell.date === selectedDate && modalMode !== "day";

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => openDayModal(cell.date)}
                className={`cal-day-cell ${!cell.inMonth ? "is-outside" : ""} ${
                  cell.isWeekend ? "is-weekend" : ""
                } ${isSelected ? "is-selected" : ""}`}
              >
                <span className={`cal-day-num ${isToday ? "is-today" : ""}`}>{cell.day}</span>
                <div className="mt-1 space-y-0.5">
                  {chips.map(({ event: ev, label }) => (
                    <div
                      key={`${ev.id}-chip`}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => openEventDetail(ev, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openEventDetail(ev, e as unknown as React.MouseEvent);
                        }
                      }}
                      className={`cal-event-chip border ${TYPE_CONFIG[ev.type].chip}`}
                      title={ev.title}
                    >
                      {label}
                    </div>
                  ))}
                  {dots.length > 0 && (
                    <div className="cal-ongoing-dots" title="進行中的跨日事件">
                      {dots.map(({ event: ev, type }) => (
                        <span
                          key={`${ev.id}-dot`}
                          role="button"
                          tabIndex={0}
                          className={`cal-ongoing-dot ${type}`}
                          title={ev.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEventDetail(ev, e);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              openEventDetail(ev, e as unknown as React.MouseEvent);
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {moreCount > 0 && (
                    <p className="px-0.5 text-[10px] font-medium text-[var(--muted)]">+{moreCount} 更多</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 新增/編輯 Modal */}
      <Modal
        open={modalMode === "create" || modalMode === "edit"}
        onClose={closeModal}
        title={modalMode === "edit" ? "編輯事件" : "新增事件"}
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn-secondary">
              取消
            </button>
            <button type="submit" form="calendar-form" disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? "儲存中…" : modalMode === "edit" ? "儲存" : "新增"}
            </button>
          </>
        }
      >
        {formContent}
      </Modal>

      {/* 事件詳情 Modal */}
      <Modal
        open={modalMode === "detail" && selectedEvent !== null}
        onClose={closeModal}
        title="事件詳情"
        size="md"
        footer={
          selectedEvent?.source === "stored" ? (
            <>
              <button
                type="button"
                onClick={() => selectedEvent && handleDelete(selectedEvent.id)}
                className="btn-secondary gap-1.5 text-[var(--red)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                刪除
              </button>
              <button
                type="button"
                onClick={() => selectedEvent && openEditForm(selectedEvent)}
                className="btn-primary gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                編輯
              </button>
            </>
          ) : (
            <button type="button" onClick={closeModal} className="btn-secondary">
              關閉
            </button>
          )
        }
      >
        {selectedEvent && (
          <div className="space-y-4">
            <CalendarEventDetail event={selectedEvent} />

            <div className="cal-event-actions">
              {selectedEvent.projectId && (
                <Link
                  href={`/projects/${selectedEvent.projectId}`}
                  className="btn-secondary gap-1.5 text-xs"
                >
                  前往專案
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
              {selectedEvent.source === "leave" ||
              (selectedEvent.source === "stored" &&
                isGoogleSyncableEventType(selectedEvent.type)) ? (
                selectedEvent.googleEventId ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    已寫入公司 Google 日曆
                  </span>
                ) : googleStatus?.isAdmin ? (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={syncing}
                    className="btn-primary gap-1.5 text-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "同步中…" : "同步至公司日曆"}
                  </button>
                ) : (
                  <span className="text-xs text-[var(--muted)]">
                    由管理員同步至公司 Google 日曆
                  </span>
                )
              ) : selectedEvent.source === "stored" && selectedEvent.type === "other" ? (
                <span className="text-xs text-[var(--muted)]">私人記事，不會同步到公司 Google 日曆</span>
              ) : (
                <a
                  href={buildGoogleUrl(selectedEvent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary gap-1.5 text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  加入個人 Google 日曆
                </a>
              )}
            </div>

            {selectedEvent.source !== "stored" && (
              <p className="cal-event-source">
                {selectedEvent.source === "leave"
                  ? "來源：請假系統（已核准）"
                  : selectedEvent.source === "sprint"
                    ? "來源：本週 Sprint"
                    : "來源：專案管理"}
              </p>
            )}
            {selectedEvent.source === "stored" && (
              <p className="cal-event-source">
                {selectedEvent.type === "other"
                  ? "來源：手動新增 · 僅系統內顯示"
                  : "來源：手動新增 · 可同步公司 Google 日曆"}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* 當日事件 Modal */}
      <Modal
        open={modalMode === "day"}
        onClose={closeModal}
        title={
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--primary)]" />
            {formatDayTitle(selectedDate)}
          </span>
        }
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn-secondary">
              關閉
            </button>
            <button
              type="button"
              onClick={() => {
                closeModal();
                openCreateForm(selectedDate);
              }}
              className="btn-primary gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              新增事件
            </button>
          </>
        }
      >
        <div className="space-y-2.5">
          {dayEvents.length ? (
            dayEvents.map((event) => (
              <CalendarEventCard
                key={event.id}
                event={event}
                viewDate={selectedDate}
                onClick={() => openEventDetail(event)}
              />
            ))
          ) : (
            <p className="py-8 text-center text-sm text-[var(--muted)]">當日無事件</p>
          )}
        </div>
      </Modal>

      {/* 訂閱說明 Modal */}
      <Modal
        open={modalMode === "subscribe"}
        onClose={closeModal}
        title="如何訂閱公司行事曆"
        size="lg"
        footer={
          <>
            <a href="/api/calendar/export.ics" download className="btn-secondary gap-1.5">
              <Download className="h-3.5 w-3.5" />
              匯出 iCal
            </a>
            <button type="button" onClick={copySubscribeLink} className="btn-secondary gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              複製訂閱連結
            </button>
            <button type="button" onClick={closeModal} className="btn-primary">
              了解
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm leading-relaxed">
          <p className="text-[var(--muted)]">
            訂閱後，已核准請假、例行會議／訓練／出差與專案里程碑會出現在日曆；「其他」私人記事不會匯出。
          </p>

          <div className="cal-detail-card space-y-2">
            <p className="font-semibold text-[var(--ink)]">方法一：透過 URL 訂閱（推薦）</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-[var(--muted)]">
              <li>點擊「複製訂閱連結」取得 iCal 網址</li>
              <li>開啟 Google 日曆 → 左側「其他日曆」旁的 + 號</li>
              <li>選擇「透過 URL 訂閱」</li>
              <li>貼上訂閱連結，點擊「新增日曆」</li>
            </ol>
          </div>

          <div className="cal-detail-card space-y-2">
            <p className="font-semibold text-[var(--ink)]">方法二：下載 .ics 檔案</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-[var(--muted)]">
              <li>點擊「匯出 iCal」下載檔案</li>
              <li>在 Google 日曆 → 設定 → 匯入並匯出 → 匯入</li>
              <li>選擇下載的 .ics 檔案（一次性匯入，不會自動更新）</li>
            </ol>
          </div>

          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            訂閱連結：<code className="rounded bg-white/60 px-1">{typeof window !== "undefined" ? `${window.location.origin}/api/calendar/export.ics` : "/api/calendar/export.ics"}</code>
          </p>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div className="cal-toast" role="status">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
