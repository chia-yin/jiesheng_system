import { NextResponse } from "next/server";
import type { UserRole } from "@/types/attendance";
import { requireAdmin } from "@/lib/auth";
import { createEmployee, deleteEmployee, listEmployees, updateEmployee } from "@/lib/employees";

function apiError(error: unknown, fallback: string) {
  const message =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : fallback;
  const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await requireAdmin();
    const employees = await listEmployees();
    return NextResponse.json({ employees });
  } catch (error) {
    return apiError(error, "權限不足");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const employee = await createEmployee({
      name: String(body.name ?? ""),
      department: String(body.department ?? ""),
      role: (body.role as UserRole) ?? "employee",
      username: String(body.username ?? ""),
      password: String(body.password ?? ""),
      email: body.email ? String(body.email).trim() : undefined,
    });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    return apiError(error, "新增失敗");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

    const patch: Parameters<typeof updateEmployee>[1] = {};
    if (body.name !== undefined) patch.name = String(body.name);
    if (body.department !== undefined) patch.department = String(body.department);
    if (body.role !== undefined) patch.role = body.role as UserRole;
    if (body.username !== undefined) patch.username = String(body.username);
    if (body.password) patch.password = String(body.password);
    if (body.email !== undefined) patch.email = String(body.email).trim();

    const employee = await updateEmployee(id, patch);
    return NextResponse.json({ employee });
  } catch (error) {
    return apiError(error, "更新失敗");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    await deleteEmployee(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "刪除失敗");
  }
}
