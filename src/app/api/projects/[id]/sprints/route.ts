import { NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { createSprint, getProjectById, getSprints } from "@/lib/projects";
import type { SprintStatus } from "@/types/system";

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

    const sprints = await getSprints(id);
    return NextResponse.json({ sprints });
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const goal = body.goal ? String(body.goal).trim() : undefined;
    const status = body.status as SprintStatus | undefined;
    const startDate = String(body.startDate ?? "");
    const endDate = String(body.endDate ?? "");

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: "請填寫 Sprint 名稱與日期" }, { status: 400 });
    }

    const sprint = await createSprint(id, { name, goal, status, startDate, endDate });
    return NextResponse.json({ sprint }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}
