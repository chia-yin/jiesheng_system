"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarOff,
  Check,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListTodo,
  LogIn,
  Megaphone,
  Pin,
  Plus,
  Rocket,
  X,
} from "lucide-react";
import {
  labelOf,
  PRIORITY_DOT,
  PROJECT_STATUS_CHIP,
  PROJECT_STATUS_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/lib/project-ui";
import { formatSprintWeekLabel } from "@/lib/sprint-utils";
import type { DashboardData, DashboardTask } from "@/lib/dashboard";
import type { LeaveRequest, TaskStatus } from "@/types/system";

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: "特休",
  sick: "病假",
  personal: "事假",
  other: "其他",
};

const STATUS_CHIP: Record<string, string> = {
  pending: "chip-pending",
  approved: "chip-approved",
  rejected: "chip-rejected",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "待審核",
  approved: "已核准",
  rejected: "已駁回",
};

const QUICK_STATUS_OPTIONS = TASK_STATUS_OPTIONS.filter((o) => o.value !== "done");

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <span>任務進度</span>
        <span>
          {done}/{total}（{pct}%）
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function KpiCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  accent: string;
}) {
  return (
    <Link href={href} className="kpi-card group transition hover:border-[var(--primary)] hover:shadow-md">
      <div className="flex items-center gap-2" style={{ color: accent }}>
        <Icon className="h-4 w-4" />
        <p className="text-xs text-[var(--muted)]">{label}</p>
      </div>
      <p className="mt-2 font-mono text-3xl font-bold" style={{ color: accent }}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-[var(--faint)] opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isAdmin = data?.user.role === "admin";

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("載入失敗");
      const json = await res.json();
      setData(json);
    } catch {
      showToast("儀表板載入失敗");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLeaveAction(id: string, status: "approved" | "rejected") {
    setActionLoading(id);
    try {
      const res = await fetch("/api/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "操作失敗");
      showToast(status === "approved" ? "已核准請假" : "已駁回請假");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "操作失敗");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTaskStatus(task: DashboardTask, status: TaskStatus) {
    setActionLoading(task.id);
    try {
      const res = await fetch(`/api/projects/${task.projectId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "更新失敗");
      showToast("任務狀態已更新");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setActionLoading(null);
    }
  }

  const firstProjectId = data?.activeProjects[0]?.id;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--muted)]">
        載入儀表板中…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-[var(--radius)] bg-[var(--sidebar)] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      <section className="rounded-[var(--radius)] border border-[var(--line)] bg-gradient-to-br from-blue-50 to-white p-5">
        <p className="text-[11px] font-semibold tracking-[2px] text-[var(--primary)]">全公司儀表板</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {data?.user.name ? (
            <>
              您好，<b className="text-[var(--ink)]">{data.user.name}</b>！
            </>
          ) : (
            "歡迎回來！"
          )}
          今日 <b className="text-[var(--ink)]">{data?.date ?? "—"}</b>
          {isAdmin ? (
            <>
              ，已有{" "}
              <span className="font-bold text-[var(--success)]">
                {data?.kpis.clock.value.split(" / ")[0] ?? 0}
              </span>{" "}
              人完成上班打卡
            </>
          ) : null}
          。
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {isAdmin ? (
          <>
            <Link href="/announcements" className="btn-secondary gap-1.5 px-3 py-2 text-xs">
              <Megaphone className="h-3.5 w-3.5" />
              新增公告
            </Link>
            <Link href="/leave?tab=pending" className="btn-secondary gap-1.5 px-3 py-2 text-xs">
              <CalendarOff className="h-3.5 w-3.5" />
              審核請假
            </Link>
            <Link href="/projects" className="btn-secondary gap-1.5 px-3 py-2 text-xs">
              <Plus className="h-3.5 w-3.5" />
              新增專案
            </Link>
          </>
        ) : (
          <>
            <Link href="/attendance" className="btn-primary gap-1.5 px-3 py-2 text-xs">
              <LogIn className="h-3.5 w-3.5" />
              打卡
            </Link>
            <Link href="/leave" className="btn-secondary gap-1.5 px-3 py-2 text-xs">
              <CalendarOff className="h-3.5 w-3.5" />
              申請請假
            </Link>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          href="/projects"
          icon={FolderKanban}
          label="進行中專案"
          value={data?.kpis.activeProjects ?? 0}
          accent="var(--primary)"
        />
        <KpiCard
          href={firstProjectId ? `/projects/${firstProjectId}` : "/projects"}
          icon={ListTodo}
          label="我的任務"
          value={data?.kpis.myTasks ?? 0}
          hint={data?.kpis.myTasks ? "未完成任務" : "目前沒有任務"}
          accent="var(--brown-l)"
        />
        {isAdmin ? (
          <KpiCard
            href="/leave?tab=pending"
            icon={CalendarOff}
            label="待審核請假"
            value={data?.kpis.pendingLeaves ?? 0}
            hint={data?.kpis.pendingLeaves ? "需要處理" : "全部處理完畢"}
            accent="var(--warning)"
          />
        ) : null}
        <KpiCard
          href={isAdmin ? "/records" : "/attendance"}
          icon={Clock}
          label={data?.kpis.clock.title ?? "今日打卡"}
          value={data?.kpis.clock.value ?? "—"}
          hint={data?.kpis.clock.hint}
          accent="var(--success)"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-[var(--primary)]" />
                <h2 className="text-base font-semibold">本週 Sprint</h2>
              </div>
              <Link href="/sprints" className="text-xs text-[var(--primary)] hover:underline">
                開啟看板 →
              </Link>
            </div>
            {data?.currentSprint ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50/70 to-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold text-blue-950">
                        {formatSprintWeekLabel(data.currentSprint.startDate, data.currentSprint.endDate)}
                      </p>
                      {data.currentSprint.goal ? (
                        <p className="mt-1 text-sm text-blue-800/80">{data.currentSprint.goal}</p>
                      ) : null}
                    </div>
                    <span className="chip-info">進行中</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-white/80 px-2 py-2">
                      <p className="text-[10px] text-[var(--muted)]">全部</p>
                      <p className="text-lg font-semibold tabular-nums">{data.currentSprint.total}</p>
                    </div>
                    <div className="rounded-md bg-white/80 px-2 py-2">
                      <p className="text-[10px] text-[var(--muted)]">未完成</p>
                      <p className="text-lg font-semibold tabular-nums text-amber-700">
                        {data.currentSprint.open}
                      </p>
                    </div>
                    <div className="rounded-md bg-white/80 px-2 py-2">
                      <p className="text-[10px] text-[var(--muted)]">我的</p>
                      <p className="text-lg font-semibold tabular-nums text-[var(--primary)]">
                        {data.currentSprint.myOpen}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <ProgressBar done={data.currentSprint.done} total={data.currentSprint.total} />
                  </div>
                </div>

                {data.currentSprint.myTasks.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-[var(--muted)]">你的本週任務</p>
                    <ul className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
                      {data.currentSprint.myTasks.map((task) => (
                        <li key={task.id}>
                          <Link
                            href={`/projects/${task.projectId}`}
                            className="flex items-center gap-2 px-3 py-2.5 text-sm transition hover:bg-blue-50/40"
                          >
                            <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                            <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                            <span className="shrink-0 text-xs text-[var(--faint)]">{task.projectName}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : data.currentSprint.total > 0 ? (
                  <p className="text-sm text-[var(--muted)]">本週沒有指派給你的未完成任務。</p>
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    本週尚未勾選任何任務
                    {isAdmin ? (
                      <>
                        ，前往{" "}
                        <Link href="/sprints" className="text-[var(--primary)] hover:underline">
                          本週 Sprint
                        </Link>{" "}
                        從專案勾選
                      </>
                    ) : null}
                    。
                  </p>
                )}

                {data.currentSprint.byProject.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-[var(--muted)]">各專案本週進度</p>
                    <div className="flex flex-wrap gap-2">
                      {data.currentSprint.byProject.map((p) => (
                        <Link
                          key={p.projectId}
                          href={`/projects/${p.projectId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs transition hover:border-[var(--primary)] hover:bg-blue-50/40"
                        >
                          <span className="font-medium">{p.projectName}</span>
                          <span className="tabular-nums text-[var(--muted)]">
                            {p.done}/{p.total}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-[var(--muted)]">
                目前沒有進行中的 Sprint
                {isAdmin ? (
                  <>
                    ，前往{" "}
                    <Link href="/sprints" className="text-[var(--primary)] hover:underline">
                      本週 Sprint
                    </Link>{" "}
                    建立
                  </>
                ) : null}
              </p>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-[var(--primary)]" />
                <h2 className="text-base font-semibold">進行中專案</h2>
              </div>
              <Link href="/projects" className="text-xs text-[var(--primary)] hover:underline">
                查看全部專案 →
              </Link>
            </div>

            {data?.activeProjects.length ? (
              <div className="space-y-3">
                {data.activeProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block rounded-lg border border-[var(--line)] p-4 transition hover:border-[var(--primary)] hover:bg-blue-50/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          負責人：{project.managerName ?? "未指定"}
                        </p>
                      </div>
                      <span className={PROJECT_STATUS_CHIP[project.status]}>
                        {labelOf(PROJECT_STATUS_OPTIONS, project.status)}
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar
                        done={project.summary?.taskDone ?? 0}
                        total={project.summary?.taskTotal ?? 0}
                      />
                    </div>
                    {(project.summary?.sprintTaskTotal ?? 0) > 0 ? (
                      <p className="mt-2 flex items-center gap-1 text-xs text-blue-700">
                        <Rocket className="h-3 w-3 shrink-0" />
                        本週 {project.summary!.sprintTaskDone}/{project.summary!.sprintTaskTotal} 項任務
                      </p>
                    ) : project.summary?.activeSprint ? (
                      <p className="mt-2 flex items-center gap-1 text-xs text-[var(--muted)]">
                        <Rocket className="h-3 w-3 shrink-0" />
                        本週尚未納入任務
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-[var(--muted)]">目前沒有進行中的專案</p>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-[var(--brown-l)]" />
                <h2 className="text-base font-semibold">我的任務</h2>
              </div>
              <Link
                href={firstProjectId ? `/projects/${firstProjectId}` : "/projects"}
                className="text-xs text-[var(--primary)] hover:underline"
              >
                前往看板
              </Link>
            </div>

            {data?.myTasks.length ? (
              <div className="divide-y divide-[var(--line)]">
                {data.myTasks.map((task) => (
                  <div key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
                      title={task.priority}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="font-medium hover:text-[var(--primary)]"
                      >
                        {task.title}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">{task.projectName}</p>
                    </div>
                    <select
                      className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs"
                      value={task.status}
                      disabled={actionLoading === task.id}
                      onChange={(e) => handleTaskStatus(task, e.target.value as TaskStatus)}
                    >
                      {QUICK_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-[var(--muted)]">目前沒有指派給您的任務</p>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-[var(--primary)]" />
                <h2 className="text-base font-semibold">最新公告</h2>
              </div>
              <Link href="/announcements" className="text-xs text-[var(--primary)] hover:underline">
                查看全部
              </Link>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {data?.announcements.length ? (
                data.announcements.map((ann) => (
                  <Link
                    key={ann.id}
                    href="/announcements"
                    className="block py-3 transition hover:text-[var(--primary)]"
                  >
                    <p className="font-medium">
                      {ann.pinned ? (
                        <Pin className="mr-1 inline h-3.5 w-3.5 text-[var(--brown-l)]" />
                      ) : null}
                      {ann.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{ann.content}</p>
                  </Link>
                ))
              ) : (
                <p className="py-4 text-sm text-[var(--muted)]">尚無公告</p>
              )}
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-[var(--warning)]" />
                <h2 className="text-base font-semibold">近期請假</h2>
              </div>
              <Link href="/leave" className="text-xs text-[var(--primary)] hover:underline">
                查看全部
              </Link>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {data?.recentLeaves.length ? (
                data.recentLeaves.map((leave) => (
                  <LeaveRow key={leave.id} leave={leave} />
                ))
              ) : (
                <p className="py-4 text-sm text-[var(--muted)]">尚無請假紀錄</p>
              )}
            </div>
          </section>

          {isAdmin && (data?.pendingLeaves.length ?? 0) > 0 ? (
            <section className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--warning)]" />
                  <h2 className="text-base font-semibold">待審核請假</h2>
                </div>
                <Link href="/leave?tab=pending" className="text-xs text-[var(--primary)] hover:underline">
                  查看全部
                </Link>
              </div>
              <div className="space-y-3">
                {data?.pendingLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="rounded-lg border border-[var(--line)] p-3 text-sm"
                  >
                    <LeaveRow leave={leave} />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="btn-primary flex-1 gap-1 px-2 py-1.5 text-xs"
                        disabled={actionLoading === leave.id}
                        onClick={() => handleLeaveAction(leave.id, "approved")}
                      >
                        <Check className="h-3 w-3" />
                        核准
                      </button>
                      <button
                        type="button"
                        className="btn-secondary flex-1 gap-1 px-2 py-1.5 text-xs text-[var(--danger)]"
                        disabled={actionLoading === leave.id}
                        onClick={() => handleLeaveAction(leave.id, "rejected")}
                      >
                        <X className="h-3 w-3" />
                        駁回
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LeaveRow({ leave }: { leave: LeaveRequest }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <div>
        <p className="font-medium">{leave.employeeName}</p>
        <p className="text-[var(--muted)]">
          {LEAVE_TYPE_LABEL[leave.type]} · {leave.startDate}
        </p>
      </div>
      <span className={STATUS_CHIP[leave.status]}>{STATUS_LABEL[leave.status]}</span>
    </div>
  );
}
