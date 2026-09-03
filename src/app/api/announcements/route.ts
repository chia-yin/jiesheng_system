import { NextResponse } from "next/server";
import { createAnnouncement, getAnnouncements } from "@/lib/announcements";
import { getSession, requireAdmin } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const announcements = await getAnnouncements();
  return NextResponse.json({ announcements });
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const content = String(body.content ?? "").trim();
    const author = session.name;
    const pinned = Boolean(body.pinned);

    if (!title || !content) {
      return NextResponse.json({ error: "請填寫標題與內容" }, { status: 400 });
    }

    const announcement = await createAnnouncement({ title, content, author, pinned });
    return NextResponse.json({ announcement });
  } catch (error) {
    const message = error instanceof Error ? error.message : "發布失敗";
    const status = message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
