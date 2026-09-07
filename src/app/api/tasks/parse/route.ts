import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db";
import type { TaskPriority } from "@/types/system";

export type ParsedTaskDraft = {
  projectId: string | null;
  projectName: string | null;
  title: string;
  description?: string;
  assigneeId: string | null;
  assigneeName: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  addToSprint: boolean;
};

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("尚未設定 GEMINI_API_KEY，請至 Netlify 環境變數新增後重新部署");
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data).slice(0, 200);
    throw new Error(`Gemini 失敗：${msg}`);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("")
    ?.trim();
  if (!text) throw new Error("Gemini 未回傳內容");
  return text;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const text = String(body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "請提供描述文字" }, { status: 400 });
    }

    const store = await getStore();
    const projects = store.projects.map((p) => ({ id: p.id, name: p.name }));
    const employees = store.employees.map((e) => ({
      id: e.id,
      name: e.name,
      department: e.department,
    }));

    const prompt = `你是專案助理。根據使用者的口語／文字描述，拆成一或多筆任務草稿。
只能從下列清單選專案與負責人（用 id）；對不到就填 null。
優先級只能是 low / medium / high / urgent。
dueDate 用 YYYY-MM-DD，沒提到就 null。
addToSprint 若提到「這週／本週／Sprint」或語意上要排進本週，設 true，否則 true（預設加入本週）。

專案列表：
${JSON.stringify(projects, null, 2)}

員工列表：
${JSON.stringify(employees, null, 2)}

使用者描述：
"""
${text}
"""

請只回傳 JSON，格式：
{
  "tasks": [
    {
      "projectId": "string|null",
      "projectName": "string|null",
      "title": "string",
      "description": "string|null",
      "assigneeId": "string|null",
      "assigneeName": "string|null",
      "priority": "medium",
      "dueDate": "string|null",
      "addToSprint": true
    }
  ]
}`;

    const raw = await callGemini(prompt);
    const parsed = extractJson(raw) as { tasks?: ParsedTaskDraft[] };
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

    const normalized: ParsedTaskDraft[] = tasks
      .map((t) => {
        const title = String(t.title ?? "").trim();
        if (!title) return null;

        let projectId = t.projectId && projects.some((p) => p.id === t.projectId) ? t.projectId : null;
        if (!projectId && t.projectName) {
          const hit = projects.find(
            (p) =>
              p.name === t.projectName ||
              p.name.includes(String(t.projectName)) ||
              String(t.projectName).includes(p.name)
          );
          projectId = hit?.id ?? null;
        }

        let assigneeId =
          t.assigneeId && employees.some((e) => e.id === t.assigneeId) ? t.assigneeId : null;
        if (!assigneeId && t.assigneeName) {
          const hit = employees.find(
            (e) =>
              e.name === t.assigneeName ||
              e.name.includes(String(t.assigneeName)) ||
              String(t.assigneeName).includes(e.name)
          );
          assigneeId = hit?.id ?? null;
        }

        const priorityOk = ["low", "medium", "high", "urgent"].includes(String(t.priority));
        return {
          projectId,
          projectName: projectId
            ? projects.find((p) => p.id === projectId)?.name ?? t.projectName ?? null
            : t.projectName ?? null,
          title,
          description: t.description ? String(t.description).trim() : undefined,
          assigneeId,
          assigneeName: assigneeId
            ? employees.find((e) => e.id === assigneeId)?.name ?? t.assigneeName ?? null
            : t.assigneeName ?? null,
          priority: (priorityOk ? t.priority : "medium") as TaskPriority,
          dueDate: t.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(t.dueDate)) ? String(t.dueDate) : null,
          addToSprint: t.addToSprint !== false,
        } satisfies ParsedTaskDraft;
      })
      .filter(Boolean) as ParsedTaskDraft[];

    if (!normalized.length) {
      return NextResponse.json({ error: "無法從描述解析出任務，請再試一次或改寫" }, { status: 400 });
    }

    return NextResponse.json({
      tasks: normalized,
      projects,
      employees,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失敗";
    const status =
      message === "未登入" ? 401 : message === "需要管理員權限" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
