import { createHmac } from "crypto";
import { linkLineRichMenu, unlinkLineRichMenu } from "@/lib/line-rich-menu";
import { clockInOut } from "@/lib/attendance";
import { getStore, saveStore } from "@/lib/db";
import {
  buildClockResultFlex,
  buildWelcomeFlex,
  type LineMessage,
} from "@/lib/line-messages";
import { getDayRecords, getWorkSettings } from "@/lib/worktime";
import type { Employee } from "@/types/attendance";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export function isLineEnabled(): boolean {
  return Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

export function verifyLineSignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const hash = createHmac("SHA256", secret).update(body).digest("base64");
  return hash === signature;
}

function generateBindCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createLineBindCode(employeeId: string): Promise<{ code: string; expiresAt: string }> {
  const store = await getStore();
  const index = store.employees.findIndex((e) => e.id === employeeId);
  if (index < 0) throw new Error("找不到員工");

  const code = generateBindCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  store.employees[index].lineBindCode = code;
  store.employees[index].lineBindExpiresAt = expiresAt;
  await saveStore(store);

  return { code, expiresAt };
}

export async function unbindLine(employeeId: string): Promise<void> {
  const store = await getStore();
  const index = store.employees.findIndex((e) => e.id === employeeId);
  if (index < 0) throw new Error("找不到員工");

  const lineUserId = store.employees[index].lineUserId;
  if (lineUserId) {
    await unlinkLineRichMenu(lineUserId);
  }

  store.employees[index].lineUserId = undefined;
  store.employees[index].lineBindCode = undefined;
  store.employees[index].lineBindExpiresAt = undefined;
  await saveStore(store);
}

function findEmployeeByLineUserId(employees: Employee[], lineUserId: string): Employee | undefined {
  return employees.find((e) => e.lineUserId === lineUserId);
}

function findEmployeeByBindCode(employees: Employee[], code: string): Employee | undefined {
  const now = Date.now();
  return employees.find((e) => {
    if (!e.lineBindCode || e.lineBindCode !== code) return false;
    if (e.lineBindExpiresAt && new Date(e.lineBindExpiresAt).getTime() < now) return false;
    return true;
  });
}

async function postLineMessages(url: string, body: Record<string, unknown>): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

async function replyLine(replyToken: string, messages: LineMessage | LineMessage[]): Promise<void> {
  const list = Array.isArray(messages) ? messages : [messages];
  await postLineMessages(LINE_REPLY_URL, { replyToken, messages: list });
}

export async function pushLineMessages(lineUserId: string, messages: LineMessage | LineMessage[]): Promise<void> {
  const list = Array.isArray(messages) ? messages : [messages];
  await postLineMessages(LINE_PUSH_URL, { to: lineUserId, messages: list });
}

function formatClockLines(type: "in" | "out", result: Awaited<ReturnType<typeof clockInOut>>): string[] {
  const time = new Date(result.record.timestamp).toLocaleString("zh-TW", { hour12: false });
  const lines = [`時間：${time}`];
  if (type === "in" && result.lateMinutes > 0) {
    lines.push(`遲到 ${result.lateMinutes} 分鐘`);
  }
  if (type === "out") {
    if (result.earlyLeaveMinutes > 0) lines.push(`早退 ${result.earlyLeaveMinutes} 分鐘`);
    if (result.workMinutes > 0) {
      lines.push(`今日工時 ${Math.floor(result.workMinutes / 60)} 小時 ${result.workMinutes % 60} 分`);
    }
  }
  return lines;
}

async function handleBind(lineUserId: string, code: string): Promise<LineMessage> {
  const store = await getStore();
  const existing = findEmployeeByLineUserId(store.employees, lineUserId);
  if (existing) {
    return {
      type: "text",
      text: `此 LINE 已綁定「${existing.name}」。若要重新綁定請先在網頁設定解除綁定。`,
    };
  }

  const target = findEmployeeByBindCode(store.employees, code);
  if (!target) {
    return buildWelcomeFlex("", false);
  }

  if (store.employees.some((e) => e.lineUserId === lineUserId)) {
    return { type: "text", text: "此 LINE 已綁定其他帳號。" };
  }

  const index = store.employees.findIndex((e) => e.id === target.id);
  store.employees[index].lineUserId = lineUserId;
  store.employees[index].lineBindCode = undefined;
  store.employees[index].lineBindExpiresAt = undefined;
  await saveStore(store);

  await linkLineRichMenu(lineUserId);

  return buildWelcomeFlex(target.name, true);
}

async function handleStatus(employee: Employee): Promise<LineMessage> {
  const store = await getStore();
  const today = new Date().toISOString().slice(0, 10);
  const { clockIn, clockOut } = getDayRecords(store.records, employee.id, today);
  const settings = getWorkSettings(store.workSettings);

  if (!clockIn) {
    return {
      type: "text",
      text: `${employee.name} 今日尚未上班打卡\n標準時間 ${settings.startTime}～${settings.endTime}`,
    };
  }

  const inTime = new Date(clockIn.timestamp).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (!clockOut) {
    return {
      type: "text",
      text: `${employee.name} 今日狀態\n上班：${inTime}${clockIn.lateMinutes ? `（遲到 ${clockIn.lateMinutes} 分）` : ""}\n尚未下班打卡`,
    };
  }

  const outTime = new Date(clockOut.timestamp).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return {
    type: "text",
    text: `${employee.name} 今日狀態\n上班：${inTime}\n下班：${outTime}`,
  };
}

async function handleClock(employee: Employee, type: "in" | "out"): Promise<LineMessage> {
  try {
    const result = await clockInOut(employee.id, type);
    return buildClockResultFlex(type, formatClockLines(type, result), employee.name);
  } catch (err) {
    return { type: "text", text: err instanceof Error ? err.message : "打卡失敗" };
  }
}

function normalizeCommand(text: string): string {
  return text.trim().toLowerCase();
}

export async function handleLineWebhookEvents(events: LineWebhookEvent[]): Promise<void> {
  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") continue;
    if (!event.replyToken || !event.source?.userId) continue;

    const lineUserId = event.source.userId;
    const text = (event.message.text ?? "").trim();
    const cmd = normalizeCommand(text);

    const store = await getStore();
    const employee = findEmployeeByLineUserId(store.employees, lineUserId);

    if (/^\d{6}$/.test(text)) {
      await replyLine(event.replyToken, await handleBind(lineUserId, text));
      continue;
    }

    if (!employee) {
      await replyLine(event.replyToken, buildWelcomeFlex("", false));
      continue;
    }

    if (cmd === "上班" || cmd === "in" || cmd === "clock in") {
      await replyLine(event.replyToken, await handleClock(employee, "in"));
      continue;
    }

    if (cmd === "下班" || cmd === "out" || cmd === "clock out") {
      await replyLine(event.replyToken, await handleClock(employee, "out"));
      continue;
    }

    if (cmd === "狀態" || cmd === "status") {
      await replyLine(event.replyToken, await handleStatus(employee));
      continue;
    }

    if (cmd === "help" || cmd === "說明" || cmd === "選單") {
      await replyLine(event.replyToken, buildWelcomeFlex(employee.name, true));
      continue;
    }

    await replyLine(event.replyToken, {
      type: "text",
      text: "不認識的指令。請輸入：上班、下班、狀態、說明",
    });
  }
}

export type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string; type?: string };
  message?: { type?: string; text?: string };
};

export type LineWebhookBody = {
  events?: LineWebhookEvent[];
};
