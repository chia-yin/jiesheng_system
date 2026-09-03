import type {
  ProjectPath,
  ProjectStatus,
  SprintStatus,
  TaskPriority,
  TaskStatus,
} from "@/types/system";

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "planning", label: "規劃中" },
  { value: "active", label: "進行中" },
  { value: "on_hold", label: "暫停" },
  { value: "completed", label: "已完成" },
  { value: "archived", label: "已封存" },
];

export const PROJECT_STATUS_CHIP: Record<ProjectStatus, string> = {
  planning: "chip-planning",
  active: "chip-info",
  on_hold: "chip-pending",
  completed: "chip-approved",
  archived: "chip-muted",
};

export const PROJECT_STATUS_BORDER: Record<ProjectStatus, string> = {
  planning: "border-l-slate-400",
  active: "border-l-blue-500",
  on_hold: "border-l-amber-500",
  completed: "border-l-emerald-500",
  archived: "border-l-slate-300",
};

export const SPRINT_STATUS_OPTIONS: { value: SprintStatus; label: string }[] = [
  { value: "planning", label: "規劃中" },
  { value: "active", label: "進行中" },
  { value: "completed", label: "已完成" },
];

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "待辦" },
  { value: "in_progress", label: "進行中" },
  { value: "review", label: "審核" },
  { value: "done", label: "完成" },
];

export const TASK_STATUS_CHIP: Record<TaskStatus, string> = {
  backlog: "chip-muted",
  todo: "chip-pending",
  in_progress: "chip-info",
  review: "chip-pending",
  done: "chip-approved",
};

export const KANBAN_COLUMNS: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "待辦" },
  { value: "in_progress", label: "進行中" },
  { value: "review", label: "審核" },
  { value: "done", label: "完成" },
];

export const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "urgent", label: "緊急" },
];

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

export const PROJECT_PATH_PRESETS = ["前端", "API", "後端", "GitLab", "文件"] as const;

export function normalizeProjectPaths(
  input?: Array<{ label?: string; url?: string }> | null
): ProjectPath[] | undefined {
  if (!input?.length) return undefined;
  const cleaned = input
    .map((p) => ({
      label: String(p.label ?? "").trim() || "路徑",
      url: String(p.url ?? "").trim(),
    }))
    .filter((p) => p.url);
  return cleaned.length ? cleaned : undefined;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-TW");
}

export function formatDateRange(start?: string, end?: string) {
  if (!start) return "";
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** 去掉名稱前綴 "Sprint "，避免標籤與內容重複 */
export function formatSprintShort(name: string): string {
  return name.replace(/^Sprint\s+/i, "");
}

/** 迭代顯示：Sprint 2 · 開發上線 → 第 2 期 · 開發上線 */
export function formatSprintDisplay(name: string): string {
  const short = formatSprintShort(name);
  const match = short.match(/^(\d+)\s*[·・]\s*(.+)$/);
  if (match) return `第 ${match[1]} 期 · ${match[2]}`;
  return name;
}

export function labelOf<T extends string>(
  options: { value: T; label: string }[],
  value: T
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
