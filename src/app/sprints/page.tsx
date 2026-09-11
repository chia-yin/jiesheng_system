"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  FolderKanban,
  Mic,
  MicOff,
  Plus,
  Rocket,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  KANBAN_COLUMNS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/lib/project-ui";
import { defaultSprintRange, formatSprintWeekLabel } from "@/lib/sprint-utils";
import type { SessionUser } from "@/types/auth";
import type {
  Project,
  Sprint,
  SprintStatus,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/types/system";

type SprintTask = Task & { projectName: string };
type Board = { sprint: Sprint; tasks: SprintTask[]; done: number; total: number };
type Assignable = SprintTask & { inSprint: boolean };

type EmployeeOption = { id: string; name: string; department?: string };

type TaskDraft = {
  projectId: string;
  title: string;
  description: string;
  assigneeId: string;
  priority: TaskPriority;
  dueDate: string;
  addToSprint: boolean;
};

const STATUS_LABEL: Record<SprintStatus, string> = {
  planning: "規劃中",
  active: "進行中",
  completed: "已完成",
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function SprintsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
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
  const dragTaskIdRef = useRef<string | null>(null);
  const suppressClickRef = useRef(false);

  const [detailTask, setDetailTask] = useState<SprintTask | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailStatus, setDetailStatus] = useState<TaskStatus>("todo");
  const [detailPriority, setDetailPriority] = useState<TaskPriority>("medium");
  const [detailAssigneeId, setDetailAssigneeId] = useState("");
  const [detailDueDate, setDetailDueDate] = useState("");

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [quickParsing, setQuickParsing] = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);
  const [quickDrafts, setQuickDrafts] = useState<TaskDraft[]>([]);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = useMemo(() => Boolean(getSpeechRecognition()), []);

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
    const res = await fetch(`/api/sprints/${id}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setBoard(data);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/projects").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/sprints?mode=current").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/employees").then((r) => (r.ok ? r.json() : null)),
    ]).then(async ([me, proj, current, emp]) => {
      if (me?.user) setUser(me.user);
      if (proj?.projects) setProjects(proj.projects);
      if (emp?.employees) {
        setEmployees(
          (emp.employees as EmployeeOption[]).map((e) => ({
            id: e.id,
            name: e.name,
            department: e.department,
          }))
        );
      }
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

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

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
    if (creating) return;
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

    // 先樂觀更新畫面，避免等重新載入／快取造成拖曳後看不到結果
    const previous = board;
    setBoard((prev) => {
      if (!prev) return prev;
      const tasks = prev.tasks.map((t) =>
        t.id === taskId ? { ...t, status, updatedAt: new Date().toISOString() } : t
      );
      return {
        ...prev,
        tasks,
        done: tasks.filter((t) => t.status === "done").length,
        total: tasks.length,
      };
    });
    setDetailTask((prev) => (prev?.id === taskId ? { ...prev, status } : prev));

    const res = await fetch(`/api/sprints/${selectedId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status }),
      cache: "no-store",
    });
    if (!res.ok) {
      const data = await res.json();
      setBoard(previous);
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
    if (detailTask?.id === taskId) setDetailTask(null);
    await loadBoard(selectedId);
  }

  function canDrag(task: SprintTask) {
    return isAdmin || task.assigneeId === user?.employeeId;
  }

  function canEditDetail(task: SprintTask) {
    return isAdmin || task.assigneeId === user?.employeeId;
  }

  function openDetail(task: SprintTask) {
    setDetailTask(task);
    setDetailTitle(task.title);
    setDetailDescription(task.description ?? "");
    setDetailStatus(task.status);
    setDetailPriority(task.priority);
    setDetailAssigneeId(task.assigneeId ?? "");
    setDetailDueDate(task.dueDate ?? "");
  }

  async function saveDetail(e: React.FormEvent) {
    e.preventDefault();
    if (!detailTask || detailSaving) return;
    setDetailSaving(true);
    try {
      if (!isAdmin) {
        if (detailStatus !== detailTask.status) {
          await updateStatus(detailTask.id, detailStatus);
        }
        setDetailTask(null);
        showToast("狀態已更新");
        return;
      }

      const res = await fetch(`/api/projects/${detailTask.projectId}/tasks/${detailTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: detailTitle.trim(),
          description: detailDescription.trim() || undefined,
          status: detailStatus,
          priority: detailPriority,
          assigneeId: detailAssigneeId || null,
          dueDate: detailDueDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "儲存失敗");
      showToast("任務已更新");
      setDetailTask(null);
      if (selectedId) await loadBoard(selectedId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setDetailSaving(false);
    }
  }

  function onCardClick(task: SprintTask) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    openDetail(task);
  }

  function onDragStart(e: React.DragEvent, task: SprintTask) {
    if (!canDrag(task)) {
      e.preventDefault();
      return;
    }
    suppressClickRef.current = true;
    dragTaskIdRef.current = task.id;
    setDragTaskId(task.id);
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnd() {
    dragTaskIdRef.current = null;
    setDragTaskId(null);
    // 拖曳結束後短暫抑制 click，避免放開滑鼠時誤開詳情
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 50);
  }

  function onDropColumn(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || dragTaskIdRef.current;
    dragTaskIdRef.current = null;
    setDragTaskId(null);
    if (!taskId) return;
    const task = board?.tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    if (!canDrag(task)) {
      showToast("只能拖動自己負責的任務");
      return;
    }
    updateStatus(task.id, status);
  }

  function openQuickCreate() {
    setQuickText("");
    setQuickDrafts([]);
    setQuickOpen(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function toggleListening() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      showToast("此瀏覽器不支援語音輸入，請改用貼上文字");
      return;
    }
    if (listening) {
      stopListening();
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (ev) => {
      const transcript = Array.from(ev.results)
        .map((r) => r[0].transcript)
        .join("");
      setQuickText((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      setListening(false);
      showToast("語音辨識失敗，請再試一次");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function parseQuickText() {
    if (!quickText.trim() || quickParsing) return;
    setQuickParsing(true);
    stopListening();
    try {
      const res = await fetch("/api/tasks/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: quickText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "解析失敗");
      if (data.employees?.length) {
        setEmployees(data.employees);
      }
      const drafts: TaskDraft[] = (data.tasks as Array<{
        projectId: string | null;
        title: string;
        description?: string;
        assigneeId: string | null;
        priority: TaskPriority;
        dueDate: string | null;
        addToSprint: boolean;
      }>).map((t) => ({
        projectId: t.projectId ?? projects[0]?.id ?? "",
        title: t.title,
        description: t.description ?? "",
        assigneeId: t.assigneeId ?? "",
        priority: t.priority ?? "medium",
        dueDate: t.dueDate ?? "",
        addToSprint: t.addToSprint !== false,
      }));
      setQuickDrafts(drafts);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "解析失敗");
    } finally {
      setQuickParsing(false);
    }
  }

  function updateDraft(index: number, patch: Partial<TaskDraft>) {
    setQuickDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function removeDraft(index: number) {
    setQuickDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function createFromDrafts() {
    if (!quickDrafts.length || quickCreating) return;
    const missing = quickDrafts.find((d) => !d.projectId || !d.title.trim());
    if (missing) {
      showToast("每筆任務都需要專案與標題");
      return;
    }
    setQuickCreating(true);
    let created = 0;
    try {
      for (const d of quickDrafts) {
        const res = await fetch(`/api/projects/${d.projectId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: d.title.trim(),
            description: d.description.trim() || undefined,
            priority: d.priority,
            assigneeId: d.assigneeId || undefined,
            dueDate: d.dueDate || undefined,
            status: "todo",
            sprintId: d.addToSprint && selectedId ? selectedId : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "建立失敗");
        created++;
      }
      showToast(`已建立 ${created} 項任務`);
      setQuickOpen(false);
      setQuickDrafts([]);
      setQuickText("");
      if (selectedId) await loadBoard(selectedId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setQuickCreating(false);
    }
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
          <p className="mt-1 text-sm text-[var(--muted)]">
            點擊卡片查看 · 拖曳改狀態 · 可用語音／文字快速建立
          </p>
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
                <>
                  <button type="button" className="btn-secondary gap-1 px-2.5 py-1.5 text-xs" onClick={openQuickCreate}>
                    <Sparkles className="h-3 w-3" />
                    快速建立
                  </button>
                  <button type="button" className="btn-primary gap-1 px-2.5 py-1.5 text-xs" onClick={openAddModal}>
                    <Plus className="h-3 w-3" />
                    加入任務
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {KANBAN_COLUMNS.map((col) => (
              <div
                key={col.value}
                className="min-h-[220px] rounded-xl border border-[var(--line)] bg-slate-50/80 p-2"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => onDropColumn(e, col.value)}
              >
                <p className="mb-2 px-1 text-[11px] font-bold tracking-wide text-[var(--muted)]">
                  {col.label}
                  <span className="ml-1 font-medium text-[var(--faint)]">{tasksByStatus[col.value].length}</span>
                </p>
                <div className="space-y-2">
                  {tasksByStatus[col.value].map((task) => (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      draggable={canDrag(task)}
                      onClick={() => onCardClick(task)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onCardClick(task);
                        }
                      }}
                      onDragStart={(e) => onDragStart(e, task)}
                      onDragEnd={onDragEnd}
                      className={`select-none rounded-lg border border-[var(--line)] bg-white p-2.5 shadow-sm transition hover:border-[var(--primary)]/30 ${
                        canDrag(task) ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                      } ${dragTaskId === task.id ? "opacity-60 ring-2 ring-[var(--primary)]/30" : ""}`}
                    >
                      <p className="text-sm font-medium text-[var(--ink)]">{task.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted)]">
                        <Link
                          href={`/projects/${task.projectId}`}
                          data-no-card-click
                          className="inline-flex items-center gap-0.5 hover:text-[var(--primary)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FolderKanban className="h-3 w-3" />
                          {task.projectName}
                        </Link>
                        {task.assigneeName && <span>· {task.assigneeName}</span>}
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          data-no-card-click
                          className="mt-2 inline-flex items-center gap-1 text-[10px] text-[var(--faint)] hover:text-[var(--danger)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTask(task.id);
                          }}
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
            點一下卡片查看詳情；按住拖到其他欄位可改狀態（{TASK_STATUS_OPTIONS.map((s) => s.label).join(" / ")}）
          </p>
        </section>
      )}

      <Modal
        open={Boolean(detailTask)}
        onClose={() => setDetailTask(null)}
        title="任務詳情"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDetailTask(null)} disabled={detailSaving}>
              關閉
            </button>
            {detailTask && canEditDetail(detailTask) && (
              <button type="submit" form="sprint-task-detail" className="btn-primary" disabled={detailSaving}>
                {detailSaving ? "儲存中…" : "儲存"}
              </button>
            )}
          </>
        }
      >
        {detailTask && (
          <form id="sprint-task-detail" onSubmit={saveDetail} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">標題</label>
              <input
                className="input-field w-full"
                value={detailTitle}
                onChange={(e) => setDetailTitle(e.target.value)}
                disabled={!isAdmin}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">說明</label>
              <textarea
                className="input-field min-h-[72px] w-full"
                value={detailDescription}
                onChange={(e) => setDetailDescription(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <p className="text-xs text-[var(--muted)]">
              專案：{" "}
              <Link href={`/projects/${detailTask.projectId}`} className="text-[var(--primary)] hover:underline">
                {detailTask.projectName}
              </Link>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">狀態</label>
                <select
                  className="input-field w-full"
                  value={detailStatus}
                  onChange={(e) => setDetailStatus(e.target.value as TaskStatus)}
                  disabled={!canEditDetail(detailTask)}
                >
                  {TASK_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">優先級</label>
                <select
                  className="input-field w-full"
                  value={detailPriority}
                  onChange={(e) => setDetailPriority(e.target.value as TaskPriority)}
                  disabled={!isAdmin}
                >
                  {TASK_PRIORITY_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">負責人</label>
                {isAdmin ? (
                  <select
                    className="input-field w-full"
                    value={detailAssigneeId}
                    onChange={(e) => setDetailAssigneeId(e.target.value)}
                  >
                    <option value="">未指派</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="input-field w-full bg-slate-50 text-sm text-[var(--muted)]">
                    {detailTask.assigneeName ?? "未指派"}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">到期日</label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={detailDueDate}
                  onChange={(e) => setDetailDueDate(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                className="text-xs text-[var(--danger)] hover:underline"
                onClick={() => removeTask(detailTask.id)}
              >
                從本週 Sprint 移出
              </button>
            )}
          </form>
        )}
      </Modal>

      <Modal
        open={quickOpen}
        onClose={() => {
          stopListening();
          setQuickOpen(false);
        }}
        title="快速建立任務"
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                stopListening();
                setQuickOpen(false);
              }}
              disabled={quickCreating}
            >
              取消
            </button>
            {quickDrafts.length === 0 ? (
              <button
                type="button"
                className="btn-primary gap-1"
                disabled={quickParsing || !quickText.trim()}
                onClick={parseQuickText}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {quickParsing ? "解析中…" : "AI 解析"}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                disabled={quickCreating}
                onClick={createFromDrafts}
              >
                {quickCreating ? "建立中…" : `確認建立（${quickDrafts.length}）`}
              </button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {quickDrafts.length === 0 ? (
            <>
              <p className="text-sm text-[var(--muted)]">
                用一句話或語音描述，例如：「資產負債表，給晁偉做進測簡報，這週要」
              </p>
              <textarea
                className="input-field min-h-[120px] w-full"
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                placeholder="貼上或輸入任務描述…"
              />
              {speechSupported && (
                <button
                  type="button"
                  className={`btn-secondary gap-1.5 text-xs ${listening ? "border-rose-300 text-rose-700" : ""}`}
                  onClick={toggleListening}
                >
                  {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {listening ? "停止錄音" : "語音輸入"}
                </button>
              )}
            </>
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-y-auto">
              <button
                type="button"
                className="text-xs text-[var(--primary)] hover:underline"
                onClick={() => setQuickDrafts([])}
              >
                ← 回到描述
              </button>
              {quickDrafts.map((d, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-[var(--line)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[var(--muted)]">任務 {i + 1}</p>
                    <button type="button" className="text-[10px] text-[var(--faint)] hover:text-[var(--danger)]" onClick={() => removeDraft(i)}>
                      移除
                    </button>
                  </div>
                  <input
                    className="input-field w-full text-sm"
                    value={d.title}
                    onChange={(e) => updateDraft(i, { title: e.target.value })}
                    placeholder="標題"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      className="input-field text-sm"
                      value={d.projectId}
                      onChange={(e) => updateDraft(i, { projectId: e.target.value })}
                    >
                      <option value="">選擇專案</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input-field text-sm"
                      value={d.assigneeId}
                      onChange={(e) => updateDraft(i, { assigneeId: e.target.value })}
                    >
                      <option value="">未指派</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input-field text-sm"
                      value={d.priority}
                      onChange={(e) => updateDraft(i, { priority: e.target.value as TaskPriority })}
                    >
                      {TASK_PRIORITY_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className="input-field text-sm"
                      value={d.dueDate}
                      onChange={(e) => updateDraft(i, { dueDate: e.target.value })}
                    />
                  </div>
                  <textarea
                    className="input-field min-h-[56px] w-full text-sm"
                    value={d.description}
                    onChange={(e) => updateDraft(i, { description: e.target.value })}
                    placeholder="說明（選填）"
                  />
                  <label className="flex items-center gap-2 text-xs text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={d.addToSprint}
                      onChange={(e) => updateDraft(i, { addToSprint: e.target.checked })}
                    />
                    加入本週 Sprint
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

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
