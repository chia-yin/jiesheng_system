"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardEdit,
  ExternalLink,
  LogOut,
  Plane,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { WEEKDAYS, getMonthGrid, toDateStr } from "@/lib/calendar-grid";
import { formatMonthLabel } from "@/lib/list-utils";
import type {
  AttendanceDayStatus,
  AttendanceRecord,
  DayMarker,
  EmployeeDaySummary,
} from "@/types/attendance";
import type { AggregatedCalendarEvent, LeaveRequest } from "@/types/system";

interface EmployeeOption {
  id: string;
  name: string;
  department: string;
}

interface MonthData {
  markers: Record<string, DayMarker>;
  records?: AttendanceRecord[];
  isAdmin: boolean;
  employees?: EmployeeOption[];
}

interface DayTimes {
  clockIn?: string;
  clockOut?: string;
}

interface MyDayDetail {
  date: string;
  scope: "my";
  summary: {
    clockIn?: string;
    clockOut?: string;
    workMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    status: AttendanceDayStatus;
  };
  records: AttendanceRecord[];
  leaves: LeaveRequest[];
  calendarEvents: AggregatedCalendarEvent[];
}

interface AllDayDetail {
  date: string;
  scope: "all";
  employees: EmployeeDaySummary[];
  leaves: LeaveRequest[];
  calendarEvents: AggregatedCalendarEvent[];
  employeeOptions: { id: string; name: string; department: string }[];
}

const STATUS_CONFIG: Record<
  AttendanceDayStatus,
  { label: string; chip: string }
> = {
  normal: { label: "正常", chip: "chip-approved" },
  late: { label: "遲到", chip: "chip-pending" },
  early_leave: { label: "早退", chip: "chip-pending" },
  leave: { label: "請假", chip: "bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-full text-xs font-semibold" },
  absent: { label: "未打卡", chip: "bg-slate-50 text-slate-500 border border-slate-200/60 px-2 py-0.5 rounded-full text-xs font-semibold" },
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: "特休",
  sick: "病假",
  personal: "事假",
  other: "其他",
};

function formatTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function formatWorkMinutes(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min.toString().padStart(2, "0")}m`;
}

function StatusChip({ status }: { status: AttendanceDayStatus }) {
  const cfg = STATUS_CONFIG[status];
  return <span className={cfg.chip}>{cfg.label}</span>;
}

function AttendanceProgress({
  clocked,
  total,
}: {
  clocked: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((clocked / total) * 100) : 0;
  const variant =
    total > 0 && clocked >= total ? "full" : clocked > 0 ? "partial" : "empty";

  return (
    <div className="records-cal-progress">
      <div className="records-cal-progress-track">
        <div
          className={`records-cal-progress-fill is-${variant}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`records-cal-progress-label is-${variant}`}>
        {clocked}/{total} 已打卡
      </p>
    </div>
  );
}

function MarkerDots({ marker }: { marker: DayMarker }) {
  const dots: { key: string; className: string; title: string }[] = [];
  if (marker.hasLeave) dots.push({ key: "leave", className: "leave", title: "請假" });
  if (marker.hasLate) dots.push({ key: "late", className: "late", title: "遲到" });
  if (marker.hasEarlyLeave) dots.push({ key: "early", className: "early", title: "早退" });

  if (!dots.length) return null;

  return (
    <div className="records-cal-dots">
      {dots.map((d) => (
        <span key={d.key} className={`records-cal-dot ${d.className}`} title={d.title} />
      ))}
    </div>
  );
}

function DayMarkers({
  marker,
  isAdmin,
  dayTimes,
}: {
  marker?: DayMarker;
  isAdmin: boolean;
  dayTimes?: DayTimes;
}) {
  if (!marker) return null;

  if (isAdmin && marker.totalEmployees != null) {
    const clocked = marker.clockedInCount ?? 0;
    const total = marker.totalEmployees;
    return (
      <>
        <AttendanceProgress clocked={clocked} total={total} />
        <MarkerDots marker={marker} />
      </>
    );
  }

  const hasAny =
    marker.hasClock || marker.hasLeave || marker.hasLate || marker.hasEarlyLeave;
  if (!hasAny && !dayTimes?.clockIn && !dayTimes?.clockOut) return null;

  return (
    <div className="records-cal-personal">
      {(dayTimes?.clockIn || dayTimes?.clockOut) && (
        <p className="records-cal-time">
          {dayTimes.clockIn ? formatTime(dayTimes.clockIn) : "—"}
          {" – "}
          {dayTimes.clockOut ? formatTime(dayTimes.clockOut) : "—"}
        </p>
      )}
      <div className="records-cal-status-row">
        {marker.hasLeave && (
          <Plane className="h-3 w-3 text-emerald-600" aria-label="請假" />
        )}
        {marker.hasLate && (
          <AlertCircle className="h-3 w-3 text-orange-500" aria-label="遲到" />
        )}
        {marker.hasEarlyLeave && (
          <LogOut className="h-3 w-3 text-amber-500" aria-label="早退" />
        )}
        {marker.hasClock && !marker.hasLeave && !marker.hasLate && !marker.hasEarlyLeave && (
          <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-label="正常出勤" />
        )}
        {!marker.hasClock && !marker.hasLeave && (
          <Clock className="h-3 w-3 text-slate-300" aria-label="無紀錄" />
        )}
      </div>
      <MarkerDots marker={marker} />
    </div>
  );
}

function getAnomalyClass(marker?: DayMarker) {
  if (!marker) return "";
  if (marker.hasLeave) return "has-anomaly has-anomaly-leave";
  if (marker.hasLate) return "has-anomaly has-anomaly-late";
  if (marker.hasEarlyLeave) return "has-anomaly has-anomaly-early";
  return "";
}

export default function RecordsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [markers, setMarkers] = useState<Record<string, DayMarker>>({});
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate())
  );
  const [dayDetail, setDayDetail] = useState<MyDayDetail | AllDayDetail | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const dayTimesMap = useMemo(() => {
    const map: Record<string, DayTimes> = {};
    for (const r of monthRecords) {
      const date = r.timestamp.slice(0, 10);
      if (!map[date]) map[date] = {};
      if (r.type === "in") map[date].clockIn = r.timestamp;
      else map[date].clockOut = r.timestamp;
    }
    return map;
  }, [monthRecords]);

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true);
    try {
      const params = new URLSearchParams({ month: monthKey });
      if (filterEmployeeId) params.set("employeeId", filterEmployeeId);
      const res = await fetch(`/api/records?${params}`);
      if (res.ok) {
        const data: MonthData = await res.json();
        setMarkers(data.markers ?? {});
        setMonthRecords(data.records ?? []);
        setIsAdmin(data.isAdmin);
        if (data.employees) setEmployeeOptions(data.employees);
      }
    } finally {
      setLoadingMonth(false);
    }
  }, [monthKey, filterEmployeeId]);

  const loadDayDetail = useCallback(
    async (date: string, empFilter?: string) => {
      setLoadingDay(true);
      try {
        const params = new URLSearchParams({ date });
        if (empFilter) params.set("employeeId", empFilter);
        const res = await fetch(`/api/records?${params}`);
        if (res.ok) {
          const data = await res.json();
          setDayDetail(data);
        }
      } finally {
        setLoadingDay(false);
      }
    },
    []
  );

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

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
    const date = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
    setSelectedDate(date);
  }

  function openDay(date: string) {
    setSelectedDate(date);
    setShowDayModal(true);
    loadDayDetail(date, filterEmployeeId || undefined);
  }

  function handleFilterChange(empId: string) {
    setFilterEmployeeId(empId);
    if (showDayModal) {
      loadDayDetail(selectedDate, empId || undefined);
    }
  }

  const myDetail = dayDetail?.scope === "my" ? dayDetail : null;
  const allDetail = dayDetail?.scope === "all" ? dayDetail : null;

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-semibold">打卡紀錄</h2>
          <p className="text-sm text-[var(--muted)]">
            {isAdmin
              ? "全員出勤月曆 · 點選日期查看當日摘要"
              : "以日曆檢視個人出勤與請假"}
          </p>
        </div>
      </section>

      <section className="records-cal-toolbar">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={prevMonth} className="btn-secondary p-2" aria-label="上個月">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="min-w-[120px] text-center text-base font-semibold tracking-tight">
              {formatMonthLabel(monthKey)}
            </h3>
            <button type="button" onClick={nextMonth} className="btn-secondary p-2" aria-label="下個月">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={goToday} className="btn-secondary px-3 py-1.5 text-xs">
            今天
          </button>
          {loadingMonth && (
            <span className="text-xs text-[var(--muted)]">載入中…</span>
          )}
        </div>

        {isAdmin && employeeOptions.length > 0 && (
          <select
            value={filterEmployeeId}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="input-field w-auto py-1.5 text-sm"
          >
            <option value="">全部員工</option>
            {employeeOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}（{e.department}）
              </option>
            ))}
          </select>
        )}

        <div className="records-cal-legend">
          {isAdmin && !filterEmployeeId ? (
            <>
              <span className="cal-legend-chip bg-white text-[var(--muted)] border-[var(--line)] text-[11px]">
                <span className="inline-block h-1 w-6 rounded-full bg-gradient-to-r from-blue-500 to-blue-300" />
                部分打卡
              </span>
              <span className="cal-legend-chip bg-white text-[var(--muted)] border-[var(--line)] text-[11px]">
                <span className="inline-block h-1 w-6 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" />
                全員已打卡
              </span>
              <span className="cal-legend-chip bg-white text-[var(--muted)] border-[var(--line)] text-[11px]">
                <span className="records-cal-dot leave" /> 請假
              </span>
              <span className="cal-legend-chip bg-white text-[var(--muted)] border-[var(--line)] text-[11px]">
                <span className="records-cal-dot late" /> 遲到
              </span>
              <span className="cal-legend-chip bg-white text-[var(--muted)] border-[var(--line)] text-[11px]">
                <span className="records-cal-dot early" /> 早退
              </span>
            </>
          ) : (
            [
              { cls: "clock", label: "打卡" },
              { cls: "leave", label: "請假" },
              { cls: "late", label: "遲到" },
              { cls: "early", label: "早退" },
            ].map((item) => (
              <span
                key={item.label}
                className="cal-legend-chip bg-white text-[var(--muted)] border-[var(--line)] text-[11px]"
              >
                <span className={`records-cal-dot ${item.cls}`} />
                {item.label}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="records-cal-card">
        <div className="records-cal-weekdays">
          {WEEKDAYS.map((wd, i) => (
            <div
              key={wd}
              className={`records-cal-weekday ${i === 0 || i === 6 ? "is-weekend" : ""}`}
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="records-cal-grid">
          {grid.map((cell) => {
            const isToday = cell.date === todayStr;
            const isSelected = cell.date === selectedDate && !showDayModal;
            const marker = markers[cell.date];
            const showAdminView = isAdmin && !filterEmployeeId;

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => openDay(cell.date)}
                className={`records-cal-cell ${!cell.inMonth ? "is-outside" : ""} ${
                  cell.isWeekend ? "is-weekend" : ""
                } ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""} ${
                  cell.inMonth ? getAnomalyClass(marker) : ""
                }`}
              >
                <span className={`records-cal-num ${isToday ? "is-today" : ""}`}>{cell.day}</span>
                {cell.inMonth && (
                  <DayMarkers
                    marker={marker}
                    isAdmin={showAdminView}
                    dayTimes={!showAdminView ? dayTimesMap[cell.date] : undefined}
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <Modal
        open={showDayModal}
        onClose={() => setShowDayModal(false)}
        title={
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--primary)]" />
            {selectedDate}
            {isAdmin ? " · 全員摘要" : " · 個人紀錄"}
          </span>
        }
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Link
              href={`/calendar?date=${selectedDate}`}
              className="btn-secondary gap-1.5 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              查看行事曆
            </Link>
            <button type="button" onClick={() => setShowDayModal(false)} className="btn-primary">
              關閉
            </button>
          </div>
        }
      >
        {loadingDay ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">載入中…</p>
        ) : isAdmin && allDetail ? (
          <AllDayPanel detail={allDetail} onRefresh={() => { loadDayDetail(selectedDate, filterEmployeeId || undefined); loadMonth(); }} />
        ) : !isAdmin && myDetail ? (
          <MyDayPanel
            detail={myDetail}
            onRefresh={() => {
              loadDayDetail(selectedDate);
              loadMonth();
            }}
          />
        ) : (
          <p className="py-8 text-center text-sm text-[var(--muted)]">無法載入資料</p>
        )}
      </Modal>
    </div>
  );
}

function MakeupClockPanel({
  date,
  hasClockIn,
  hasClockOut,
  onSuccess,
  employeeId,
  employeeName,
}: {
  date: string;
  hasClockIn: boolean;
  hasClockOut: boolean;
  onSuccess: () => void;
  employeeId?: string;
  employeeName?: string;
}) {
  const [type, setType] = useState<"in" | "out">(hasClockIn ? "out" : "in");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 如果兩筆都有就不顯示
  if (hasClockIn && hasClockOut) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!time || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/clock/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, type, ...(employeeId ? { employeeId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "補卡失敗");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "補卡失敗");
    } finally {
      setSaving(false);
    }
  }

  const availableTypes = [
    ...(!hasClockIn ? [{ value: "in", label: "補上班打卡" }] : []),
    ...(!hasClockOut && hasClockIn ? [{ value: "out", label: "補下班打卡" }] : []),
  ] as { value: "in" | "out"; label: string }[];

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
        <ClipboardEdit className="h-4 w-4" />
        {employeeName ? `補卡 — ${employeeName}` : "補卡申請"}
      </h4>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        {availableTypes.length > 1 && (
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">類型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "in" | "out")}
              className="input-field py-1.5 text-sm"
            >
              {availableTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
        {availableTypes.length === 1 && (
          <p className="text-sm text-amber-800">{availableTypes[0].label}</p>
        )}
        <div>
          <label className="mb-1 block text-xs text-[var(--muted)]">時間</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="input-field py-1.5 text-sm font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !time}
          className="btn-primary py-1.5 text-sm disabled:opacity-50"
        >
          {saving ? "補卡中…" : "確認補卡"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
      <p className="mt-2 text-[11px] text-amber-700">補卡後立即生效，無需審核。</p>
    </div>
  );
}

function MyDayPanel({ detail, onRefresh }: { detail: MyDayDetail; onRefresh?: () => void }) {
  const { summary, records, leaves, calendarEvents } = detail;
  const hasClockIn = Boolean(summary.clockIn);
  const hasClockOut = Boolean(summary.clockOut);
  // 只有過去或今天才可補卡
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  const isPastOrToday = detail.date <= today;
  const canMakeup = isPastOrToday && (!hasClockIn || !hasClockOut);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="cal-detail-card">
          <p className="text-xs text-[var(--muted)]">上班</p>
          <p className="mt-1 font-mono text-sm font-semibold">{formatTime(summary.clockIn)}</p>
          {summary.lateMinutes > 0 && (
            <p className="mt-0.5 text-xs text-orange-600">遲到 {summary.lateMinutes} 分</p>
          )}
        </div>
        <div className="cal-detail-card">
          <p className="text-xs text-[var(--muted)]">下班</p>
          <p className="mt-1 font-mono text-sm font-semibold">{formatTime(summary.clockOut)}</p>
          {summary.earlyLeaveMinutes > 0 && (
            <p className="mt-0.5 text-xs text-orange-600">早退 {summary.earlyLeaveMinutes} 分</p>
          )}
        </div>
        <div className="cal-detail-card">
          <p className="text-xs text-[var(--muted)]">工時 / 狀態</p>
          <p className="mt-1 font-mono text-sm font-semibold">
            {summary.workMinutes > 0 ? formatWorkMinutes(summary.workMinutes) : "—"}
          </p>
          <div className="mt-1">
            <StatusChip status={summary.status} />
          </div>
        </div>
      </div>

      {records.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="h-3.5 w-3.5 text-[var(--primary)]" />
            打卡紀錄
          </h4>
          <div className="space-y-1.5">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--bg)]/60 px-3 py-2 text-sm"
              >
                <span>{r.type === "in" ? "上班" : "下班"}</span>
                <span className="font-mono text-[var(--muted)]">{formatTime(r.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {leaves.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-emerald-700">請假</h4>
          {leaves.map((l) => (
            <div key={l.id} className="cal-detail-card">
              <span className="text-xs font-semibold text-emerald-700">
                {LEAVE_TYPE_LABEL[l.type] ?? l.type}
              </span>
              <p className="mt-1 text-sm">{l.reason}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {l.startDate}
                {l.endDate !== l.startDate && ` ~ ${l.endDate}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {calendarEvents.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">相關行事曆</h4>
          <div className="space-y-1.5">
            {calendarEvents.map((e) => (
              <Link
                key={e.id}
                href="/calendar"
                className="cal-detail-card block transition hover:border-[var(--primary)]/30"
              >
                <p className="text-sm font-medium">{e.title}</p>
                {e.description && (
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{e.description}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {canMakeup && (
        <MakeupClockPanel
          date={detail.date}
          hasClockIn={hasClockIn}
          hasClockOut={hasClockOut}
          onSuccess={() => onRefresh?.()}
        />
      )}

      {records.length === 0 && leaves.length === 0 && calendarEvents.length === 0 && !canMakeup && (
        <p className="py-6 text-center text-sm text-[var(--muted)]">當日無出勤或請假紀錄</p>
      )}
    </div>
  );
}

function AdminMakeupRow({
  emp,
  date,
  onSuccess,
}: {
  emp: EmployeeDaySummary;
  date: string;
  onSuccess: () => void;
}) {
  const hasClockIn = Boolean(emp.clockIn);
  const hasClockOut = Boolean(emp.clockOut);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  const canMakeup = date <= today && (!hasClockIn || !hasClockOut);
  const [open, setOpen] = useState(false);

  if (!canMakeup) return null;

  return (
    <tr className="border-b border-amber-100 bg-amber-50/40 last:border-0">
      <td colSpan={7} className="px-3 py-2">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900"
          >
            <ClipboardEdit className="h-3.5 w-3.5" />
            替 {emp.employeeName} 補卡
          </button>
        ) : (
          <MakeupClockPanel
            date={date}
            hasClockIn={hasClockIn}
            hasClockOut={hasClockOut}
            employeeId={emp.employeeId}
            employeeName={emp.employeeName}
            onSuccess={() => { setOpen(false); onSuccess(); }}
          />
        )}
      </td>
    </tr>
  );
}

function AllDayPanel({ detail, onRefresh }: { detail: AllDayDetail; onRefresh?: () => void }) {
  const { employees, leaves } = detail;

  const sorted = [...employees].sort((a, b) => {
    const order: Record<AttendanceDayStatus, number> = {
      absent: 0,
      late: 1,
      early_leave: 2,
      normal: 3,
      leave: 4,
    };
    return order[a.status] - order[b.status] || a.employeeName.localeCompare(b.employeeName, "zh-TW");
  });

  const clockedCount = employees.filter((e) => e.status !== "absent" && e.status !== "leave").length;
  const absentCount = employees.filter((e) => e.status === "absent").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        <span>共 {employees.length} 人</span>
        <span>·</span>
        <span className="text-[var(--primary)]">{clockedCount} 人已出勤</span>
        {absentCount > 0 && (
          <>
            <span>·</span>
            <span className="text-slate-500">{absentCount} 人未打卡</span>
          </>
        )}
        {leaves.length > 0 && (
          <>
            <span>·</span>
            <span className="text-emerald-600">{leaves.length} 人請假</span>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
        <table className="records-cal-table min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line-2)] bg-slate-50/80 text-[var(--faint)]">
            <tr>
              <th className="px-3 py-2.5 text-xs font-semibold">員工</th>
              <th className="px-3 py-2.5 text-xs font-semibold">部門</th>
              <th className="px-3 py-2.5 text-xs font-semibold">上班</th>
              <th className="px-3 py-2.5 text-xs font-semibold">下班</th>
              <th className="px-3 py-2.5 text-xs font-semibold">工時</th>
              <th className="px-3 py-2.5 text-xs font-semibold">狀態</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length ? (
              sorted.map((emp) => (
                <>
                  <tr
                    key={emp.employeeId}
                    className={`border-b border-[var(--line)] ${
                      emp.status === "absent" ? "is-absent" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 font-medium">{emp.employeeName}</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{emp.department}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{formatTime(emp.clockIn)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{formatTime(emp.clockOut)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {emp.workMinutes > 0 ? formatWorkMinutes(emp.workMinutes) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip status={emp.status} />
                    </td>
                  </tr>
                  <AdminMakeupRow
                    key={`makeup-${emp.employeeId}`}
                    emp={emp}
                    date={detail.date}
                    onSuccess={() => onRefresh?.()}
                  />
                </>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)]">
                  無員工資料
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {leaves.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-emerald-700">當日請假</h4>
          <div className="space-y-1">
            {leaves.map((l) => (
              <div key={l.id} className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-1.5 text-xs">
                <span className="font-medium">{l.employeeName}</span>
                <span className="mx-1 text-[var(--faint)]">·</span>
                <span className="text-emerald-700">{LEAVE_TYPE_LABEL[l.type] ?? l.type}</span>
                {l.reason && <span className="ml-1.5 text-[var(--muted)]">{l.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
