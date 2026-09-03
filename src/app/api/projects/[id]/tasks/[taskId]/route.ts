import { NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { canEditTask, deleteTask, getTasks, updateTask } from "@/lib/projects";
import type { TaskPriority, TaskStatus } from "@/types/system";

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "操作失敗";
  const status =
    message === "未登入"
      ? 401
      : message === "需要管理員權限"
        ? 403
        : message === "找不到任務"
          ? 404
          : 400;
  return NextResponse.json({ error: message }, { status });
}

type RouteContext = { params: Promise<{ id: string; taskId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { id, taskId } = await context.params;
    const tasks = await getTasks(id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "找不到任務" }, { status: 404 });
    }

    const isAdmin = session.role === "admin";
    const isAssignee = canEditTask(task, session);
    if (!isAdmin && !isAssignee) {
      return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
    }

    const body = await request.json();

    if (!isAdmin) {
      const status = body.status as TaskStatus | undefined;
      if (!status) {
        return NextResponse.json({ error: "僅可更新任務狀態" }, { status: 400 });
      }
      const updated = await updateTask(id, taskId, { status }, { assigneeOnly: true });
      return NextResponse.json({ task: updated });
    }

    const updated = await updateTask(id, taskId, {
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      status: body.status as TaskStatus | undefined,
      priority: body.priority as TaskPriority | undefined,
      sprintId: body.sprintId === null ? null : body.sprintId ? String(body.sprintId) : undefined,
      assigneeId:
        body.assigneeId === null ? null : body.assigneeId ? String(body.assigneeId) : undefined,
      dueDate: body.dueDate === null ? null : body.dueDate ? String(body.dueDate) : undefined,
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { id, taskId } = await context.params;
    const tasks = await getTasks(id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "找不到任務" }, { status: 404 });
    }

    if (session.role !== "admin" && !canEditTask(task, session)) {
      return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
    }

    await deleteTask(id, taskId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
