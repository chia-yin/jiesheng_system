"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  FolderOpen,
  LayoutGrid,
  Link2,
  List,
  ListTodo,
  Pencil,
  Plus,
  Rocket,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  formatDate,
  formatDateRange,
  KANBAN_COLUMNS,
  labelOf,
  PRIORITY_DOT,
  PROJECT_PATH_PRESETS,
  PROJECT_STATUS_BORDER,
  PROJECT_STATUS_CHIP,
  PROJECT_STATUS_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_CHIP,
  TASK_STATUS_OPTIONS,
} from "@/lib/project-ui";
import { formatSprintWeekLabel } from "@/lib/sprint-utils";
import type { SessionUser } from "@/types/auth";
import type { Employee } from "@/types/attendance";
import type { Project, ProjectPath, ProjectSummary, Sprint, Task, TaskPriority, TaskStatus } from "@/types/system";

type TabKey = "overview" | "kanban" | "tasks";

interface ProjectDetail {
  project: Project;
  tasks: Task[];
  summary: ProjectSummary;
  companySprint: Sprint | null;
}

const TAB_ITEMS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "總覽", icon: LayoutGrid },
  { key: "kanban", label: "看板", icon: LayoutGrid },
  { key: "tasks", label: "任務列表", icon: List },
];

function ProjectProgressBar({ done, total, label = "整體任務進度" }: { done: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">
            {pct}
            <span className="text-base font-normal text-[var(--muted)]">%</span>
          </p>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {done} / {total} 完成
        </p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-blue-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MemberPicker({
  employees,
  selected,
  onChange,
}: {
  employees: Employee[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--line)] bg-slate-50/50 p-2">
      {employees.map((emp) => {
        const checked = selected.includes(emp.id);
        return (
          <button
            key={emp.id}
            type="button"
            onClick={() => toggle(emp.id)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
              checked ? "bg-blue-50 text-blue-800" : "hover:bg-white"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                checked
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--line-2)] bg-white"
              }`}
            >
              {checked && <Check className="h-3 w-3" />}
            </span>
            <span className="flex-1 truncate">{emp.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function isPresetLabel(label: string): label is (typeof PROJECT_PATH_PRESETS)[number] {
  return PROJECT_PATH_PRESETS.includes(label as (typeof PROJECT_PATH_PRESETS)[number]);
}

function PathEditor({
  value,
  onChange,
}: {
  value: ProjectPath[];
  onChange: (paths: ProjectPath[]) => void;
}) {
  function update(index: number, patch: Partial<ProjectPath>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-2">
      {value.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <select
            value={isPresetLabel(row.label) ? row.label : "__custom"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom") {
                update(index, { label: isPresetLabel(row.label) ? "" : row.label });
              } else {
                update(index, { label: v });
              }
            }}
            className="input-field w-[110px] py-1.5 text-sm"
          >
            {PROJECT_PATH_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="__custom">自訂</option>
          </select>
          {!isPresetLabel(row.label) && (
            <input
              value={row.label}
              onChange={(e) => update(index, { label: e.target.value })}
              className="input-field w-[100px] py-1.5 text-sm"
              placeholder="自訂標籤"
            />
          )}
          <input
            value={row.url}
            onChange={(e) => update(index, { url: e.target.value })}
            className="input-field min-w-0 flex-1 font-mono text-sm"
            placeholder="URL 或本機路徑"
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            className="rounded p-1.5 text-[var(--muted)] hover:bg-red-50 hover:text-[var(--red)]"
            aria-label="移除路徑"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { label: "前端", url: "" }])}
        className="btn-secondary gap-1 px-2.5 py-1.5 text-xs"
      >
        <Plus className="h-3 w-3" />
        新增路徑
      </button>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = String(params.id);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [taskModal, setTaskModal] = useState(false);
  const [projectModal, setProjectModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [projName, setProjName] = useState("");
  const [projDescription, setProjDescription] = useState("");
  const [projPaths, setProjPaths] = useState<ProjectPath[]>([]);
  const [projStatus, setProjStatus] = useState<Project["status"]>("planning");
  const [projManagerId, setProjManagerId] = useState("");
  const [projMemberIds, setProjMemberIds] = useState<string[]>([]);
  const [projStart, setProjStart] = useState("");
  const [projEnd, setProjEnd] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("backlog");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskInSprint, setTaskInSprint] = useState(false);
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterScope, setFilterScope] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");

  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, empRes, meRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch("/api/clock"),
        fetch("/api/auth/me"),
      ]);
      if (!detailRes.ok) {
        setDetail(null);
        return;
      }
      const detailData = await detailRes.json();
      const empData = await empRes.json();
      const meData = meRes.ok ? await meRes.json() : null;
      setDetail(detailData);
      setEmployees(empData.employees ?? []);
      setUser(meData?.user ?? null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const companySprintId = detail?.companySprint?.id;

  const filteredTasks = useMemo(() => {
    if (!detail) return [];
    return detail.tasks.filter((t) => {
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterScope === "sprint" && (!companySprintId || t.sprintId !== companySprintId)) return false;
      if (filterScope === "backlog" && companySprintId && t.sprintId === companySprintId) return false;
      if (filterAssignee && t.assigneeId !== filterAssignee) return false;
      return true;
    });
  }, [detail, filterStatus, filterScope, filterAssignee, companySprintId]);

  function canEditTask(task: Task) {
    return isAdmin || task.assigneeId === user?.employeeId;
  }

  function isThisSprint(task: Task) {
    return Boolean(companySprintId && task.sprintId === companySprintId);
  }

  function openProjectModal() {
    if (!detail) return;
    const p = detail.project;
    setMessage("");
    setProjName(p.name);
    setProjDescription(p.description ?? "");
    setProjPaths(
      p.paths?.length
        ? p.paths.map((x) => ({ ...x }))
        : [
            { label: "前端", url: "" },
            { label: "API", url: "" },
            { label: "GitLab", url: "" },
          ]
    );
    setProjStatus(p.status);
    setProjManagerId(p.managerId ?? "");
    setProjMemberIds(p.memberIds ?? []);
    setProjStart(p.startDate ?? "");
    setProjEnd(p.endDate ?? "");
    setProjectModal(true);
  }

  async function saveProject(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projName,
          description: projDescription,
          paths: projPaths,
          status: projStatus,
          managerId: projManagerId || null,
          memberIds: projMemberIds,
          startDate: projStart || null,
          endDate: projEnd || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "儲存失敗");
      setProjectModal(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    }
  }

  function openTaskModal(task?: Task) {
    setMessage("");
    if (task) {
      setEditingTask(task);
      setTaskTitle(task.title);
      setTaskDescription(task.description ?? "");
      setTaskStatus(task.status);
      setTaskPriority(task.priority);
      setTaskInSprint(isThisSprint(task));
      setTaskAssigneeId(task.assigneeId ?? "");
      setTaskDueDate(task.dueDate ?? "");
    } else {
      setEditingTask(null);
      setTaskTitle("");
      setTaskDescription("");
      setTaskStatus("backlog");
      setTaskPriority("medium");
      setTaskInSprint(false);
      setTaskAssigneeId("");
      setTaskDueDate("");
    }
    setTaskModal(true);
  }

  async function saveTask(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        title: taskTitle,
        description: taskDescription || undefined,
        status: taskStatus,
        priority: taskPriority,
        assigneeId: taskAssigneeId || undefined,
        dueDate: taskDueDate || undefined,
      };

      if (taskInSprint && companySprintId) {
        body.sprintId = companySprintId;
      } else if (editingTask) {
        body.sprintId = null;
      }

      const url = editingTask
        ? `/api/projects/${projectId}/tasks/${editingTask.id}`
        : `/api/projects/${projectId}/tasks`;
      const res = await fetch(url, {
        method: editingTask ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "儲存失敗");
      setTaskModal(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    }
  }

  async function updateTaskStatus(task: Task, status: TaskStatus) {
    const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await load();
  }

  async function deleteTask(task: Task) {
    if (!confirm(`確定刪除任務「${task.title}」？`)) return;
    const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (loading) {
    return <p className="p-6 text-sm text-[var(--muted)]">載入中…</p>;
  }

  if (!detail) {
    return (
      <section className="card p-6">
        <p className="text-sm text-[var(--muted)]">找不到專案或無權限查看</p>
        <Link href="/projects" className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--primary)]">
          <ArrowLeft className="h-4 w-4" />
          返回專案列表
        </Link>
      </section>
    );
  }

  const { project, tasks, summary, companySprint } = detail;
  const sprintTasks = companySprint
    ? tasks.filter((t) => t.sprintId === companySprint.id)
    : [];
  const sprintDone = sprintTasks.filter((t) => t.status === "done").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const backlogCount = tasks.filter((t) => !companySprint || t.sprintId !== companySprint.id).length;

  return (
    <>
      <section className={`card space-y-5 border-l-4 p-6 ${PROJECT_STATUS_BORDER[project.status]}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--primary)]">
              <ArrowLeft className="h-3.5 w-3.5" />
              返回專案列表
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-serif text-xl font-semibold">{project.name}</h2>
              <span className={PROJECT_STATUS_CHIP[project.status]}>
                {labelOf(PROJECT_STATUS_OPTIONS, project.status)}
              </span>
            </div>
            {project.description && <p className="text-sm text-[var(--muted)]">{project.description}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--faint)]">
              {project.managerName && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  負責人：{project.managerName}
                </span>
              )}
              {(project.memberIds?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {project.memberIds!.length} 位成員
                </span>
              )}
              {(project.startDate || project.endDate) && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateRange(project.startDate, project.endDate) || "—"}
                </span>
              )}
            </div>
            {(project.paths?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {project.paths!.map((item) =>
                  item.url.startsWith("http") ? (
                    <a
                      key={`${item.label}-${item.url}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-xs text-[var(--ink)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    >
                      <Link2 className="h-3 w-3 shrink-0 text-[var(--faint)]" />
                      <span className="font-medium">{item.label}</span>
                      <span className="max-w-[180px] truncate text-[var(--faint)]">{item.url}</span>
                    </a>
                  ) : (
                    <span
                      key={`${item.label}-${item.url}`}
                      title={item.url}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-xs"
                    >
                      <FolderOpen className="h-3 w-3 shrink-0 text-[var(--faint)]" />
                      <span className="font-medium">{item.label}</span>
                      <span className="max-w-[180px] truncate text-[var(--faint)]">{item.url}</span>
                    </span>
                  )
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <button type="button" onClick={openProjectModal} className="btn-secondary gap-1.5 px-3 py-2 text-xs">
                <Pencil className="h-3.5 w-3.5" />
                編輯專案
              </button>
            )}
            {isAdmin && (tab === "tasks" || tab === "overview") && (
              <button type="button" onClick={() => openTaskModal()} className="btn-primary gap-1.5 px-3 py-2 text-xs">
                <Plus className="h-3.5 w-3.5" />
                新增任務
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-[var(--line)] pb-1">
          {TAB_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                tab === item.key
                  ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "text-[var(--muted)] hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[var(--line)] bg-slate-50/50 p-5">
              <ProjectProgressBar done={summary.taskDone} total={summary.taskTotal} />
            </div>

            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
                    <Rocket className="h-3.5 w-3.5" />
                    本週 Sprint
                  </p>
                  {companySprint ? (
                    <>
                      <p className="mt-1 text-lg font-semibold text-blue-900">
                        {formatSprintWeekLabel(companySprint.startDate, companySprint.endDate)}
                      </p>
                      {companySprint.goal && (
                        <p className="mt-1 text-sm text-blue-700/80">{companySprint.goal}</p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-blue-800/80">目前沒有進行中的公司 Sprint</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-600">本專案本週任務</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-900">
                    {sprintDone}/{sprintTasks.length}
                  </p>
                </div>
              </div>

              {sprintTasks.length > 0 ? (
                <>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{
                        width: `${Math.round((sprintDone / sprintTasks.length) * 100)}%`,
                      }}
                    />
                  </div>
                  <ul className="mt-4 space-y-2">
                    {sprintTasks.slice(0, 8).map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white/80 px-3 py-2 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                          <span className="truncate font-medium">{task.title}</span>
                          {task.assigneeName && (
                            <span className="hidden shrink-0 text-xs text-[var(--faint)] sm:inline">
                              · {task.assigneeName}
                            </span>
                          )}
                        </div>
                        <span className={`shrink-0 ${TASK_STATUS_CHIP[task.status]}`}>
                          {labelOf(TASK_STATUS_OPTIONS, task.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {sprintTasks.length > 8 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterScope("sprint");
                        setTab("tasks");
                      }}
                      className="mt-3 text-xs text-blue-700 hover:underline"
                    >
                      查看全部本週任務 →
                    </button>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-blue-800/70">
                  本專案尚未納入本週 Sprint。
                  {isAdmin ? (
                    <>
                      {" "}
                      到{" "}
                      <Link href="/sprints" className="font-medium underline">
                        本週 Sprint
                      </Link>{" "}
                      勾選任務，或新增任務時勾選「加入本週 Sprint」。
                    </>
                  ) : null}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  <Rocket className="h-3.5 w-3.5" />
                  本週任務
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{sprintTasks.length}</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  <ListTodo className="h-3.5 w-3.5" />
                  進行中
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{inProgressCount}</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                <p className="text-xs text-[var(--muted)]">未排入本週</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{backlogCount}</p>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">近期任務</h3>
                <button
                  type="button"
                  onClick={() => setTab("tasks")}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  查看全部 →
                </button>
              </div>
              <div className="space-y-2">
                {tasks.slice(0, 6).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-sm transition hover:border-[var(--primary)]/40"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                      <span className="truncate font-medium">{task.title}</span>
                      {isThisSprint(task) && (
                        <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          本週
                        </span>
                      )}
                      {task.assigneeName && (
                        <span className="hidden shrink-0 text-xs text-[var(--faint)] sm:inline">
                          · {task.assigneeName}
                        </span>
                      )}
                    </div>
                    <span className={`shrink-0 ${TASK_STATUS_CHIP[task.status]}`}>
                      {labelOf(TASK_STATUS_OPTIONS, task.status)}
                    </span>
                  </div>
                ))}
                {!tasks.length && <p className="text-sm text-[var(--muted)]">尚無任務</p>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
              <button type="button" onClick={() => setTab("kanban")} className="btn-secondary gap-1.5 text-xs">
                <LayoutGrid className="h-3.5 w-3.5" />
                查看看板
              </button>
              <Link href="/sprints" className="btn-secondary gap-1.5 text-xs">
                <Rocket className="h-3.5 w-3.5" />
                本週 Sprint
              </Link>
              <Link href="/calendar" className="btn-secondary gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                行事曆
              </Link>
            </div>
          </div>
        )}

        {tab === "kanban" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                本週
              </span>
              標籤表示已納入本週 Sprint
              {companySprint && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterScope("sprint");
                    setTab("tasks");
                  }}
                  className="text-[var(--primary)] hover:underline"
                >
                  · 只看本週任務
                </button>
              )}
            </div>
            <div className="grid gap-3 overflow-x-auto lg:grid-cols-5">
              {KANBAN_COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.value);
                return (
                  <div key={col.value} className="min-w-[200px] rounded-[10px] border border-[var(--line)] bg-slate-50/80 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">{col.label}</h4>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--muted)]">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`rounded-lg border bg-white p-3 shadow-sm ${
                            isThisSprint(task) ? "border-blue-200" : "border-[var(--line)]"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-medium">{task.title}</p>
                                {isThisSprint(task) && (
                                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                    本週
                                  </span>
                                )}
                              </div>
                              {task.assigneeName && (
                                <p className="mt-1 text-xs text-[var(--faint)]">{task.assigneeName}</p>
                              )}
                            </div>
                          </div>
                          {canEditTask(task) && (
                            <select
                              value={task.status}
                              onChange={(e) => updateTaskStatus(task, e.target.value as TaskStatus)}
                              className="input-field mt-2 py-1 text-xs"
                            >
                              {TASK_STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field w-auto py-1.5 text-sm">
                <option value="">全部狀態</option>
                {TASK_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select value={filterScope} onChange={(e) => setFilterScope(e.target.value)} className="input-field w-auto py-1.5 text-sm">
                <option value="">全部範圍</option>
                <option value="sprint">本週 Sprint</option>
                <option value="backlog">未排入本週</option>
              </select>
              <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="input-field w-auto py-1.5 text-sm">
                <option value="">全部負責人</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-[10px] border border-[var(--line)]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">任務</th>
                    <th className="px-4 py-3">狀態</th>
                    <th className="px-4 py-3">優先級</th>
                    <th className="px-4 py-3">負責人</th>
                    <th className="px-4 py-3">範圍</th>
                    <th className="px-4 py-3">到期日</th>
                    {(isAdmin || filteredTasks.some(canEditTask)) && <th className="px-4 py-3">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="border-t border-[var(--line)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                          {task.title}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {canEditTask(task) ? (
                          <select
                            value={task.status}
                            onChange={(e) => updateTaskStatus(task, e.target.value as TaskStatus)}
                            className="input-field py-1 text-xs"
                          >
                            {TASK_STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          labelOf(TASK_STATUS_OPTIONS, task.status)
                        )}
                      </td>
                      <td className="px-4 py-3">{labelOf(TASK_PRIORITY_OPTIONS, task.priority)}</td>
                      <td className="px-4 py-3">{task.assigneeName ?? "—"}</td>
                      <td className="px-4 py-3">
                        {isThisSprint(task) ? (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                            本週
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">未排入</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{task.dueDate ? formatDate(task.dueDate) : "—"}</td>
                      {(isAdmin || canEditTask(task)) && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => openTaskModal(task)}
                                className="rounded p-1 text-[var(--muted)] hover:bg-slate-100"
                                aria-label="編輯"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {(isAdmin || canEditTask(task)) && (
                              <button
                                type="button"
                                onClick={() => deleteTask(task)}
                                className="rounded p-1 text-[var(--red)] hover:bg-red-50"
                                aria-label="刪除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredTasks.length && (
                <p className="p-6 text-center text-sm text-[var(--muted)]">沒有符合條件的任務</p>
              )}
            </div>
          </div>
        )}
      </section>

      <Modal
        open={projectModal}
        onClose={() => setProjectModal(false)}
        title="編輯專案"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setProjectModal(false)} className="btn-secondary">
              取消
            </button>
            <button type="submit" form="project-edit-form" className="btn-primary">
              儲存
            </button>
          </>
        }
      >
        <form id="project-edit-form" onSubmit={saveProject} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">專案名稱</label>
            <input
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm">專案路徑</label>
            <PathEditor value={projPaths} onChange={setProjPaths} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">負責人</label>
              <select
                value={projManagerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setProjManagerId(id);
                  if (id && !projMemberIds.includes(id)) {
                    setProjMemberIds([...projMemberIds, id]);
                  }
                }}
                className="input-field"
              >
                <option value="">未指定</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm">狀態</label>
              <select
                value={projStatus}
                onChange={(e) => setProjStatus(e.target.value as Project["status"])}
                className="input-field"
              >
                {PROJECT_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm">開始日期</label>
              <input
                type="date"
                value={projStart}
                onChange={(e) => setProjStart(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">結束日期</label>
              <input
                type="date"
                value={projEnd}
                onChange={(e) => setProjEnd(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm">參與人員（可多選）</label>
            <MemberPicker
              employees={employees}
              selected={projMemberIds}
              onChange={setProjMemberIds}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm">說明</label>
            <textarea
              value={projDescription}
              onChange={(e) => setProjDescription(e.target.value)}
              className="input-field min-h-[72px]"
            />
          </div>
          {message && <p className="text-sm text-[var(--red)]">{message}</p>}
        </form>
      </Modal>

      <Modal
        open={taskModal}
        onClose={() => setTaskModal(false)}
        title={editingTask ? "編輯任務" : "新增任務"}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setTaskModal(false)} className="btn-secondary">
              取消
            </button>
            <button type="submit" form="task-form" className="btn-primary">
              儲存
            </button>
          </>
        }
      >
        <form id="task-form" onSubmit={saveTask} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">標題</label>
            <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="mb-1 block text-sm">說明</label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="input-field min-h-[80px]"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">狀態</label>
              <select
                value={taskStatus}
                onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                className="input-field"
              >
                {TASK_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm">優先級</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                className="input-field"
              >
                {TASK_PRIORITY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm">負責人</label>
              <select value={taskAssigneeId} onChange={(e) => setTaskAssigneeId(e.target.value)} className="input-field">
                <option value="">未指派</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm">到期日</label>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          {companySprint ? (
            <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-slate-50/60 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={taskInSprint}
                onChange={(e) => setTaskInSprint(e.target.checked)}
                className="rounded border-[var(--line-2)]"
              />
              <span>
                加入本週 Sprint
                <span className="ml-1 text-xs text-[var(--muted)]">
                 （{formatSprintWeekLabel(companySprint.startDate, companySprint.endDate)}）
                </span>
              </span>
            </label>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              目前沒有進行中的公司 Sprint，無法標記為本週任務。請先到{" "}
              <Link href="/sprints" className="text-[var(--primary)] hover:underline">
                本週 Sprint
              </Link>{" "}
              建立。
            </p>
          )}
          {message && <p className="text-sm text-[var(--red)]">{message}</p>}
        </form>
      </Modal>
    </>
  );
}
