import { getAppUrl, getLogoUrl } from "@/lib/app-url";
import type { TaskStatus } from "@/types/system";

export type LineMessage = Record<string, unknown>;

function siteButton(label = "前往系統", path = "") {
  return {
    type: "button" as const,
    style: "primary" as const,
    height: "sm" as const,
    action: {
      type: "uri" as const,
      label,
      uri: `${getAppUrl()}${path}`,
    },
  };
}

/** 圖文選單：綁定成功 / 說明 */
export function buildWelcomeFlex(name: string, bound = true): LineMessage {
  const title = bound ? "LINE 綁定成功" : "杰勝考勤 Bot";
  const desc = bound
    ? `${name}，您已可在此打卡。\n\n指令：上班、下班、狀態\n工作日提醒會附帶本週 Sprint 任務，可點按鈕改狀態`
    : "請至網站「帳號設定 → LINE 綁定」產生 6 位數綁定碼，再傳送至此。";

  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: getLogoUrl(),
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "杰勝科技 · 考勤", weight: "bold", size: "sm", color: "#2563eb" },
          { type: "text", text: title, weight: "bold", size: "xl", margin: "sm" },
          { type: "text", text: desc, wrap: true, size: "sm", color: "#64748b", margin: "md" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [siteButton()],
      },
    },
  };
}

/** 打卡結果圖文 */
export function buildClockResultFlex(
  type: "in" | "out",
  lines: string[],
  employeeName: string
): LineMessage {
  const label = type === "in" ? "上班打卡" : "下班打卡";
  return {
    type: "flex",
    altText: `${label}成功`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: label, weight: "bold", size: "lg", color: "#059669" },
          { type: "text", text: employeeName, size: "sm", color: "#64748b", margin: "sm" },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: lines.map((line) => ({
              type: "text" as const,
              text: line,
              size: "sm" as const,
              wrap: true,
            })),
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [siteButton()],
      },
    },
  };
}

/** 上下班提醒推播（含一鍵打卡按鈕） */
export function buildReminderFlex(type: "in" | "out", employeeName: string, timeLabel: string): LineMessage {
  const title = type === "in" ? "記得上班打卡" : "記得下班打卡";
  const hint =
    type === "in"
      ? `您好 ${employeeName}，標準上班時間為 ${timeLabel}，請記得打卡。`
      : `您好 ${employeeName}，標準下班時間為 ${timeLabel}，請記得打卡。`;
  const clockLabel = type === "in" ? "上班打卡" : "下班打卡";
  const clockText = type === "in" ? "上班" : "下班";
  const buttonColor = type === "in" ? "#059669" : "#2563eb";

  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: getLogoUrl(),
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: title, weight: "bold", size: "lg", color: "#2563eb" },
          { type: "text", text: hint, wrap: true, size: "sm", color: "#64748b", margin: "md" },
          {
            type: "text",
            text: `也可直接回覆「${clockText}」打卡`,
            size: "xs",
            color: "#94a3b8",
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: buttonColor,
            action: {
              type: "message",
              label: clockLabel,
              text: clockText,
            },
          },
          siteButton(),
        ],
      },
    },
  };
}

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: "特休",
  sick: "病假",
  personal: "事假",
  other: "其他",
};

function leaveDetailRow(label: string, value: string) {
  return {
    type: "box" as const,
    layout: "baseline" as const,
    spacing: "sm" as const,
    contents: [
      {
        type: "text" as const,
        text: label,
        color: "#94a3b8",
        size: "sm" as const,
        flex: 2,
      },
      {
        type: "text" as const,
        text: value,
        wrap: true,
        size: "sm" as const,
        color: "#0f172a",
        flex: 5,
        weight: "bold" as const,
      },
    ],
  };
}

/** 新請假申請 → 通知管理員 */
export function buildLeaveApplicationFlex(input: {
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
}): LineMessage {
  const typeLabel = LEAVE_TYPE_LABEL[input.type] ?? input.type;
  const range =
    input.startDate === input.endDate
      ? input.startDate
      : `${input.startDate} ~ ${input.endDate}`;
  const daysLabel = `${input.days} 天`;

  return {
    type: "flex",
    altText: `請假待審核：${input.employeeName} ${typeLabel} ${range}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#2563eb",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "請假待審核",
            weight: "bold",
            size: "lg",
            color: "#ffffff",
          },
          {
            type: "text",
            text: "請至系統核准或退回",
            size: "xs",
            color: "#bfdbfe",
            margin: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: input.employeeName,
            size: "xl",
            weight: "bold",
            color: "#0f172a",
          },
          {
            type: "separator",
            margin: "sm",
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            margin: "md",
            contents: [
              leaveDetailRow("假別", typeLabel),
              leaveDetailRow("日期", range),
              leaveDetailRow("天數", daysLabel),
              leaveDetailRow("事由", input.reason || "—"),
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [siteButton("開啟請假審核", "/leave?tab=pending")],
      },
    },
  };
}

const SPRINT_STATUS_BUTTONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: "todo", label: "待辦", color: "#64748b" },
  { value: "in_progress", label: "進行中", color: "#2563eb" },
  { value: "review", label: "審核", color: "#d97706" },
  { value: "done", label: "完成", color: "#059669" },
];

const SPRINT_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "待辦",
  in_progress: "進行中",
  review: "審核",
  done: "完成",
};

export type SprintDigestTask = {
  id: string;
  title: string;
  projectName: string;
  status: TaskStatus;
  dueDate?: string;
};

function truncateFlexText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildSprintTaskBubble(task: SprintDigestTask) {
  const statusLabel = SPRINT_STATUS_LABEL[task.status] ?? task.status;
  const buttons = SPRINT_STATUS_BUTTONS.filter((b) => b.value !== task.status).map((b) => ({
    type: "button" as const,
    style: (b.value === "done" ? "primary" : "secondary") as "primary" | "secondary",
    height: "sm" as const,
    color: b.value === "done" ? b.color : undefined,
    action: {
      type: "message" as const,
      label: b.label,
      text: `任務狀態 ${task.id} ${b.value}`,
    },
  }));

  const bodyContents: Record<string, unknown>[] = [
    {
      type: "text",
      text: truncateFlexText(task.title, 60),
      weight: "bold",
      size: "md",
      wrap: true,
      color: "#0f172a",
    },
    {
      type: "text",
      text: truncateFlexText(task.projectName, 40),
      size: "xs",
      color: "#64748b",
      margin: "sm",
      wrap: true,
    },
    {
      type: "text",
      text: `目前：${statusLabel}`,
      size: "sm",
      color: "#2563eb",
      margin: "md",
      weight: "bold",
    },
  ];

  if (task.dueDate) {
    bodyContents.push({
      type: "text",
      text: `到期 ${task.dueDate}`,
      size: "xs",
      color: "#94a3b8",
      margin: "sm",
    });
  }

  return {
    type: "bubble" as const,
    size: "kilo" as const,
    body: {
      type: "box" as const,
      layout: "vertical" as const,
      contents: bodyContents,
    },
    footer: {
      type: "box" as const,
      layout: "vertical" as const,
      spacing: "sm" as const,
      contents: buttons,
    },
  };
}

/** 本週 Sprint 指派任務 Carousel（一鍵改狀態） */
export function buildSprintTasksCarousel(input: {
  employeeName: string;
  sprintLabel: string;
  tasks: SprintDigestTask[];
  kind: "in" | "out";
}): LineMessage {
  const altText =
    input.kind === "in" ? "本週 Sprint · 你的任務" : "本週 Sprint · 收斂進度";
  const headerHint =
    input.kind === "in"
      ? `${input.employeeName}，以下是你在 ${input.sprintLabel} 的未完成任務`
      : `${input.employeeName}，下班前可更新 ${input.sprintLabel} 任務進度`;

  const bubbles = input.tasks.slice(0, 10).map(buildSprintTaskBubble);

  // 第一張加總覽說明（若只有 1 張任務，把說明塞進該 bubble body 頂部）
  if (bubbles.length === 1) {
    const only = bubbles[0];
    only.body.contents = [
      {
        type: "text",
        text: altText,
        size: "xs",
        color: "#94a3b8",
        weight: "bold",
      },
      {
        type: "text",
        text: headerHint,
        size: "xs",
        color: "#64748b",
        wrap: true,
        margin: "sm",
      },
      { type: "separator", margin: "md" },
      ...only.body.contents,
    ];
    return {
      type: "flex",
      altText,
      contents: only,
    };
  }

  const introBubble = {
    type: "bubble" as const,
    size: "kilo" as const,
    body: {
      type: "box" as const,
      layout: "vertical" as const,
      contents: [
        {
          type: "text",
          text: altText,
          weight: "bold",
          size: "lg",
          color: "#2563eb",
        },
        {
          type: "text",
          text: headerHint,
          wrap: true,
          size: "sm",
          color: "#64748b",
          margin: "md",
        },
        {
          type: "text",
          text: `共 ${input.tasks.length} 項，左右滑動查看；點按鈕即可改狀態`,
          size: "xs",
          color: "#94a3b8",
          margin: "md",
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box" as const,
      layout: "vertical" as const,
      contents: [siteButton("開啟 Sprint", "/sprints")],
    },
  };

  // carousel 最多 12 bubbles；intro + 最多 10 任務 = 11
  return {
    type: "flex",
    altText,
    contents: {
      type: "carousel",
      contents: [introBubble, ...bubbles],
    },
  };
}

/** 任務狀態更新結果 */
export function buildTaskStatusResultFlex(input: {
  title: string;
  projectName: string;
  status: TaskStatus;
}): LineMessage {
  const statusLabel = SPRINT_STATUS_LABEL[input.status] ?? input.status;
  return {
    type: "flex",
    altText: `已更新：${statusLabel}`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "任務狀態已更新",
            weight: "bold",
            size: "lg",
            color: "#059669",
          },
          {
            type: "text",
            text: truncateFlexText(input.title, 60),
            wrap: true,
            size: "md",
            margin: "md",
            color: "#0f172a",
          },
          {
            type: "text",
            text: truncateFlexText(input.projectName, 40),
            size: "xs",
            color: "#64748b",
            margin: "sm",
          },
          {
            type: "text",
            text: `→ ${statusLabel}`,
            weight: "bold",
            size: "sm",
            color: "#2563eb",
            margin: "lg",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [siteButton("開啟 Sprint", "/sprints")],
      },
    },
  };
}
