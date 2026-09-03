import { NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { deleteCompanySprint, getSprintBoard, updateCompanySprint } from "@/lib/sprints";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    await requireAuth();
    const { id } = await context.params;
    const board = await getSprintBoard(id);
    if (!board) return NextResponse.json({ error: "找不到 Sprint" }, { status: 404 });
    return NextResponse.json(board);
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取失敗";
    const status = message === "未登入" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const sprint = await updateCompanySprint(id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      goal: body.goal !== undefined ? String(body.goal) : undefined,
      status: body.status,
      startDate: body.startDate !== undefined ? String(body.startDate) : undefined,
      endDate: body.endDate !== undefined ? String(body.endDate) : undefined,
    });
    return NextResponse.json({ sprint });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失敗";
    const status =
      message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : message.includes("找不到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    await deleteCompanySprint(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "刪除失敗";
    const status =
      message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : message.includes("找不到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
