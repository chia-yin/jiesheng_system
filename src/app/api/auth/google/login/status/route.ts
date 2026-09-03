import { NextResponse } from "next/server";
import { isGoogleLoginConfigured } from "@/lib/google-auth";

export async function GET() {
  return NextResponse.json({ enabled: isGoogleLoginConfigured() });
}
