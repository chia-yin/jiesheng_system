"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, ListTodo, Rocket } from "lucide-react";
import {
  labelOf,
  PRIORITY_DOT,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/lib/project-ui";
import type { Task, TaskStatus } from "@/types/system";

type OverviewTask = Task & {
  projectName: string;
  inActiveSprint: boolean;
};

interface TasksPayload {
  tasks: OverviewTask[];
  projects: Array<{ id: string; name: string; status: string }>;
  assignees: Array<{ id: string; name: string }>;
  activeSprint: { id: string; name: string; startDate: string; endDate: string } | null;
  session: { employeeId: string; role: string };
}

export default function TasksOverviewPage() {
  const [data, setData] = useState<TasksPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [sprintOnly, setSprintOnly] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "載入失敗");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter((t) => {
      if (projectId && t.projectId !== projectId) return false;
      if (assigneeId === "__none__" && t.assigneeId) return false;
      if (assigneeId && assigneeId !== "__none__" && t.assigneeId !== assigneeId) return false;
      if (status && t.status !== status) return false;
      if (priority && t.priority !== priority) return false;
      if (sprintOnly && !t.inActiveSprint) return false;
      return true;
    });
  }, [data, projectId, assigneeId, status, priority, sprintOnly]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function updateStatus(task: OverviewTask, next: TaskStatus) {
    if (updatingId || next === task.status) return;
    const canEdit =
      data?.session.role === "admin" || data?.session.employeeId === task.assigneeId;
    if (!canEdit) {
      showToast("僅管理員或負責人可更新狀態");
      return;
    }
    setUpdatingId(task.id);
    try {
      const res = await fetch(`/api/projects/${task.projectId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "更新失敗");
      showToast("狀態已更新");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading && !data) {
    return <p className="py-20 text-center text-sm text-[var(--muted)]">載入中…</p>;
  }

  if (error && !data) {
    return <p className="py-20 text-center text-sm text-[var(--danger)]">{error}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <ListTodo className="h-5 w-5 text-[var(--primary)]" />
            任務總覽
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            全公司未完成任務一覽，不必點進各個專案
            {data?.activeSprint ? (
              <span className="ml-1 inline-flex items-center gap-1 text-[var(--primary)]">
                <Rocket className="h-3 w-3" />
                本週 Sprint 優先排序
              </span>
            ) : null}
          </p>
        </div>
        <p className="text-sm text-[var(--muted)]">
          顯示 <span className="font-semibold text-[var(--ink)]">{filtered.length}</span> /{" "}
          {data?.tasks.length ?? 0} 筆
        </p>
      </header>

      <section className="card space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
          <Filter className="h-3.5 w-3.5" />
          篩選
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <select className="input-field text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">全部專案</option>
            {data?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="input-field text-sm" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">全部負責人</option>
            <option value="__none__">未指派</option>
            {data?.assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select className="input-field text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部狀態</option>
            {TASK_STATUS_OPTIONS.filter((s) => s.value !== "done").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select className="input-field text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">全部優先級</option>
            {TASK_PRIORITY_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={sprintOnly} onChange={(e) => setSprintOnly(e.target.checked)} />
            僅本週 Sprint
          </label>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-slate-50/80 text-xs text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2.5 font-semibold">任務</th>
                <th className="px-3 py-2.5 font-semibold">專案</th>
                <th className="px-3 py-2.5 font-semibold">負責人</th>
                <th className="px-3 py-2.5 font-semibold">優先</th>
                <th className="px-3 py-2.5 font-semibold">到期</th>
                <th className="px-3 py-2.5 font-semibold">狀態</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-[var(--faint)]">
                    沒有符合條件的任務
                  </td>
                </tr>
              ) : (
                filtered.map((task) => {
                  const canEdit =
                    data?.session.role === "admin" || data?.session.employeeId === task.assigneeId;
                  return (
                    <tr key={task.id} className="border-b border-[var(--line)] last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/projects/${task.projectId}`}
                            className="font-medium text-[var(--ink)] hover:text-[var(--primary)]"
                          >
                            {task.title}
                          </Link>
                          {task.inActiveSprint && (
                            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                              Sprint
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">
                        <Link href={`/projects/${task.projectId}`} className="hover:text-[var(--primary)]">
                          {task.projectName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{task.assigneeName ?? "未指派"}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ink)]">
                          <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                          {labelOf(TASK_PRIORITY_OPTIONS, task.priority)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{task.dueDate ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        {canEdit ? (
                          <select
                            className="input-field py-1 text-xs"
                            value={task.status}
                            disabled={updatingId === task.id}
                            onChange={(e) => updateStatus(task, e.target.value as TaskStatus)}
                          >
                            {TASK_STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">
                            {labelOf(TASK_STATUS_OPTIONS, task.status)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
