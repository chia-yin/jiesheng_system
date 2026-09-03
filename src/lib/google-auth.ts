import type { Employee } from "@/types/attendance";
import { getStore, newId, saveStore } from "@/lib/db";
import type { SessionUser } from "@/types/auth";

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

/** 僅需 Client ID + Secret；redirect URI 可由請求網域自動推導 */
export function isGoogleLoginConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

/** 回傳未設定的 Google 登入環境變數名稱 */
export function getMissingGoogleLoginEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID?.trim()) missing.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET?.trim()) missing.push("GOOGLE_CLIENT_SECRET");
  return missing;
}

export function resolveGoogleLoginRedirectUri(requestUrl: string): string {
  if (process.env.GOOGLE_LOGIN_REDIRECT_URI?.trim()) {
    return process.env.GOOGLE_LOGIN_REDIRECT_URI.trim();
  }
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/auth/google/login/callback`;
  }
  return `${new URL(requestUrl).origin}/api/auth/google/login/callback`;
}

export function buildGoogleLoginUrl(from: string, requestUrl: string): string {
  const redirectUri = resolveGoogleLoginRedirectUri(requestUrl);
  const state = Buffer.from(JSON.stringify({ from: from || "/" }), "utf-8").toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleLoginCode(code: string, requestUrl: string): Promise<GoogleProfile> {
  const redirectUri = resolveGoogleLoginRedirectUri(requestUrl);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    throw new Error("Google 授權失敗");
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileRes.ok) {
    throw new Error("無法取得 Google 帳號資訊");
  }

  const profile = (await profileRes.json()) as GoogleProfile;
  if (!profile.email) {
    throw new Error("Google 帳號缺少 email");
  }

  return profile;
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

export async function loginWithGoogleProfile(profile: GoogleProfile): Promise<SessionUser> {
  const store = await getStore();
  const email = profile.email.trim().toLowerCase();

  let employee =
    store.employees.find((e) => e.email?.toLowerCase() === email) ??
    store.employees.find((e) => e.googleId === profile.sub);

  if (!employee && store.employees.length === 0) {
    employee = {
      id: newId("admin"),
      name: profile.name || email.split("@")[0],
      department: "管理部",
      role: "admin",
      username: email.split("@")[0],
      password: "",
      email,
      googleId: profile.sub,
    };
    store.employees.push(employee);
    await saveStore(store);
  }

  if (!employee) {
    throw new Error("此 Google 帳號尚未授權，請聯絡管理員在員工管理新增您的 Email");
  }

  const index = store.employees.findIndex((e) => e.id === employee!.id);
  let changed = false;
  if (!store.employees[index].email) {
    store.employees[index].email = email;
    changed = true;
  }
  if (!store.employees[index].googleId) {
    store.employees[index].googleId = profile.sub;
    changed = true;
  }
  if (changed) {
    await saveStore(store);
    employee = store.employees[index];
  }

  const session = employeeToSession(employee);
  return session;
}

export function parseGoogleLoginState(state: string | null): { from: string } {
  if (!state) return { from: "/" };
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf-8")) as { from?: string };
    return { from: parsed.from || "/" };
  } catch {
    return { from: "/" };
  }
}
