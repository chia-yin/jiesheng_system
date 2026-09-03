import { NextResponse } from "next/server";
import { attachSessionToResponse } from "@/lib/auth";
import {
  exchangeGoogleLoginCode,
  isGoogleLoginConfigured,
  loginWithGoogleProfile,
  parseGoogleLoginState,
} from "@/lib/google-auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");
  const { from } = parseGoogleLoginState(state);

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?google_error=${encodeURIComponent(reason)}`, origin));

  if (!isGoogleLoginConfigured()) {
    return fail("Google 登入尚未設定");
  }

  if (error || !code) {
    return fail("已取消 Google 登入");
  }

  try {
    const profile = await exchangeGoogleLoginCode(code, request.url);
    const session = await loginWithGoogleProfile(profile);
    const target = from.startsWith("/") ? from : "/";
    const response = NextResponse.redirect(new URL(target, origin));
    return attachSessionToResponse(response, session);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google 登入失敗";
    return fail(message);
  }
}
