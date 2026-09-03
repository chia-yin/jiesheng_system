import { NextResponse } from "next/server";
import { saveGoogleTokens } from "@/lib/google-calendar";
import { getStore } from "@/lib/db";
import type { GoogleTokens } from "@/types/system";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/calendar?error=oauth_not_configured", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/calendar?error=oauth_denied", request.url));
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/calendar?error=token_exchange_failed", request.url));
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    if (!data.refresh_token) {
      return NextResponse.redirect(new URL("/calendar?error=no_refresh_token", request.url));
    }

    const store = await getStore();
    const calendarId =
      store.integrationSettings?.googleCalendarId ??
      store.googleTokens?.calendarId ??
      "primary";

    const tokens: GoogleTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry: Date.now() + data.expires_in * 1000,
      connectedAt: new Date().toISOString(),
      calendarId,
    };

    await saveGoogleTokens(tokens);

    return NextResponse.redirect(new URL("/calendar?oauth=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/calendar?error=oauth_failed", request.url));
  }
}
