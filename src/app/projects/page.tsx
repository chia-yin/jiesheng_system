"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Plus,
  Rocket,
  User,
  Users,
} from "lucide-react";
import { ListControls } from "@/components/ListControls";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  labelOf,
  PROJECT_PATH_PRESETS,
  PROJECT_STATUS_BORDER,
  PROJECT_STATUS_CHIP,
  PROJECT_STATUS_OPTIONS,
} from "@/lib/project-ui";
import { useListPipeline, type SortOrder } from "@/lib/list-utils";
import type { SessionUser } from "@/types/auth";
import type { Employee } from "@/types/attendance";
import type { Project, ProjectPath, ProjectSummary } from "@/types/system";

type ProjectWithSummary = Project & { summary?: ProjectSummary };

function isMine(project: Project, employeeId?: string) {
  if (!employeeId) return false;
  return (
    project.managerId === employeeId ||
    (project.memberIds?.includes(employeeId) ?? false)
  );
}

function ProgressMini({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
        {done}/{total}
      </span>
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
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
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
            <span className="text-[11px] text-[var(--faint)]">
              {emp.role === "admin" ? "管理員" : "員工"}
            </span>
          </button>
        );
      })}
      {!employees.length && (
        <p className="px-2 py-3 text-center text-xs text-[var(--muted)]">尚無員工</p>
      )}
    </div>
  );
}

function emptyPathRow(): ProjectPath {
  return { label: "前端", url: "" };
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

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
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
            onClick={() => remove(index)}
            className="rounded p-1.5 text-[var(--muted)] hover:bg-red-50 hover:text-[var(--red)]"
            aria-label="移除路徑"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, emptyPathRow()])}
        className="btn-secondary gap-1 px-2.5 py-1.5 text-xs"
      >
        <Plus className="h-3 w-3" />
        新增路徑
      </button>
      <p className="text-[11px] text-[var(--faint)]">
        一包專案可分別填前端、API、GitLab 等路徑
      </p>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [paths, setPaths] = useState<ProjectPath[]>([
    { label: "前端", url: "" },
    { label: "API", url: "" },
    { label: "GitLab", url: "" },
  ]);
  const [managerId, setManagerId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [status, setStatus] = useState<Project["status"]>("planning");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [mineOnly, setMineOnly] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const isAdmin = user?.role === "admin";

  async function load() {
    const [projRes, empRes, meRes] = await Promise.all([
      fetch("/api/projects"),
      fetch("/api/clock"),
      fetch("/api/auth/me"),
    ]);
    const projData = await projRes.json();
    const empData = await empRes.json();
    const meData = meRes.ok ? await meRes.json() : null;
    setProjects(projData.projects ?? []);
    setEmployees(empData.employees ?? []);
    setUser(meData?.user ?? null);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [month, sortOrder, mineOnly, statusFilter]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (mineOnly && user && !isMine(p, user.employeeId)) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, mineOnly, user, statusFilter]);

  const { items: pagedProjects, totalCount, totalPages, page: safePage } = useListPipeline(
    filteredProjects,
    {
      month,
      getDates: (p) => [p.createdAt, p.startDate, p.endDate].filter(Boolean) as string[],
      getSortDate: (p) => p.updatedAt ?? p.createdAt,
      sortOrder,
      page,
      pageSize: 8,
    }
  );

  function openModal() {
    setMessage("");
    setName("");
    setDescription("");
    setPaths([
      { label: "前端", url: "" },
      { label: "API", url: "" },
      { label: "GitLab", url: "" },
    ]);
    setManagerId("");
    setMemberIds([]);
    setStatus("planning");
    setShowModal(true);
  }

  function handleManagerChange(id: string) {
    setManagerId(id);
    if (id && !memberIds.includes(id)) {
      setMemberIds([...memberIds, id]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          paths,
          status,
          managerId: managerId || undefined,
          memberIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "建立失敗");

      setShowModal(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold">專案列表</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {mineOnly ? "僅顯示你負責或參與的專案" : "顯示全部可見專案"}
            </p>
          </div>
          {isAdmin && (
            <button type="button" onClick={openModal} className="btn-primary gap-1.5 px-3 py-2 text-xs">
              <Plus className="h-3.5 w-3.5" />
              新增專案
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMineOnly(true)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mineOnly
                ? "bg-[var(--primary)] text-white"
                : "bg-slate-100 text-[var(--muted)] hover:bg-slate-200"
            }`}
          >
            我負責的
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setMineOnly(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                !mineOnly
                  ? "bg-[var(--primary)] text-white"
                  : "bg-slate-100 text-[var(--muted)] hover:bg-slate-200"
              }`}
            >
              全部專案
            </button>
          )}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto py-1.5 text-xs"
          >
            <option value="">全部狀態</option>
            {PROJECT_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <ListControls
          month={month}
          onMonthChange={setMonth}
          totalCount={totalCount}
          page={safePage}
          totalPages={totalPages}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
        />

        {pagedProjects.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pagedProjects.map((proj) => {
              const sprint = proj.summary?.activeSprint;
              const sprintTotal = proj.summary?.sprintTaskTotal ?? 0;
              const sprintDone = proj.summary?.sprintTaskDone ?? 0;
              const memberCount = proj.memberIds?.length ?? 0;
              const done = proj.summary?.taskDone ?? 0;
              const total = proj.summary?.taskTotal ?? 0;

              return (
                <Link
                  key={proj.id}
                  href={`/projects/${proj.id}`}
                  className={`group flex flex-col rounded-xl border border-[var(--line)] border-l-4 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--primary)]/40 hover:shadow-md ${PROJECT_STATUS_BORDER[proj.status]}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate font-semibold group-hover:text-[var(--primary)]">
                      {proj.name}
                    </p>
                    <span className={`shrink-0 ${PROJECT_STATUS_CHIP[proj.status]}`}>
                      {labelOf(PROJECT_STATUS_OPTIONS, proj.status)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                    {proj.managerName && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {proj.managerName}
                      </span>
                    )}
                    {memberCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {memberCount} 人
                      </span>
                    )}
                  </div>

                  {(proj.paths?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {proj.paths!.slice(0, 3).map((p) => (
                        <span
                          key={`${p.label}-${p.url}`}
                          className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] text-[var(--faint)]"
                        >
                          {p.label}
                        </span>
                      ))}
                      {proj.paths!.length > 3 && (
                        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] text-[var(--faint)]">
                          +{proj.paths!.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto space-y-2 pt-3">
                    {sprint && sprintTotal > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        <Rocket className="h-3 w-3" />
                        本週 {sprintDone}/{sprintTotal}
                      </span>
                    ) : sprint ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--faint)]">
                        <Rocket className="h-3 w-3" />
                        本週尚未納入任務
                      </span>
                    ) : null}
                    <ProgressMini done={done} total={total} />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
            {mineOnly
              ? "目前沒有你負責或參與的專案"
              : month
                ? "此月份沒有專案"
                : "尚無專案"}
            {isAdmin && !month && !mineOnly && "，請建立第一個專案"}
          </p>
        )}

        {totalCount > 0 && (
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        )}
      </section>

      {isAdmin && (
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title="新增專案"
          size="lg"
          footer={
            <>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                取消
              </button>
              <button
                type="submit"
                form="project-form"
                disabled={loading}
                className="btn-primary disabled:opacity-50"
              >
                {loading ? "建立中…" : "建立專案"}
              </button>
            </>
          }
        >
          <form id="project-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm">專案名稱</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">專案路徑</label>
              <PathEditor value={paths} onChange={setPaths} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm">負責人</label>
                <select
                  value={managerId}
                  onChange={(e) => handleManagerChange(e.target.value)}
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
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Project["status"])}
                  className="input-field"
                >
                  {PROJECT_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm">參與人員（可多選）</label>
              <MemberPicker employees={employees} selected={memberIds} onChange={setMemberIds} />
              <p className="mt-1 text-[11px] text-[var(--faint)]">
                已選 {memberIds.length} 人；負責人會自動納入
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm">說明</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field min-h-[72px]"
              />
            </div>
            {message && <p className="text-sm text-[var(--red)]">{message}</p>}
          </form>
        </Modal>
      )}
    </>
  );
}
