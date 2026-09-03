import { NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth";
import {
  createCompanySprint,
  getActiveCompanySprint,
  getSprintBoard,
  listCompanySprints,
} from "@/lib/sprints";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "current") {
      const sprint = await getActiveCompanySprint();
      if (!sprint) return NextResponse.json({ sprint: null, board: null });
      const board = await getSprintBoard(sprint.id);
      return NextResponse.json({ sprint, board });
    }

    const sprints = await listCompanySprints();
    return NextResponse.json({ sprints });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取失敗";
    const status = message === "未登入" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const sprint = await createCompanySprint({
      name: body.name ? String(body.name) : undefined,
      goal: body.goal ? String(body.goal) : undefined,
      status: body.status,
      startDate: body.startDate ? String(body.startDate) : undefined,
      endDate: body.endDate ? String(body.endDate) : undefined,
    });
    return NextResponse.json({ sprint }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "建立失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
