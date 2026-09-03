import { getStore, newId, saveStore } from "@/lib/db";
import type { SessionUser } from "@/types/auth";
import type {
  Project,
  ProjectPath,
  ProjectStatus,
  ProjectSummary,
  Sprint,
  SprintStatus,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/types/system";
import { normalizeProjectPaths } from "@/lib/project-ui";

function now() {
  return new Date().toISOString();
}

export function canViewProject(project: Project, session: SessionUser): boolean {
  if (session.role === "admin") return true;
  if (!project.memberIds?.length) return true;
  return (
    project.memberIds.includes(session.employeeId) ||
    project.managerId === session.employeeId
  );
}

export function canEditTask(task: Task, session: SessionUser): boolean {
  if (session.role === "admin") return true;
  return task.assigneeId === session.employeeId;
}

function findActiveCompanySprint(sprints: Sprint[]): Sprint | undefined {
  const active = sprints.find((s) => !s.projectId && s.status === "active");
  if (active) return active;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  return sprints
    .filter((s) => !s.projectId && s.startDate <= today && s.endDate >= today)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function buildProjectSummary(projectId: string, sprints: Sprint[], tasks: Task[]): ProjectSummary {
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const activeSprint = findActiveCompanySprint(sprints);
  const sprintTasks = activeSprint
    ? projectTasks.filter((t) => t.sprintId === activeSprint.id)
    : [];
  return {
    taskTotal: projectTasks.length,
    taskDone: projectTasks.filter((t) => t.status === "done").length,
    activeSprint,
    sprintTaskTotal: sprintTasks.length,
    sprintTaskDone: sprintTasks.filter((t) => t.status === "done").length,
  };
}

export async function getProjects(session: SessionUser) {
  const store = await getStore();
  const visible = store.projects
    .filter((p) => canViewProject(p, session))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return visible.map((project) => ({
    ...project,
    summary: buildProjectSummary(project.id, store.sprints, store.tasks),
  }));
}

export async function getProjectById(id: string, session: SessionUser) {
  const store = await getStore();
  const project = store.projects.find((p) => p.id === id);
  if (!project) return null;
  if (!canViewProject(project, session)) return null;
  return project;
}

export function isProjectMine(project: Project, employeeId: string): boolean {
  return (
    project.managerId === employeeId ||
    (project.memberIds?.includes(employeeId) ?? false)
  );
}

export async function createProject(input: {
  name: string;
  description?: string;
  paths?: ProjectPath[];
  status?: ProjectStatus;
  managerId?: string;
  memberIds?: string[];
  startDate?: string;
  endDate?: string;
}) {
  const store = await getStore();
  const manager = input.managerId
    ? store.employees.find((e) => e.id === input.managerId)
    : undefined;

  const memberIds = input.memberIds?.filter(Boolean);
  const members = memberIds
    ? store.employees.filter((e) => memberIds.includes(e.id)).map((e) => e.id)
    : undefined;

  // 負責人自動納入參與人員
  const memberSet = new Set(members ?? []);
  if (manager?.id) memberSet.add(manager.id);

  const timestamp = now();
  const project: Project = {
    id: newId("proj"),
    name: input.name,
    description: input.description,
    paths: normalizeProjectPaths(input.paths),
    status: input.status ?? "planning",
    managerId: manager?.id,
    managerName: manager?.name,
    memberIds: memberSet.size ? [...memberSet] : undefined,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.projects.unshift(project);
  await saveStore(store);
  return project;
}

export async function updateProject(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    paths: ProjectPath[] | null;
    status: ProjectStatus;
    managerId: string | null;
    memberIds: string[];
    startDate: string | null;
    endDate: string | null;
  }>
) {
  const store = await getStore();
  const project = store.projects.find((p) => p.id === id);
  if (!project) throw new Error("找不到專案");

  if (input.name !== undefined) project.name = input.name;
  if (input.description !== undefined) project.description = input.description;
  if (input.paths !== undefined) {
    project.paths = input.paths === null ? undefined : normalizeProjectPaths(input.paths);
  }
  if (input.status !== undefined) project.status = input.status;
  if (input.startDate !== undefined) project.startDate = input.startDate || undefined;
  if (input.endDate !== undefined) project.endDate = input.endDate || undefined;

  if (input.managerId !== undefined) {
    if (!input.managerId) {
      project.managerId = undefined;
      project.managerName = undefined;
    } else {
      const manager = store.employees.find((e) => e.id === input.managerId);
      project.managerId = manager?.id;
      project.managerName = manager?.name;
    }
  }

  if (input.memberIds !== undefined) {
    const ids = store.employees
      .filter((e) => input.memberIds!.includes(e.id))
      .map((e) => e.id);
    if (project.managerId && !ids.includes(project.managerId)) {
      ids.push(project.managerId);
    }
    project.memberIds = ids;
  }

  project.updatedAt = now();
  await saveStore(store);
  return project;
}

export async function deleteProject(id: string) {
  const store = await getStore();
  const index = store.projects.findIndex((p) => p.id === id);
  if (index === -1) throw new Error("找不到專案");

  store.projects.splice(index, 1);
  store.sprints = store.sprints.filter((s) => s.projectId !== id);
  store.tasks = store.tasks.filter((t) => t.projectId !== id);
  await saveStore(store);
}

export async function getSprints(projectId: string) {
  const store = await getStore();
  return store.sprints
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createSprint(
  projectId: string,
  input: {
    name: string;
    goal?: string;
    status?: SprintStatus;
    startDate: string;
    endDate: string;
  }
) {
  const store = await getStore();
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("找不到專案");

  const sprint: Sprint = {
    id: newId("sprint"),
    projectId,
    name: input.name,
    goal: input.goal,
    status: input.status ?? "planning",
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: now(),
  };

  store.sprints.unshift(sprint);
  project.updatedAt = now();
  await saveStore(store);
  return sprint;
}

export async function updateSprint(
  projectId: string,
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
  const sprint = store.sprints.find((s) => s.id === sprintId && s.projectId === projectId);
  if (!sprint) throw new Error("找不到 Sprint");

  if (input.name !== undefined) sprint.name = input.name;
  if (input.goal !== undefined) sprint.goal = input.goal;
  if (input.status !== undefined) sprint.status = input.status;
  if (input.startDate !== undefined) sprint.startDate = input.startDate;
  if (input.endDate !== undefined) sprint.endDate = input.endDate;

  const project = store.projects.find((p) => p.id === projectId);
  if (project) project.updatedAt = now();
  await saveStore(store);
  return sprint;
}

export async function deleteSprint(projectId: string, sprintId: string) {
  const store = await getStore();
  const index = store.sprints.findIndex((s) => s.id === sprintId && s.projectId === projectId);
  if (index === -1) throw new Error("找不到 Sprint");

  store.sprints.splice(index, 1);
  for (const task of store.tasks) {
    if (task.sprintId === sprintId) task.sprintId = undefined;
  }

  const project = store.projects.find((p) => p.id === projectId);
  if (project) project.updatedAt = now();
  await saveStore(store);
}

export async function getTasks(projectId: string) {
  const store = await getStore();
  return store.tasks
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function createTask(
  projectId: string,
  input: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    sprintId?: string;
    assigneeId?: string;
    dueDate?: string;
  }
) {
  const store = await getStore();
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("找不到專案");

  const assignee = input.assigneeId
    ? store.employees.find((e) => e.id === input.assigneeId)
    : undefined;

  if (input.sprintId) {
    const sprint = store.sprints.find((s) => s.id === input.sprintId);
    if (!sprint) throw new Error("找不到 Sprint");
  }

  const timestamp = now();
  const task: Task = {
    id: newId("task"),
    projectId,
    sprintId: input.sprintId,
    title: input.title,
    description: input.description,
    status: input.status ?? "backlog",
    priority: input.priority ?? "medium",
    assigneeId: assignee?.id,
    assigneeName: assignee?.name,
    dueDate: input.dueDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.tasks.unshift(task);
  project.updatedAt = now();
  await saveStore(store);
  return task;
}

export async function updateTask(
  projectId: string,
  taskId: string,
  input: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    sprintId: string | null;
    assigneeId: string | null;
    dueDate: string | null;
  }>,
  options?: { assigneeOnly?: boolean }
) {
  const store = await getStore();
  const task = store.tasks.find((t) => t.id === taskId && t.projectId === projectId);
  if (!task) throw new Error("找不到任務");

  if (options?.assigneeOnly) {
    if (input.status !== undefined) task.status = input.status;
  } else {
    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined) task.description = input.description;
    if (input.status !== undefined) task.status = input.status;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.dueDate !== undefined) task.dueDate = input.dueDate ?? undefined;

    if (input.sprintId !== undefined) {
      if (input.sprintId === null) {
        task.sprintId = undefined;
      } else {
        const sprint = store.sprints.find((s) => s.id === input.sprintId);
        if (!sprint) throw new Error("找不到 Sprint");
        task.sprintId = input.sprintId;
      }
    }

    if (input.assigneeId !== undefined) {
      if (input.assigneeId === null) {
        task.assigneeId = undefined;
        task.assigneeName = undefined;
      } else {
        const assignee = store.employees.find((e) => e.id === input.assigneeId);
        task.assigneeId = assignee?.id;
        task.assigneeName = assignee?.name;
      }
    }
  }

  task.updatedAt = now();
  const project = store.projects.find((p) => p.id === projectId);
  if (project) project.updatedAt = now();
  await saveStore(store);
  return task;
}

export async function deleteTask(projectId: string, taskId: string) {
  const store = await getStore();
  const index = store.tasks.findIndex((t) => t.id === taskId && t.projectId === projectId);
  if (index === -1) throw new Error("找不到任務");

  store.tasks.splice(index, 1);
  const project = store.projects.find((p) => p.id === projectId);
  if (project) project.updatedAt = now();
  await saveStore(store);
}

export async function getProjectDetail(id: string, session: SessionUser) {
  const project = await getProjectById(id, session);
  if (!project) return null;

  const store = await getStore();
  const tasks = store.tasks
    .filter((t) => t.projectId === id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const summary = buildProjectSummary(id, store.sprints, store.tasks);
  return {
    project,
    tasks,
    summary,
    companySprint: summary.activeSprint ?? null,
  };
}
