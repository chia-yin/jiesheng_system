"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  RotateCcw,
} from "lucide-react";

interface AttendanceSummary {
  date: string;
  settings: {
    startTime: string;
    endTime: string;
    breakMinutes: number;
    flexBeforeMinutes?: number;
    flexAfterMinutes?: number;
    flexWindows?: {
      clockIn: { from: string; to: string };
      clockOut: { from: string; to: string };
    };
  };
  today: {
    clockIn?: string;
    clockOut?: string;
    workMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    status: "not_started" | "working" | "finished";
    needsBreakReminder: boolean;
    canUndoClockOut?: boolean;
  };
  laborLaw: {
    dailyStandardHours: number;
    breakAfterHours: number;
    breakMinutes: number;
  };
}

function formatClock(date = new Date()) {
  return date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min.toString().padStart(2, "0")}m`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function StatusChip({ variant, children }: { variant: "success" | "warning" | "info"; children: React.ReactNode }) {
  const cls =
    variant === "success"
      ? "chip-approved"
      : variant === "warning"
        ? "chip-pending"
        : "chip-info";
  return <span className={cls}>{children}</span>;
}

export default function AttendancePage() {
  const [now, setNow] = useState(new Date());
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/attendance/summary");
    if (res.ok) {
      const data = await res.json();
      setSummary(data);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    const timer = setInterval(() => setNow(new Date()), 1000);
    const refresh = setInterval(loadSummary, 30000);
    return () => {
      clearInterval(timer);
      clearInterval(refresh);
    };
  }, [loadSummary]);

  async function handleClock(type: "in" | "out") {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "打卡失敗");

      const label = type === "in" ? "上班" : "下班";
      let msg = `${label}打卡成功 · ${formatTime(data.record.timestamp)}`;
      if (data.lateMinutes > 0) msg += ` · 遲到 ${data.lateMinutes} 分鐘`;
      if (data.earlyLeaveMinutes > 0) msg += ` · 早退 ${data.earlyLeaveMinutes} 分鐘`;
      if (type === "out" && data.workMinutes > 0) msg += ` · 今日工時 ${formatMinutes(data.workMinutes)}`;

      setMessage(msg);
      setMessageType("success");
      await loadSummary();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "打卡失敗");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleUndo() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/clock", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "撤銷失敗");

      setMessage("已撤銷下班打卡，可重新下班打卡");
      setMessageType("success");
      await loadSummary();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "撤銷失敗");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  const status = summary?.today.status ?? "not_started";

  const liveWorkMinutes =
    summary?.today.status === "working" && summary.today.clockIn
      ? Math.floor((Date.now() - new Date(summary.today.clockIn).getTime()) / 60000)
      : summary?.today.workMinutes ?? 0;

  const statusSteps = [
    { key: "not_started", label: "未打卡", icon: Circle },
    { key: "working", label: "已上班", icon: LogIn },
    { key: "finished", label: "已下班", icon: CheckCircle2 },
  ];

  const currentStep = status === "finished" ? 2 : status === "working" ? 1 : 0;
  const flexIn = summary?.settings.flexWindows?.clockIn;
  const flexOut = summary?.settings.flexWindows?.clockOut;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* 主打卡卡片 */}
      <section className="card overflow-hidden">
        {/* 頂部：時鐘區 */}
        <div className="border-b border-[var(--line)] bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/50 px-6 py-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[2.5px] text-[var(--primary)]">
            今日出勤
          </p>
          <p
            className="mt-2 font-mono text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl"
            style={{ animation: "clock-tick 2s ease-in-out infinite" }}
          >
            {formatClock(now)}
          </p>
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            {summary?.date}
          </p>
          {summary && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              標準工時 {summary.settings.startTime} – {summary.settings.endTime}
              {flexIn && flexOut && (
                <span className="text-[var(--faint)]">
                  {" "}
                  （彈性 {flexIn.from}–{flexIn.to} / {flexOut.from}–{flexOut.to}）
                </span>
              )}
            </p>
          )}
        </div>

        <div className="px-6 py-5">
          {/* 狀態進度條 */}
          <div className="relative mb-6">
            <div className="absolute left-[16.67%] right-[16.67%] top-5 h-0.5 bg-[var(--line)]" />
            <div
              className="absolute left-[16.67%] top-5 h-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--success)] transition-all duration-700"
              style={{ width: `${(currentStep / 2) * 66.67}%` }}
            />
            <div className="relative flex justify-between">
              {statusSteps.map((step, i) => {
                const Icon = step.icon;
                const active = i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <div key={step.key} className="flex w-1/3 flex-col items-center">
                    <div
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                        active
                          ? "border-[var(--primary)] bg-white text-[var(--primary)] shadow-sm"
                          : "border-[var(--line)] bg-[var(--bg)] text-[var(--faint)]"
                      } ${isCurrent && status === "working" ? "clock-pulse" : ""}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p
                      className={`mt-1.5 text-[11px] font-medium ${
                        active ? "text-[var(--ink)]" : "text-[var(--faint)]"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 打卡按鈕區 */}
          <div className="flex flex-col items-center gap-3">
            {status !== "finished" ? (
              <button
                type="button"
                onClick={() => handleClock(status === "not_started" ? "in" : "out")}
                disabled={loading}
                className={`group relative flex h-24 w-24 flex-col items-center justify-center rounded-2xl text-white shadow-lg transition-all duration-200 hover:shadow-xl active:scale-[0.97] disabled:opacity-50 ${
                  status === "not_started"
                    ? "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-d)] shadow-blue-500/25"
                    : "bg-gradient-to-br from-[var(--success)] to-[var(--success-l)] shadow-emerald-500/25"
                }`}
              >
                {status === "not_started" ? (
                  <>
                    <LogIn className="h-6 w-6 transition-transform group-hover:scale-110" />
                    <span className="mt-1.5 text-xs font-bold tracking-wide">上班打卡</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-6 w-6 transition-transform group-hover:scale-110" />
                    <span className="mt-1.5 text-xs font-bold tracking-wide">下班打卡</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-2 border-[var(--success)]/30 bg-[var(--success)]/5 text-[var(--success)]">
                  <CheckCircle2 className="h-7 w-7" />
                  <span className="mt-1.5 text-xs font-bold">今日已完成</span>
                </div>
                {summary?.today.canUndoClockOut && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={loading}
                    className="btn-secondary !px-3 !py-1.5 !text-xs"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    撤銷下班打卡
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 訊息提示 */}
          {message && (
            <div
              className={`mt-4 rounded-lg px-3 py-2.5 text-center text-xs font-medium ${
                messageType === "success"
                  ? "bg-emerald-50 text-[var(--success)]"
                  : "bg-red-50 text-[var(--danger)]"
              }`}
            >
              {message}
            </div>
          )}

          {/* 今日時間軸 */}
          <div className="mt-5 border-t border-[var(--line)] pt-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
              <Clock className="h-3.5 w-3.5 text-[var(--primary)]" />
              今日時間軸
            </h2>
            <div className="grid gap-2">
              <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--bg)]/60 px-3.5 py-2.5">
                <span className="text-xs text-[var(--muted)]">上班時間</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {summary?.today.clockIn ? formatTime(summary.today.clockIn) : "—"}
                  </span>
                  {summary?.today.clockIn &&
                    (summary.today.lateMinutes > 0 ? (
                      <StatusChip variant="warning">遲到 {summary.today.lateMinutes} 分</StatusChip>
                    ) : (
                      <StatusChip variant="success">準時</StatusChip>
                    ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--bg)]/60 px-3.5 py-2.5">
                <span className="text-xs text-[var(--muted)]">下班時間</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {summary?.today.clockOut ? formatTime(summary.today.clockOut) : "—"}
                  </span>
                  {summary?.today.clockOut &&
                    (summary.today.earlyLeaveMinutes > 0 ? (
                      <StatusChip variant="warning">
                        早退 {summary.today.earlyLeaveMinutes} 分
                      </StatusChip>
                    ) : summary.today.clockOut ? (
                      <StatusChip variant="success">準時</StatusChip>
                    ) : null)}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--bg)]/60 px-3.5 py-2.5">
                <span className="text-xs text-[var(--muted)]">今日工時</span>
                <span className="font-mono text-sm font-bold text-[var(--primary)]">
                  {formatMinutes(liveWorkMinutes)}
                  {status === "working" && (
                    <span className="ml-1 text-[10px] font-normal text-[var(--muted)]">（即時）</span>
                  )}
                </span>
              </div>
            </div>

            {summary?.today.needsBreakReminder && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 text-xs text-[var(--brown)]">
                <Coffee className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  依勞基法規定，連續工作 {summary.laborLaw.breakAfterHours} 小時應有{" "}
                  {summary.laborLaw.breakMinutes} 分鐘休息，請適時休息。
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
