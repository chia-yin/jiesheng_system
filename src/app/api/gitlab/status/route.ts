import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { collectAllGitLabStatuses, getGitLabBaseUrl, isGitLabConfigured } from "@/lib/gitlab";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const store = await getStore();
    const repos = await collectAllGitLabStatuses(store.projects);

    return NextResponse.json({
      configured: isGitLabConfigured(),
      baseUrl: getGitLabBaseUrl(),
      repos,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
