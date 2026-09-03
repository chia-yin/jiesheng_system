import { promises as fs } from "fs";
import path from "path";
import type { AttendanceRecord, Employee } from "@/types/attendance";
import type {
  Announcement,
  CalendarEvent,
  LeaveRequest,
  Project,
  Sprint,
  SystemStore,
  Task,
  WorkSettings,
} from "@/types/system";
import { DEMO_PROJECTS, DEMO_SPRINTS, DEMO_TASKS } from "@/lib/demo-projects";

export const DATA_DIR = path.join(process.cwd(), "data");
export const DATA_FILE = path.join(DATA_DIR, "system.json");

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  startTime: "09:00",
  endTime: "18:00",
  breakMinutes: 60,
  flexBeforeMinutes: 60,
  flexAfterMinutes: 60,
};

export const DEFAULT_STORE: SystemStore = {
  employees: [
    {
      id: "admin-001",
      name: "系統管理員",
      department: "管理部",
      role: "admin",
      username: "admin",
      password: "admin123",
    },
    {
      id: "emp-001",
      name: "王小明",
      department: "業務部",
      role: "employee",
      username: "employee1",
      password: "emp123",
    },
    {
      id: "emp-002",
      name: "李小華",
      department: "行政部",
      role: "employee",
      username: "employee2",
      password: "emp123",
    },
    {
      id: "emp-003",
      name: "張大同",
      department: "技術部",
      role: "employee",
      username: "employee3",
      password: "emp123",
    },
  ],
  records: [],
  leaves: [],
  announcements: [
    {
      id: "ann-001",
      title: "歡迎使用杰勝科技管理系統",
      content: "本系統整合考勤、請假、公告與專案管理，請同仁善用各項功能。",
      author: "行政部",
      pinned: true,
      createdAt: new Date().toISOString(),
    },
  ],
  projects: [...DEMO_PROJECTS],
  sprints: [...DEMO_SPRINTS],
  tasks: [...DEMO_TASKS],
  calendarEvents: [],
  workSettings: DEFAULT_WORK_SETTINGS,
};

const REQUIRED_ACCOUNTS: Pick<
  Employee,
  "id" | "name" | "department" | "role" | "username" | "password"
>[] = [
  {
    id: "admin-001",
    name: "系統管理員",
    department: "管理部",
    role: "admin",
    username: "admin",
    password: "admin123",
  },
  {
    id: "emp-001",
    name: "王小明",
    department: "業務部",
    role: "employee",
    username: "employee1",
    password: "emp123",
  },
];

function isLegacyAuth(emp: Employee): boolean {
  return (
    !emp.username ||
    !emp.password ||
    emp.username === emp.id ||
    emp.password === "changeme"
  );
}

export function migrateEmployees(employees: Partial<Employee>[]): Employee[] {
  return employees.map((emp) => ({
    id: emp.id!,
    name: emp.name ?? "未命名",
    department: emp.department ?? "",
    role: emp.role ?? "employee",
    username: emp.username ?? "",
    password: emp.password ?? "",
    lineUserId: emp.lineUserId,
    supabaseUserId: emp.supabaseUserId,
    lineBindCode: emp.lineBindCode,
    lineBindExpiresAt: emp.lineBindExpiresAt,
    email: emp.email,
    googleId: emp.googleId,
  }));
}

export function ensureDefaultAccounts(store: SystemStore): { store: SystemStore; changed: boolean } {
  let changed = false;

  for (const defaults of REQUIRED_ACCOUNTS) {
    const byUsername = store.employees.find((e) => e.username === defaults.username);
    const byId = store.employees.find((e) => e.id === defaults.id);

    if (byUsername) {
      if (!byUsername.role) {
        byUsername.role = defaults.role;
        changed = true;
      }
      if (isLegacyAuth(byUsername)) {
        byUsername.password = defaults.password;
        changed = true;
      }
      continue;
    }

    if (byId && isLegacyAuth(byId)) {
      Object.assign(byId, defaults);
      changed = true;
      continue;
    }

    if (!byId) {
      store.employees.push({ ...defaults });
      changed = true;
    }
  }

  return { store, changed };
}

async function migrateFromLegacy(store: SystemStore): Promise<SystemStore> {
  const legacyFile = path.join(DATA_DIR, "attendance.json");
  try {
    const raw = await fs.readFile(legacyFile, "utf-8");
    const legacy = JSON.parse(raw) as { employees?: Employee[]; records?: AttendanceRecord[] };
    if (legacy.employees?.length) store.employees = migrateEmployees(legacy.employees);
    if (legacy.records?.length) store.records = legacy.records;
  } catch {
    // 無舊檔
  }
  return store;
}

export function normalizeStore(store: SystemStore): SystemStore {
  store.employees = migrateEmployees(store.employees ?? []);
  if (!store.calendarEvents) store.calendarEvents = [];
  if (!store.googleTokens) store.googleTokens = undefined;
  if (!store.integrationSettings) store.integrationSettings = undefined;
  if (!store.sprints) store.sprints = [];
  if (!store.tasks) store.tasks = [];
  store.projects = (store.projects ?? []).map((p) => ({
    ...p,
    updatedAt: p.updatedAt ?? p.createdAt,
  }));
  if (!store.workSettings) {
    store.workSettings = { ...DEFAULT_WORK_SETTINGS };
  } else {
    if (store.workSettings.flexBeforeMinutes == null) store.workSettings.flexBeforeMinutes = 60;
    if (store.workSettings.flexAfterMinutes == null) store.workSettings.flexAfterMinutes = 60;
  }
  return store;
}

export async function getJsonStore(): Promise<SystemStore> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    let store = normalizeStore(JSON.parse(raw) as SystemStore);
    store = normalizeStore(store);
    return store;
  } catch {
    const store = normalizeStore(await migrateFromLegacy({ ...DEFAULT_STORE }));
    const ensured = ensureDefaultAccounts(store);
    await saveJsonStore(ensured.store);
    return ensured.store;
  }
}

export async function saveJsonStore(store: SystemStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export type { LeaveRequest, Announcement, Project, Sprint, Task, CalendarEvent, SystemStore, WorkSettings };
