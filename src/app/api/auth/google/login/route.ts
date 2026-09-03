import { NextResponse } from "next/server";
import {
  buildGoogleLoginUrl,
  getMissingGoogleLoginEnvVars,
  isGoogleLoginConfigured,
} from "@/lib/google-auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const from = searchParams.get("from") || "/";

  if (!isGoogleLoginConfigured()) {
    const missing = getMissingGoogleLoginEnvVars().join("、");
    return NextResponse.redirect(
      new URL(
        `/login?google_error=${encodeURIComponent(`Google 登入尚未設定（Netlify 缺少：${missing}）`)}`,
        origin
      )
    );
  }

  try {
    const url = buildGoogleLoginUrl(from, request.url);
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法開始 Google 登入";
    return NextResponse.redirect(
      new URL(`/login?google_error=${encodeURIComponent(message)}`, origin)
    );
  }
}
