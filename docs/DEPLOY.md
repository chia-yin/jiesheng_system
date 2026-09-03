# 杰升考勤系統 — 部署指南

本文件說明如何將系統部署至 **Netlify + 獨立 Supabase Project**，並分三階段啟用 LINE 打卡與 Supabase Auth。

## 架構概覽

```
使用者瀏覽器 ──► Netlify (Next.js)
                    │
                    ├──► Supabase Postgres（資料）
                    └──► LINE Platform（Webhook 打卡）

階段 3 可選：Supabase Auth 驗證登入（與 LINE 綁定欄位獨立）
```

---

## 階段 1：Supabase + Netlify

### 1. 建立 Supabase Project

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. **New Project**（建議名稱：`jiesheng-attendance`）
3. 記下 **Project URL**、**anon key**、**service_role key**
4. 進入 **SQL Editor**，貼上並執行 [`supabase/schema.sql`](../supabase/schema.sql)

> 請使用**新建**的 Project，避免與其他 Supabase 專案共用資料庫。

### 2. 匯入現有資料（選用）

若本地已有 `data/system.json`：

```bash
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
npm run migrate:supabase
```

### 3. 部署 Netlify

1. 將 repo 連結至 Netlify
2. Build command：`npm run build`
3. 設定環境變數（Site settings → Environment variables）：

| 變數 | 說明 |
|------|------|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role（僅 server 使用） |
| `SESSION_SECRET` | 隨機長字串（session 簽章） |
| `GOOGLE_*` | 若需 Google 行事曆同步 |

4. 部署完成後，以預設帳號登入測試（admin / admin123）

### 4. 自訂網域

在 Netlify **Domain management** 綁定既有網域，並更新：

- `GOOGLE_REDIRECT_URI=https://你的網域/api/auth/google/callback`

---

## 階段 2：LINE 打卡

### 1. 建立 LINE Messaging API Channel

1. [LINE Developers Console](https://developers.line.biz/) 建立 Provider + Messaging API Channel
2. 取得 **Channel secret**、**Channel access token**
3. Webhook URL：`https://你的網域/api/bot/line`
4. 啟用 **Use webhook**，關閉 Auto-reply（避免衝突）

### 2. Netlify 環境變數

```
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
```

重新部署後，Webhook 驗證應可通過。

### 3. 員工綁定流程

1. 登入系統 → **帳號設定 → LINE 綁定**
2. 點「產生綁定碼」
3. 在 LINE 對 Bot 傳送 6 位數綁定碼
4. 綁定成功後可用指令：

| 指令 | 說明 |
|------|------|
| 上班 | 上班打卡 |
| 下班 | 下班打卡 |
| 狀態 | 查看今日打卡狀態 |

### 4. 圖文選單（Rich Menu，選用）

圖文選單是聊天室底部的固定按鈕列，方便員工一鍵打卡，無須打字。

#### 在 LINE Official Account Manager 設定

1. 登入 [LINE Official Account Manager](https://manager.line.biz/)
2. 選擇你的 Bot → **工具** → **圖文選單**
3. **建立** → 選範本或自訂（建議 2×2 或 1×3）
4. 每個區塊設定：

| 區塊 | 動作類型 | 內容 |
|------|----------|------|
| 上班 | **文字** | `上班` |
| 下班 | **文字** | `下班` |
| 狀態 | **文字** | `狀態` |
| 前往系統 | **連結** | `https://jiesheng-system.netlify.app` |

5. **顯示期間**：永遠
6. **顯示對象**：所有好友（或依需求分群）
7. 儲存並**設為預設選單**

> Bot 收到文字「上班」「下班」「狀態」時，Webhook 會自動處理打卡，與手動輸入相同。

#### 注意事項

- 圖文選單與 Flex 訊息（綁定成功卡片）可並存
- 若按鈕無反應，確認 Webhook 已啟用且 `https://你的網域/api/bot/line` 驗證通過
- 連結區塊請用 **https** 正式網址

---

## 階段 3：Supabase Auth（選用）

適合希望密碼由 Supabase 管理、而非 JSON 明文的正式環境。

### 1. 同步員工至 Auth

```bash
export SUPABASE_URL="..."
export SUPABASE_SERVICE_ROLE_KEY="..."
export SUPABASE_ANON_KEY="..."
npm run sync:supabase-auth
```

此腳本會以 `username@users.jiesheng.internal` 建立 Auth 使用者，並寫入 `employees.supabase_user_id`。

### 2. 啟用 Auth 登入

Netlify 新增：

```
USE_SUPABASE_AUTH=true
SUPABASE_ANON_KEY=...
SUPABASE_AUTH_EMAIL_DOMAIN=users.jiesheng.internal
```

重新部署後，登入改走 Supabase Auth；**LINE 綁定不受影響**（仍用 `line_user_id` 欄位）。

### 3. 修改密碼

使用者在「帳號設定」改密碼時，會同步更新 Supabase Auth。

---

## 本地開發

未設定 Supabase 時，自動使用 `data/system.json`：

```bash
cp .env.example .env.local
npm install
npm run dev
```

測試 Supabase 後端：在 `.env.local` 填入 Supabase 變數即可。

---

## 常見問題

**Q: Netlify 上資料會消失嗎？**  
A: 使用 Supabase 後資料在 Postgres，不會因 serverless 重啟而消失。

**Q: LINE 與 Supabase Auth 會衝突嗎？**  
A: 不會。LINE 用 `line_user_id`，Auth 用 `supabase_user_id`，登入 session 仍為應用程式 cookie。

**Q: 如何確認目前使用哪種資料後端？**  
A: 有設定 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 即走 Supabase。

---

## 相關檔案

- Schema：[`supabase/schema.sql`](../supabase/schema.sql)
- 資料遷移：[`scripts/migrate-to-supabase.mjs`](../scripts/migrate-to-supabase.mjs)
- Auth 同步：[`scripts/sync-supabase-auth.mjs`](../scripts/sync-supabase-auth.mjs)
- LINE Webhook：[`src/app/api/bot/line/route.ts`](../src/app/api/bot/line/route.ts)
