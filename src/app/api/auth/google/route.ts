import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/google-calendar";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "未授權";
    const status = message === "未登入" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "請管理員設定 Google OAuth 憑證",
        hint: "請參考 .env.example 設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_REDIRECT_URI",
      },
      { status: 501 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
