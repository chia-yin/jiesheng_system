import { getAppUrl, getLogoUrl } from "@/lib/app-url";

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
    ? `${name}，您已可在此打卡。\n\n指令：上班、下班、狀態`
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

/** 上下班提醒推播 */
export function buildReminderFlex(type: "in" | "out", employeeName: string, timeLabel: string): LineMessage {
  const title = type === "in" ? "記得上班打卡" : "記得下班打卡";
  const hint =
    type === "in"
      ? `您好 ${employeeName}，已過標準上班時間（${timeLabel}），請記得打卡。`
      : `您好 ${employeeName}，已過標準下班時間（${timeLabel}），請記得打卡。`;

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
            text: "回覆「上班」或「下班」即可打卡",
            size: "xs",
            color: "#94a3b8",
            margin: "md",
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
