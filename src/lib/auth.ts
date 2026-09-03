import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import type { Employee } from "@/types/attendance";
import type { SessionUser } from "@/types/auth";
import { getStore } from "@/lib/db";
import { isSupabaseAuthEnabled, verifySupabasePassword } from "@/lib/supabase-auth";
import { SESSION_COOKIE, encodeSession, getSessionFromToken } from "@/lib/session";

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

/** OAuth redirect 等情境需直接寫入 Response，cookies() 可能不會帶上 */
export function attachSessionToResponse(response: NextResponse, user: SessionUser): NextResponse {
  response.cookies.set(SESSION_COOKIE, encodeSession(user), getSessionCookieOptions());
  return response;
}

export async function login(username: string, password: string): Promise<SessionUser | null> {
  if (isSupabaseAuthEnabled()) {
    const employee = await verifySupabasePassword(username, password);
    if (employee) return employeeToSession(employee);
  }

  const store = await getStore();
  const employee = store.employees.find(
    (e) => e.username === username && e.password === password
  );
  if (!employee) return null;

  return employeeToSession(employee);
}

function employeeToSession(employee: Employee): SessionUser {
  return {
    id: employee.id,
    username: employee.username,
    name: employee.name,
    role: employee.role,
    employeeId: employee.id,
    department: employee.department,
  };
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(user), getSessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return getSessionFromToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export function getSessionFromRequest(request: NextRequest): SessionUser | null {
  return getSessionFromToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export function toPublicEmployee(employee: Employee) {
  const { password, lineBindCode, lineBindExpiresAt, ...rest } = employee;
  return rest;
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("未登入");
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== "admin") throw new Error("需要管理員權限");
  return session;
}

export { SESSION_COOKIE };
