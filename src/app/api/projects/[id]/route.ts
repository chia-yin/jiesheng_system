import { NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { deleteProject, getProjectDetail, updateProject } from "@/lib/projects";
import type { ProjectStatus } from "@/types/system";

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
    const detail = await getProjectDetail(id, session);
    if (!detail) {
      return NextResponse.json({ error: "找不到專案" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();

    const project = await updateProject(id, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      paths:
        body.paths !== undefined
          ? body.paths === null
            ? null
            : Array.isArray(body.paths)
              ? body.paths
              : null
          : undefined,
      status: body.status as ProjectStatus | undefined,
      managerId:
        body.managerId !== undefined
          ? body.managerId === null || body.managerId === ""
            ? null
            : String(body.managerId)
          : undefined,
      memberIds: Array.isArray(body.memberIds)
        ? body.memberIds.map((mid: unknown) => String(mid))
        : undefined,
      startDate:
        body.startDate !== undefined
          ? body.startDate === null || body.startDate === ""
            ? null
            : String(body.startDate)
          : undefined,
      endDate:
        body.endDate !== undefined
          ? body.endDate === null || body.endDate === ""
            ? null
            : String(body.endDate)
          : undefined,
    });

    return NextResponse.json({ project });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
