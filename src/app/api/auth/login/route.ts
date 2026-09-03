import { NextResponse } from "next/server";
import { clearSessionCookie, login, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json({ error: "請輸入帳號與密碼" }, { status: 400 });
    }

    const user = await login(username, password);
    if (!user) {
      return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
    }

    await setSessionCookie(user);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "登入失敗" }, { status: 500 });
  }
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
