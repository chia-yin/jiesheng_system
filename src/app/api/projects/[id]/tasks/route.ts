import { NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { createTask, getProjectById, getTasks } from "@/lib/projects";
import type { TaskPriority, TaskStatus } from "@/types/system";

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "操作失敗";
  const status =
    message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : message === "找不到專案" ? 404 : 400;
  return NextResponse.json({ error: message }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { id } = await context.params;
    const project = await getProjectById(id, session);
    if (!project) {
      return NextResponse.json({ error: "找不到專案" }, { status: 404 });
    }

    const tasks = await getTasks(id);
    return NextResponse.json({ tasks });
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();

    const title = String(body.title ?? "").trim();
    const description = body.description ? String(body.description).trim() : undefined;
    const status = body.status as TaskStatus | undefined;
    const priority = body.priority as TaskPriority | undefined;
    const sprintId = body.sprintId ? String(body.sprintId) : undefined;
    const assigneeId = body.assigneeId ? String(body.assigneeId) : undefined;
    const dueDate = body.dueDate ? String(body.dueDate) : undefined;

    if (!title) {
      return NextResponse.json({ error: "請填寫任務標題" }, { status: 400 });
    }

    const task = await createTask(id, {
      title,
      description,
      status,
      priority,
      sprintId,
      assigneeId,
      dueDate,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}
