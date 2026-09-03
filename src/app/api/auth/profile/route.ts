import { NextResponse } from "next/server";
import { requireAuth, setSessionCookie } from "@/lib/auth";
import { updateProfile } from "@/lib/employees";
import type { SessionUser } from "@/types/auth";

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const employee = await updateProfile(session.employeeId, {
      username: body.username !== undefined ? String(body.username) : undefined,
      currentPassword: body.currentPassword ? String(body.currentPassword) : undefined,
      newPassword: body.newPassword ? String(body.newPassword) : undefined,
      confirmPassword: body.confirmPassword ? String(body.confirmPassword) : undefined,
    });

    const updatedUser: SessionUser = {
      ...session,
      username: employee.username,
    };
    await setSessionCookie(updatedUser);

    return NextResponse.json({ employee, user: updatedUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失敗";
    const status = message === "未登入" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
