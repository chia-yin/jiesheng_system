import { getTodaySummary } from "@/lib/attendance";
import { getAnnouncements } from "@/lib/announcements";
import { getLeaves } from "@/lib/leaves";
import { getProjects } from "@/lib/projects";
import { getActiveCompanySprint, getSprintBoard } from "@/lib/sprints";
import { getEmployeeAttendanceSummary } from "@/lib/worktime";
import { getStore } from "@/lib/db";
import type { SessionUser } from "@/types/auth";
import type {
  Announcement,
  LeaveRequest,
  Project,
  ProjectSummary,
  Task,
  TaskPriority,
} from "@/types/system";

export type DashboardProject = Project & { summary: ProjectSummary };
export type DashboardTask = Task & { projectName: string };

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface DashboardData {
  user: SessionUser;
  date: string;
  kpis: {
    activeProjects: number;
    myTasks: number;
    pendingLeaves: number;
    clock: {
      title: string;
      value: string;
      hint?: string;
    };
  };
  activeProjects: DashboardProject[];
  myTasks: DashboardTask[];
  currentSprint: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    goal?: string;
    done: number;
    total: number;
    open: number;
    myOpen: number;
    myTasks: Array<{
      id: string;
      title: string;
      projectId: string;
      projectName: string;
      status: Task["status"];
      priority: TaskPriority;
    }>;
    byProject: Array<{
      projectId: string;
      projectName: string;
      done: number;
      total: number;
    }>;
  } | null;
  announcements: Announcement[];
  recentLeaves: LeaveRequest[];
  pendingLeaves: LeaveRequest[];
}

export async function getDashboardData(session: SessionUser): Promise<DashboardData> {
  const [todaySummary, allLeaves, announcements, projects, attendance, store] = await Promise.all([
    getTodaySummary(),
    getLeaves(),
    getAnnouncements(),
    getProjects(session),
    getEmployeeAttendanceSummary(session.employeeId),
    getStore(),
  ]);

  const leaves =
    session.role === "admin"
      ? allLeaves
      : allLeaves.filter((l) => l.employeeId === session.employeeId);

  const pendingLeaves = allLeaves.filter((l) => l.status === "pending");
  const activeProjects = projects
    .filter((p) => p.status === "active")
    .slice(0, 3) as DashboardProject[];

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const myTasks: DashboardTask[] = store.tasks
    .filter((t) => t.assigneeId === session.employeeId && t.status !== "done")
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 5)
    .map((task) => ({
      ...task,
      projectName: projectMap.get(task.projectId) ?? "未知專案",
    }));

  const myTaskCount = store.tasks.filter(
    (t) => t.assigneeId === session.employeeId && t.status !== "done"
  ).length;

  const activeProjectCount = projects.filter((p) => p.status === "active").length;

  const clockKpi =
    session.role === "admin"
      ? {
          title: "今日出勤",
          value: `${todaySummary.clockedInCount} / ${todaySummary.totalEmployees}`,
          hint: todaySummary.lateCount > 0 ? `${todaySummary.lateCount} 人遲到` : "全員正常",
        }
      : attendance.today.status === "not_started"
        ? { title: "今日打卡", value: "未打卡", hint: "尚未上班打卡" }
        : attendance.today.status === "working"
          ? { title: "今日打卡", value: "工作中", hint: "已上班打卡" }
          : { title: "今日打卡", value: "已下班", hint: "今日打卡完成" };

  const recentLeaves = leaves
    .filter((l) => l.status === "pending" || l.status === "approved")
    .slice(0, 3);

  const topAnnouncements = announcements.slice(0, 3);

  const activeSprint = await getActiveCompanySprint();
  let currentSprint: DashboardData["currentSprint"] = null;
  if (activeSprint) {
    const board = await getSprintBoard(activeSprint.id);
    if (board) {
      const myTasks = board.tasks
        .filter((t) => t.assigneeId === session.employeeId && t.status !== "done")
        .slice(0, 5)
        .map((t) => ({
          id: t.id,
          title: t.title,
          projectId: t.projectId,
          projectName: t.projectName,
          status: t.status,
          priority: t.priority,
        }));

      const projectBuckets = new Map<
        string,
        { projectId: string; projectName: string; done: number; total: number }
      >();
      for (const t of board.tasks) {
        const bucket = projectBuckets.get(t.projectId) ?? {
          projectId: t.projectId,
          projectName: t.projectName,
          done: 0,
          total: 0,
        };
        bucket.total += 1;
        if (t.status === "done") bucket.done += 1;
        projectBuckets.set(t.projectId, bucket);
      }

      currentSprint = {
        id: board.sprint.id,
        name: board.sprint.name,
        startDate: board.sprint.startDate,
        endDate: board.sprint.endDate,
        goal: board.sprint.goal,
        done: board.done,
        total: board.total,
        open: board.total - board.done,
        myOpen: board.tasks.filter(
          (t) => t.assigneeId === session.employeeId && t.status !== "done"
        ).length,
        myTasks,
        byProject: Array.from(projectBuckets.values()).sort((a, b) => b.total - a.total),
      };
    }
  }

  return {
    user: session,
    date: todaySummary.date,
    kpis: {
      activeProjects: activeProjectCount,
      myTasks: myTaskCount,
      pendingLeaves: pendingLeaves.length,
      clock: clockKpi,
    },
    activeProjects,
    myTasks,
    currentSprint,
    announcements: topAnnouncements,
    recentLeaves,
    pendingLeaves: pendingLeaves.slice(0, 3),
  };
}
