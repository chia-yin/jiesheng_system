import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteSprint, updateSprint } from "@/lib/projects";
import type { SprintStatus } from "@/types/system";

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "操作失敗";
  const status =
    message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : message === "找不到 Sprint" ? 404 : 400;
  return NextResponse.json({ error: message }, { status });
}

type RouteContext = { params: Promise<{ id: string; sprintId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id, sprintId } = await context.params;
    const body = await request.json();

    const sprint = await updateSprint(id, sprintId, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      goal: body.goal !== undefined ? String(body.goal).trim() : undefined,
      status: body.status as SprintStatus | undefined,
      startDate: body.startDate !== undefined ? String(body.startDate) : undefined,
      endDate: body.endDate !== undefined ? String(body.endDate) : undefined,
    });

    return NextResponse.json({ sprint });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id, sprintId } = await context.params;
    await deleteSprint(id, sprintId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
