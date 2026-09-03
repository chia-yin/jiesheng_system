import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGoogleTokens, isGoogleConnected, isGoogleOAuthConfigured } from "@/lib/google-calendar";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const configured = isGoogleOAuthConfigured();
  const connected = configured ? await isGoogleConnected() : false;
  const tokens = connected ? await getGoogleTokens() : null;

  return NextResponse.json({
    configured,
    connected,
    connectedAt: tokens?.connectedAt ?? null,
    isAdmin: session.role === "admin",
  });
}
