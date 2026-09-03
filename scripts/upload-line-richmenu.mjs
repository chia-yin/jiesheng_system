/**
 * 上傳 LINE 圖文選單（Messaging API）
 * 用法：
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx node scripts/upload-line-richmenu.mjs
 * 或先從 Netlify 取 token 再跑。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const APP_URL = process.env.APP_URL || "https://jiesheng-system.netlify.app";
const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
const imagePath =
  process.env.RICH_MENU_IMAGE ||
  path.join(root, "public/line/richmenu-clock.jpg");

if (!token) {
  console.error("缺少 LINE_CHANNEL_ACCESS_TOKEN");
  process.exit(1);
}

const body = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "杰升考勤打卡選單",
  chatBarText: "打卡選單",
  areas: [
    {
      bounds: { x: 0, y: 0, width: 1250, height: 843 },
      action: { type: "message", text: "上班" },
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 843 },
      action: { type: "message", text: "下班" },
    },
    {
      bounds: { x: 0, y: 843, width: 1250, height: 843 },
      action: { type: "message", text: "狀態" },
    },
    {
      bounds: { x: 1250, y: 843, width: 1250, height: 843 },
      action: { type: "uri", uri: APP_URL },
    },
  ],
};

async function main() {
  const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const createText = await createRes.text();
  if (!createRes.ok) {
    console.error("建立失敗", createRes.status, createText);
    process.exit(1);
  }
  const { richMenuId } = JSON.parse(createText);
  console.log("created", richMenuId);

  const buf = fs.readFileSync(imagePath);
  const contentType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";
  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: buf,
    }
  );
  if (!uploadRes.ok) {
    console.error("上傳圖片失敗", uploadRes.status, await uploadRes.text());
    process.exit(1);
  }
  console.log("image uploaded", imagePath, buf.length);

  const defRes = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!defRes.ok) {
    console.warn("設為預設失敗（可略過）", defRes.status, await defRes.text());
  } else {
    console.log("set as default for all users");
  }

  const out = path.join(root, "public/line/richmenu-id.txt");
  fs.writeFileSync(out, richMenuId + "\n");
  console.log("wrote", out);
  console.log("RICH_MENU_ID=" + richMenuId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
