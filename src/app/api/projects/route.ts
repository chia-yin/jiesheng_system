import { NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { createProject, getProjects } from "@/lib/projects";
import type { ProjectStatus } from "@/types/system";

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "權限不足";
  const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const projects = await getProjects(session);
    return NextResponse.json({ projects });
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = body.description ? String(body.description).trim() : undefined;
    const status = body.status as ProjectStatus | undefined;
    const paths = Array.isArray(body.paths) ? body.paths : undefined;
    const managerId = body.managerId ? String(body.managerId) : undefined;
    const memberIds = Array.isArray(body.memberIds)
      ? body.memberIds.map((id: unknown) => String(id))
      : undefined;
    const startDate = body.startDate ? String(body.startDate) : undefined;
    const endDate = body.endDate ? String(body.endDate) : undefined;

    if (!name) {
      return NextResponse.json({ error: "請填寫專案名稱" }, { status: 400 });
    }

    const project = await createProject({
      name,
      description,
      paths,
      status,
      managerId,
      memberIds,
      startDate,
      endDate,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}
