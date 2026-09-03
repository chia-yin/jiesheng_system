import { NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth";
import {
  attachTasksToSprint,
  detachTaskFromSprint,
  listAssignableTasks,
  updateSprintTaskStatus,
} from "@/lib/sprints";
import type { TaskStatus } from "@/types/system";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    await requireAuth();
    await context.params;
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    const tasks = await listAssignableTasks(projectId || undefined);
    return NextResponse.json({ tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取失敗";
    const status = message === "未登入" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const taskIds = Array.isArray(body.taskIds) ? body.taskIds.map(String) : [];
    if (!taskIds.length) {
      return NextResponse.json({ error: "請勾選至少一項任務" }, { status: 400 });
    }
    const result = await attachTasksToSprint(id, taskIds);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "加入失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const session = await requireAuth();
    await context.params;
    const body = await request.json();
    const taskId = String(body.taskId ?? "");
    const status = body.status as TaskStatus;
    if (!taskId || !status) {
      return NextResponse.json({ error: "缺少 taskId 或 status" }, { status: 400 });
    }
    const task = await updateSprintTaskStatus(taskId, status, session);
    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失敗";
    const status =
      message === "未登入" ? 401 : message.includes("無權限") ? 403 : message.includes("找不到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
    await detachTaskFromSprint(id, taskId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "移除失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
