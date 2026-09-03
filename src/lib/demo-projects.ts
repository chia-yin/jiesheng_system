import type { Project, Sprint, Task } from "@/types/system";

const T = "2026-09-02T00:00:00.000Z";

export const DEMO_PROJECTS: Project[] = [
  {
    id: "proj-001",
    name: "官網改版專案",
    description: "更新公司官網設計、內容與 SEO，提升品牌形象與詢問轉換。",
    paths: [
      { label: "前端", url: "https://gitlab.com/jiesheng/website-frontend" },
      { label: "API", url: "https://gitlab.com/jiesheng/website-api" },
      { label: "GitLab", url: "https://gitlab.com/jiesheng/website-revamp" },
    ],
    status: "active",
    managerId: "emp-003",
    managerName: "張大同",
    memberIds: ["emp-001", "emp-002", "emp-003"],
    startDate: "2026-08-01",
    endDate: "2026-10-31",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "proj-002",
    name: "考勤系統導入",
    description: "導入杰勝內部考勤、請假與行事曆整合，取代 Excel 登記。",
    paths: [
      { label: "前端", url: "/Users/ocean/Jie_Sheng/jiesheng_system" },
      { label: "API", url: "/Users/ocean/Jie_Sheng/jiesheng_system/src/app/api" },
      { label: "GitLab", url: "https://gitlab.com/jiesheng/jiesheng_system" },
    ],
    status: "active",
    managerId: "admin-001",
    managerName: "系統管理員",
    memberIds: ["admin-001", "emp-002", "emp-003"],
    startDate: "2026-09-01",
    endDate: "2026-11-30",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "proj-003",
    name: "客戶 CRM 模組",
    description: "為業務部建立客戶追蹤、報價與合約提醒功能。",
    paths: [
      { label: "前端", url: "https://gitlab.com/jiesheng/crm-web" },
      { label: "API", url: "https://gitlab.com/jiesheng/crm-api" },
      { label: "GitLab", url: "https://gitlab.com/jiesheng/crm-module" },
    ],
    status: "planning",
    managerId: "emp-001",
    managerName: "王小明",
    memberIds: ["emp-001"],
    startDate: "2026-10-01",
    endDate: "2026-12-31",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "proj-004",
    name: "內部知識庫",
    description: "整理 SOP、技術文件與 onboarding 教材。",
    paths: [
      { label: "文件", url: "https://wiki.jiesheng.local/kb" },
      { label: "GitLab", url: "https://gitlab.com/jiesheng/internal-kb" },
    ],
    status: "completed",
    managerId: "emp-002",
    managerName: "李小華",
    memberIds: ["emp-002", "emp-003"],
    startDate: "2026-05-01",
    endDate: "2026-07-31",
    createdAt: T,
    updatedAt: T,
  },
];

export const DEMO_SPRINTS: Sprint[] = [
  {
    id: "sprint-001",
    projectId: "proj-001",
    name: "Sprint 1 · 設計定稿",
    goal: "完成首頁與產品頁視覺定稿",
    status: "completed",
    startDate: "2026-08-01",
    endDate: "2026-08-14",
    createdAt: T,
  },
  {
    id: "sprint-002",
    projectId: "proj-001",
    name: "Sprint 2 · 開發上線",
    goal: "RWD 開發與 UAT",
    status: "active",
    startDate: "2026-08-15",
    endDate: "2026-09-15",
    createdAt: T,
  },
  {
    id: "sprint-003",
    projectId: "proj-002",
    name: "Sprint 1 · MVP",
    goal: "打卡、請假、公告基本功能",
    status: "active",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    createdAt: T,
  },
  {
    id: "sprint-004",
    projectId: "proj-002",
    name: "Sprint 2 · 整合",
    goal: "Google 日曆、LINE 通知",
    status: "planning",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    createdAt: T,
  },
];

export const DEMO_TASKS: Task[] = [
  // 官網改版
  {
    id: "task-001",
    projectId: "proj-001",
    sprintId: "sprint-001",
    title: "首頁 wireframe 定稿",
    status: "done",
    priority: "high",
    assigneeId: "emp-003",
    assigneeName: "張大同",
    dueDate: "2026-08-05",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "task-002",
    projectId: "proj-001",
    sprintId: "sprint-002",
    title: "RWD 切版（首頁）",
    status: "in_progress",
    priority: "urgent",
    assigneeId: "emp-003",
    assigneeName: "張大同",
    dueDate: "2026-09-05",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "task-003",
    projectId: "proj-001",
    sprintId: "sprint-002",
    title: "撰寫產品文案",
    status: "review",
    priority: "medium",
    assigneeId: "emp-001",
    assigneeName: "王小明",
    dueDate: "2026-09-08",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "task-004",
    projectId: "proj-001",
    title: "SEO 關鍵字研究",
    status: "backlog",
    priority: "low",
    assigneeId: "emp-001",
    assigneeName: "王小明",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "task-005",
    projectId: "proj-001",
    sprintId: "sprint-002",
    title: "UAT 測試與修正",
    status: "todo",
    priority: "high",
    assigneeId: "emp-002",
    assigneeName: "李小華",
    dueDate: "2026-09-12",
    createdAt: T,
    updatedAt: T,
  },
  // 考勤系統
  {
    id: "task-006",
    projectId: "proj-002",
    sprintId: "sprint-003",
    title: "彈性打卡規則設定",
    status: "done",
    priority: "high",
    assigneeId: "admin-001",
    assigneeName: "系統管理員",
    dueDate: "2026-09-05",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "task-007",
    projectId: "proj-002",
    sprintId: "sprint-003",
    title: "請假審核流程",
    status: "in_progress",
    priority: "urgent",
    assigneeId: "emp-002",
    assigneeName: "李小華",
    dueDate: "2026-09-10",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "task-008",
    projectId: "proj-002",
    sprintId: "sprint-003",
    title: "員工教育訓練簡報",
    status: "todo",
    priority: "medium",
    assigneeId: "emp-002",
    assigneeName: "李小華",
    dueDate: "2026-09-20",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "task-009",
    projectId: "proj-002",
    sprintId: "sprint-004",
    title: "Google 日曆 OAuth 串接",
    status: "backlog",
    priority: "high",
    assigneeId: "emp-003",
    assigneeName: "張大同",
    createdAt: T,
    updatedAt: T,
  },
  // CRM 規劃
  {
    id: "task-010",
    projectId: "proj-003",
    title: "需求訪談業務部",
    status: "todo",
    priority: "medium",
    assigneeId: "emp-001",
    assigneeName: "王小明",
    dueDate: "2026-10-05",
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "task-011",
    projectId: "proj-003",
    title: "競品分析報告",
    status: "backlog",
    priority: "low",
    createdAt: T,
    updatedAt: T,
  },
  // 知識庫（已完成專案）
  {
    id: "task-012",
    projectId: "proj-004",
    title: "Onboarding 文件整理",
    status: "done",
    priority: "medium",
    assigneeId: "emp-002",
    assigneeName: "李小華",
    createdAt: T,
    updatedAt: T,
  },
];

/** 若缺少示範專案 proj-002，補齊整套假資料；遷移舊 path → paths */
export function ensureDemoProjects(store: {
  projects: Array<Project & { path?: string }>;
  sprints: Sprint[];
  tasks: Task[];
}): boolean {
  let changed = false;

  if (!store.projects.some((p) => p.id === "proj-002")) {
    const existingIds = new Set(store.projects.map((p) => p.id));
    for (const p of DEMO_PROJECTS) {
      if (!existingIds.has(p.id)) store.projects.push(p);
    }

    const sprintIds = new Set(store.sprints.map((s) => s.id));
    for (const s of DEMO_SPRINTS) {
      if (!sprintIds.has(s.id)) store.sprints.push(s);
    }

    const taskIds = new Set(store.tasks.map((t) => t.id));
    for (const t of DEMO_TASKS) {
      if (!taskIds.has(t.id)) store.tasks.push(t);
    }
    changed = true;
  }

  const demoPathsById = new Map(DEMO_PROJECTS.map((p) => [p.id, p.paths]));
  for (const project of store.projects) {
    const legacy = project.path?.trim();
    if (legacy && !project.paths?.length) {
      project.paths = [{ label: "路徑", url: legacy }];
      delete project.path;
      changed = true;
    } else if (project.path) {
      delete project.path;
      changed = true;
    }

    const demoPaths = demoPathsById.get(project.id);
    if (demoPaths?.length && !project.paths?.length) {
      project.paths = demoPaths;
      changed = true;
    }
  }

  return changed;
}
