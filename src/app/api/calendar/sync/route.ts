import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isGoogleConnected, isGoogleOAuthConfigured, syncAllApprovedLeaves } from "@/lib/google-calendar";

export async function POST() {
  try {
    await requireAdmin();

    if (!isGoogleOAuthConfigured()) {
      return NextResponse.json(
        { error: "請管理員設定 Google OAuth 憑證" },
        { status: 501 }
      );
    }

    if (!(await isGoogleConnected())) {
      return NextResponse.json({ error: "尚未連結 Google 日曆" }, { status: 400 });
    }

    const result = await syncAllApprovedLeaves();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
