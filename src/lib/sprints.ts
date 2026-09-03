import { getStore, newId, saveStore } from "@/lib/db";
import type { SessionUser } from "@/types/auth";
import type { Sprint, SprintStatus, Task, TaskStatus } from "@/types/system";
import { canEditTask } from "@/lib/projects";
import { defaultSprintRange, formatSprintWeekLabel } from "@/lib/sprint-utils";

export { defaultSprintRange, formatSprintWeekLabel } from "@/lib/sprint-utils";

function now() {
  return new Date().toISOString();
}

function taipeiDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);
}

export type SprintTaskView = Task & { projectName: string };

export type SprintBoard = {
  sprint: Sprint;
  tasks: SprintTaskView[];
  done: number;
  total: number;
};

function isCompanySprint(s: Sprint): boolean {
  return !s.projectId;
}

export async function listCompanySprints(): Promise<Sprint[]> {
  const store = await getStore();
  return store.sprints
    .filter(isCompanySprint)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

export async function getActiveCompanySprint(): Promise<Sprint | null> {
  const store = await getStore();
  const active = store.sprints.find((s) => isCompanySprint(s) && s.status === "active");
  if (active) return active;

  const today = taipeiDateKey();
  const inRange = store.sprints
    .filter((s) => isCompanySprint(s) && s.startDate <= today && s.endDate >= today)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return inRange[0] ?? null;
}

export async function getSprintBoard(sprintId: string): Promise<SprintBoard | null> {
  const store = await getStore();
  const sprint = store.sprints.find((s) => s.id === sprintId);
  if (!sprint) return null;

  const projectMap = new Map(store.projects.map((p) => [p.id, p.name]));
  const tasks: SprintTaskView[] = store.tasks
    .filter((t) => t.sprintId === sprintId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((t) => ({
      ...t,
      projectName: projectMap.get(t.projectId) ?? "未知專案",
    }));

  return {
    sprint,
    tasks,
    done: tasks.filter((t) => t.status === "done").length,
    total: tasks.length,
  };
}

export async function createCompanySprint(input: {
  name?: string;
  goal?: string;
  status?: SprintStatus;
  startDate?: string;
  endDate?: string;
}) {
  const store = await getStore();
  const range = defaultSprintRange(input.startDate);
  const startDate = input.startDate ?? range.startDate;
  const endDate = input.endDate ?? range.endDate;
  const name = input.name?.trim() || `本週 Sprint（${formatSprintWeekLabel(startDate, endDate)}）`;

  if (input.status === "active") {
    for (const s of store.sprints) {
      if (isCompanySprint(s) && s.status === "active") s.status = "completed";
    }
  }

  const sprint: Sprint = {
    id: newId("sprint"),
    name,
    goal: input.goal,
    status: input.status ?? "planning",
    startDate,
    endDate,
    createdAt: now(),
  };

  store.sprints.unshift(sprint);
  await saveStore(store);
  return sprint;
}

export async function updateCompanySprint(
  sprintId: string,
  input: Partial<{
    name: string;
    goal: string;
    status: SprintStatus;
    startDate: string;
    endDate: string;
  }>
) {
  const store = await getStore();
  const sprint = store.sprints.find((s) => s.id === sprintId);
  if (!sprint || sprint.projectId) throw new Error("找不到公司 Sprint");

  if (input.status === "active") {
    for (const s of store.sprints) {
      if (isCompanySprint(s) && s.id !== sprintId && s.status === "active") {
        s.status = "completed";
      }
    }
  }

  if (input.name !== undefined) sprint.name = input.name;
  if (input.goal !== undefined) sprint.goal = input.goal;
  if (input.status !== undefined) sprint.status = input.status;
  if (input.startDate !== undefined) sprint.startDate = input.startDate;
  if (input.endDate !== undefined) sprint.endDate = input.endDate;

  await saveStore(store);
  return sprint;
}

export async function deleteCompanySprint(sprintId: string) {
  const store = await getStore();
  const index = store.sprints.findIndex((s) => s.id === sprintId && !s.projectId);
  if (index === -1) throw new Error("找不到公司 Sprint");

  store.sprints.splice(index, 1);
  for (const task of store.tasks) {
    if (task.sprintId === sprintId) task.sprintId = undefined;
  }
  await saveStore(store);
}

/** 可加入 Sprint 的未完成任務（依專案） */
export async function listAssignableTasks(projectId?: string) {
  const store = await getStore();
  const projectMap = new Map(store.projects.map((p) => [p.id, p.name]));

  return store.tasks
    .filter((t) => {
      if (t.status === "done") return false;
      if (projectId && t.projectId !== projectId) return false;
      return true;
    })
    .map((t) => ({
      ...t,
      projectName: projectMap.get(t.projectId) ?? "未知專案",
      inSprint: Boolean(t.sprintId),
    }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName, "zh-TW"));
}

export async function attachTasksToSprint(sprintId: string, taskIds: string[]) {
  const store = await getStore();
  const sprint = store.sprints.find((s) => s.id === sprintId);
  if (!sprint) throw new Error("找不到 Sprint");

  const idSet = new Set(taskIds);
  let attached = 0;
  for (const task of store.tasks) {
    if (idSet.has(task.id)) {
      task.sprintId = sprintId;
      task.updatedAt = now();
      attached++;
    }
  }
  await saveStore(store);
  return { attached };
}

export async function detachTaskFromSprint(sprintId: string, taskId: string) {
  const store = await getStore();
  const task = store.tasks.find((t) => t.id === taskId && t.sprintId === sprintId);
  if (!task) throw new Error("找不到任務");
  task.sprintId = undefined;
  task.updatedAt = now();
  await saveStore(store);
  return task;
}

export async function updateSprintTaskStatus(
  taskId: string,
  status: TaskStatus,
  session: SessionUser
) {
  const store = await getStore();
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("找不到任務");
  if (!canEditTask(task, session)) throw new Error("無權限更新此任務");

  task.status = status;
  task.updatedAt = now();
  await saveStore(store);
  return task;
}
