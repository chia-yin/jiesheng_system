import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLeaves } from "@/lib/leaves";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ pendingLeaves: 0, total: 0 });
  }

  const leaves = await getLeaves();
  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;

  return NextResponse.json({ pendingLeaves, total: pendingLeaves });
}
