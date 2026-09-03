import { generateIcsContent } from "@/lib/calendar";

export async function GET() {
  const content = await generateIcsContent();

  return new Response(content, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="jiesheng-calendar.ics"',
      "Cache-Control": "no-cache",
    },
  });
}
