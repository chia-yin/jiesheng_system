"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  FolderKanban,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { KANBAN_COLUMNS, TASK_STATUS_OPTIONS } from "@/lib/project-ui";
import { defaultSprintRange, formatSprintWeekLabel } from "@/lib/sprint-utils";
import type { SessionUser } from "@/types/auth";
import type { Project, Sprint, SprintStatus, Task, TaskStatus } from "@/types/system";

type SprintTask = Task & { projectName: string };
type Board = { sprint: Sprint; tasks: SprintTask[]; done: number; total: number };
type Assignable = SprintTask & { inSprint: boolean };

const STATUS_LABEL: Record<SprintStatus, string> = {
  planning: "規劃中",
  active: "進行中",
  completed: "已完成",
};

export default function SprintsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState(defaultSprintRange().startDate);
  const [endDate, setEndDate] = useState(defaultSprintRange().endDate);
  const [activate, setActivate] = useState(true);

  const [pickProjectId, setPickProjectId] = useState("");
  const [assignable, setAssignable] = useState<Assignable[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadSprints = useCallback(async () => {
    const res = await fetch("/api/sprints");
    const data = await res.json();
    if (res.ok) setSprints(data.sprints ?? []);
  }, []);

  const loadBoard = useCallback(async (id: string) => {
    const res = await fetch(`/api/sprints/${id}`);
    const data = await res.json();
    if (res.ok) setBoard(data);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/projects").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/sprints?mode=current").then((r) => (r.ok ? r.json() : null)),
    ]).then(async ([me, proj, current]) => {
      if (me?.user) setUser(me.user);
      if (proj?.projects) setProjects(proj.projects);
      await loadSprints();
      const currentId = current?.sprint?.id as string | undefined;
      if (currentId) {
        setSelectedId(currentId);
        if (current.board) setBoard(current.board);
      }
      setLoading(false);
    });
  }, [loadSprints]);

  useEffect(() => {
    if (!selectedId) {
      setBoard(null);
      return;
    }
    loadBoard(selectedId);
  }, [selectedId, loadBoard]);

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, SprintTask[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const t of board?.tasks ?? []) map[t.status].push(t);
    return map;
  }, [board]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim() || undefined,
          startDate,
          endDate,
          status: activate ? "active" : "planning",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "建立失敗");
      setCreateOpen(false);
      setGoal("");
      showToast("已建立本週 Sprint");
      await loadSprints();
      setSelectedId(data.sprint.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setCreating(false);
    }
  }

  async function setSprintStatus(status: SprintStatus) {
    if (!selectedId) return;
    const res = await fetch(`/api/sprints/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "更新失敗");
      return;
    }
    showToast(status === "active" ? "已設為進行中" : "狀態已更新");
    await loadSprints();
    await loadBoard(selectedId);
  }

  async function openAddModal() {
    if (!selectedId) return;
    setPickProjectId("");
    setSelectedTaskIds(new Set());
    const res = await fetch(`/api/sprints/${selectedId}/tasks`);
    const data = await res.json();
    if (res.ok) {
      setAssignable(data.tasks ?? []);
      setAddOpen(true);
    } else {
      showToast(data.error ?? "載入任務失敗");
    }
  }

  const filteredAssignable = useMemo(() => {
    return assignable.filter((t) => {
      if (pickProjectId && t.projectId !== pickProjectId) return false;
      if (t.sprintId === selectedId) return false;
      return true;
    });
  }, [assignable, pickProjectId, selectedId]);

  function toggleTask(id: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedTaskIds(new Set(filteredAssignable.map((t) => t.id)));
  }

  async function handleAddTasks() {
    if (!selectedId || !selectedTaskIds.size) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/sprints/${selectedId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: [...selectedTaskIds] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加入失敗");
      showToast(`已加入 ${data.attached} 項任務`);
      setAddOpen(false);
      await loadBoard(selectedId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "加入失敗");
    } finally {
      setAdding(false);
    }
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    if (!selectedId) return;
    const res = await fetch(`/api/sprints/${selectedId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status }),
    });
    if (!res.ok) {
      const data = await res.json();
      showToast(data.error ?? "無法更新狀態");
      return;
    }
    await loadBoard(selectedId);
  }

  async function removeTask(taskId: string) {
    if (!selectedId || !isAdmin) return;
    const res = await fetch(`/api/sprints/${selectedId}/tasks?taskId=${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      showToast(data.error ?? "移除失敗");
      return;
    }
    await loadBoard(selectedId);
  }

  function canDrag(task: SprintTask) {
    return isAdmin || task.assigneeId === user?.employeeId;
  }

  function onDropColumn(status: TaskStatus) {
    if (!dragTaskId) return;
    const task = board?.tasks.find((t) => t.id === dragTaskId);
    setDragTaskId(null);
    if (!task || task.status === status) return;
    if (!canDrag(task)) {
      showToast("只能拖動自己負責的任務");
      return;
    }
    updateStatus(task.id, status);
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-[var(--muted)]">載入中…</p>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <Rocket className="h-5 w-5 text-[var(--primary)]" />
            本週 Sprint
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">一週週期 · 從各專案勾選任務 · 負責人可拖曳狀態</p>
        </div>
        {isAdmin && (
          <button type="button" className="btn-primary gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            新建 Sprint
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {sprints.length === 0 && (
          <p className="text-sm text-[var(--muted)]">尚未建立公司 Sprint。管理員可按「新建 Sprint」開始。</p>
        )}
        {sprints.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedId(s.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              selectedId === s.id
                ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--line-2)]"
            }`}
          >
            {formatSprintWeekLabel(s.startDate, s.endDate)}
            <span className="ml-1.5 opacity-70">{STATUS_LABEL[s.status]}</span>
          </button>
        ))}
      </div>

      {board && (
        <section className="card space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[var(--ink)]">{board.sprint.name}</h3>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {formatSprintWeekLabel(board.sprint.startDate, board.sprint.endDate)}
                {board.sprint.goal ? ` · ${board.sprint.goal}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--muted)]">
                進度 {board.done}/{board.total}
              </span>
              {isAdmin && board.sprint.status !== "active" && (
                <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => setSprintStatus("active")}>
                  設為進行中
                </button>
              )}
              {isAdmin && board.sprint.status === "active" && (
                <button
                  type="button"
                  className="btn-secondary px-2.5 py-1.5 text-xs"
                  onClick={() => setSprintStatus("completed")}
                >
                  結束 Sprint
                </button>
              )}
              {isAdmin && (
                <button type="button" className="btn-primary gap-1 px-2.5 py-1.5 text-xs" onClick={openAddModal}>
                  <Plus className="h-3 w-3" />
                  加入任務
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {KANBAN_COLUMNS.map((col) => (
              <div
                key={col.value}
                className="min-h-[220px] rounded-xl border border-[var(--line)] bg-slate-50/80 p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropColumn(col.value)}
              >
                <p className="mb-2 px-1 text-[11px] font-bold tracking-wide text-[var(--muted)]">
                  {col.label}
                  <span className="ml-1 font-medium text-[var(--faint)]">{tasksByStatus[col.value].length}</span>
                </p>
                <div className="space-y-2">
                  {tasksByStatus[col.value].map((task) => (
                    <div
                      key={task.id}
                      draggable={canDrag(task)}
                      onDragStart={() => setDragTaskId(task.id)}
                      onDragEnd={() => setDragTaskId(null)}
                      className={`rounded-lg border border-[var(--line)] bg-white p-2.5 shadow-sm ${
                        canDrag(task) ? "cursor-grab active:cursor-grabbing" : ""
                      } ${dragTaskId === task.id ? "opacity-60" : ""}`}
                    >
                      <p className="text-sm font-medium text-[var(--ink)]">{task.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted)]">
                        <Link href={`/projects/${task.projectId}`} className="inline-flex items-center gap-0.5 hover:text-[var(--primary)]">
                          <FolderKanban className="h-3 w-3" />
                          {task.projectName}
                        </Link>
                        {task.assigneeName && <span>· {task.assigneeName}</span>}
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1 text-[10px] text-[var(--faint)] hover:text-[var(--danger)]"
                          onClick={() => removeTask(task.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                          移出 Sprint
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[var(--faint)]">
            提示：可拖曳自己負責的任務到其他欄位（{TASK_STATUS_OPTIONS.map((s) => s.label).join(" / ")}）
          </p>
        </section>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建本週 Sprint"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
              取消
            </button>
            <button type="submit" form="sprint-create" className="btn-primary" disabled={creating}>
              {creating ? "建立中…" : "建立"}
            </button>
          </>
        }
      >
        <form id="sprint-create" onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">開始</label>
              <input
                type="date"
                className="input-field w-full"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setEndDate(defaultSprintRange(e.target.value).endDate);
                }}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">結束</label>
              <input
                type="date"
                className="input-field w-full"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">目標（選填）</label>
            <input
              className="input-field w-full"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="這一週要完成什麼"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
            建立後設為進行中（會結束其他進行中的 Sprint）
          </label>
        </form>
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="從專案加入任務"
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={adding || !selectedTaskIds.size}
              onClick={handleAddTasks}
            >
              {adding ? "加入中…" : `加入（${selectedTaskIds.size}）`}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input-field text-sm"
              value={pickProjectId}
              onChange={(e) => setPickProjectId(e.target.value)}
            >
              <option value="">全部專案</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={selectAllVisible}>
              全選可見
            </button>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-[var(--line)] p-2">
            {filteredAssignable.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">沒有可加入的未完成任務</p>
            ) : (
              filteredAssignable.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedTaskIds.has(t.id)}
                    onChange={() => toggleTask(t.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--ink)]">{t.title}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {t.projectName}
                      {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                      {t.inSprint && t.sprintId !== selectedId ? " · 已在其他 Sprint" : ""}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="cal-toast" role="status">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
