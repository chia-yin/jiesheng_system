import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { getActiveCompanySprint } from "@/lib/sprints";
import type { TaskPriority, TaskStatus } from "@/types/system";

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_ORDER: Record<TaskStatus, number> = {
  in_progress: 0,
  review: 1,
  todo: 2,
  backlog: 3,
  done: 4,
};

/** 全公司未完成任務總覽（需登入） */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const store = await getStore();
    const activeSprint = await getActiveCompanySprint();
    const activeSprintId = activeSprint?.id;
    const projectMap = new Map(store.projects.map((p) => [p.id, p.name]));

    const tasks = store.tasks
      .filter((t) => t.status !== "done")
      .map((t) => ({
        ...t,
        projectName: projectMap.get(t.projectId) ?? "未知專案",
        inActiveSprint: Boolean(activeSprintId && t.sprintId === activeSprintId),
      }))
      .sort((a, b) => {
        if (a.inActiveSprint !== b.inActiveSprint) return a.inActiveSprint ? -1 : 1;
        const pa = PRIORITY_ORDER[a.priority] ?? 9;
        const pb = PRIORITY_ORDER[b.priority] ?? 9;
        if (pa !== pb) return pa - pb;
        const da = a.dueDate ?? "9999-99-99";
        const db = b.dueDate ?? "9999-99-99";
        if (da !== db) return da.localeCompare(db);
        const sa = STATUS_ORDER[a.status] ?? 9;
        const sb = STATUS_ORDER[b.status] ?? 9;
        if (sa !== sb) return sa - sb;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

    const projects = store.projects
      .map((p) => ({ id: p.id, name: p.name, status: p.status }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-TW"));

    const assignees = store.employees
      .map((e) => ({ id: e.id, name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-TW"));

    return NextResponse.json({
      tasks,
      projects,
      assignees,
      activeSprint: activeSprint
        ? {
            id: activeSprint.id,
            name: activeSprint.name,
            startDate: activeSprint.startDate,
            endDate: activeSprint.endDate,
          }
        : null,
      session: {
        employeeId: session.employeeId,
        role: session.role,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
