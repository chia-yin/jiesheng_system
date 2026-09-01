import { NextResponse } from "next/server";
import { getRecords, getTodaySummary } from "@/lib/attendance";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const summary = searchParams.get("summary");

  if (summary === "today") {
    const data = await getTodaySummary(date ?? undefined);
    return NextResponse.json(data);
  }

  const records = await getRecords(date);
  return NextResponse.json({ records });
}
