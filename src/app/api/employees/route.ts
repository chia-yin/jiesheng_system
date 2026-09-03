import { NextResponse } from "next/server";
import type { UserRole } from "@/types/attendance";
import { requireAdmin } from "@/lib/auth";
import { createEmployee, deleteEmployee, listEmployees, updateEmployee } from "@/lib/employees";

export async function GET() {
  try {
    await requireAdmin();
    const employees = await listEmployees();
    return NextResponse.json({ employees });
  } catch (error) {
    const message = error instanceof Error ? error.message : "權限不足";
    const status = message === "未登入" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
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
    const message = error instanceof Error ? error.message : "新增失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

    const employee = await updateEmployee(id, {
      name: body.name ? String(body.name) : undefined,
      department: body.department ? String(body.department) : undefined,
      role: body.role as UserRole | undefined,
      username: body.username ? String(body.username) : undefined,
      password: body.password ? String(body.password) : undefined,
      email: body.email !== undefined ? String(body.email).trim() : undefined,
    });
    return NextResponse.json({ employee });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
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
    const message = error instanceof Error ? error.message : "刪除失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
