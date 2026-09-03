# 杰勝科技 — 考勤與專案管理系統規劃

> 版本：v0.3 | 更新：2026-09-02

---

## 一、參考網站分析（天諭行政系統 v1.9）

### 1.1 功能模組摘要

| 群組 | 模組 | 說明 |
|------|------|------|
| 全公司 | 儀表板 | KPI（在職員工、進行中案件、待付款、未結任務）、最新公告、近期會議、部門人數 |
| 全公司 | 公告欄 | 全公司公告、決議公告、置頂 |
| 全公司 | 公司行事曆 | 月曆/議程雙檢視、事件色塊 |
| 我的 | 休請假 | 假單申請、簽核流程、附件上傳 |
| 我的 | 打卡 | 上班/下班、即時計時、本月工時 |
| 我的 | 發起任務 / 會議 / 排班 | 任務中心、會議交辦、排班管理 |
| 部門 | 六部工作台 | 課程/行銷/財務/人事/業務/資訊 |
| 進階 | 待簽核、看板、公文採購、SOP、系統管理 | 流程引擎、電子簽核 |

### 1.2 導航結構

四層側邊欄優先序：
1. **全公司** — 儀表板、公告、行事曆
2. **我的** — 個人日常操作（請假、打卡、任務）
3. **部門** — 部門專屬工作台
4. **功能模組** — 簽核、差勤、系統管理

### 1.3 UI/UX 風格（v0.3 科技風重設計）

| 元素 | 規格 |
|------|------|
| 主色調 | 白 `#FFFFFF`、淺灰藍背景 `#F0F4F8` |
| 強調色 | 科技藍 `#2563EB`、深藍 `#1E40AF` |
| 輔助色 | 棕 `#92400E` / `#B45309`（暖點綴）、綠 `#059669` / `#10B981`（成功/核准） |
| 側邊欄 | 深藍灰 `#1E293B`，藍色 active 狀態 |
| 字體 | Inter / PingFang TC / 微軟正黑體 |
| 元件 | 白底卡片、細邊框、輕陰影、圓角 12px、chip 狀態標籤 |
| 版面 | 左側欄 236px + 頂列 58px + 主內容區 |

### 1.4 可借鑑元素（杰勝系統已採用）

- [x] 四層側邊欄分組導航
- [x] KPI 儀表板（進行中專案、待審請假、打卡摘要）
- [x] 現代科技感主題（白藍棕綠）
- [x] 深藍側邊欄 + 藍色 active 狀態
- [x] lucide-react 專業 icon
- [x] 簡易登入與角色權限
- [ ] 簽核流程軸（flowbar）— 後續請假審核
- [ ] Kanban 看板 — 後續專案任務
- [x] 公司行事曆 — 整合請假/專案/會議

---

## 二、現有程式碼現況

### 2.1 技術棧

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- JSON 檔案儲存：`data/system.json`（整合考勤、請假、公告、專案）
- 自動遷移舊版 `data/attendance.json`

### 2.2 已完成（MVP v0.3）

| 功能 | 路徑 | API |
|------|------|-----|
| 登入 | `/login` | `POST /api/auth/login` |
| 員工管理 | `/admin/employees` | `GET/POST/PATCH/DELETE /api/employees` |
| 儀表板 | `/` | 聚合多 API |
| 打卡 | `/attendance` | `GET/POST /api/clock`, `GET /api/attendance/summary` |
| 打卡紀錄 | `/records` | `GET /api/records` |
| 請假申請 | `/leave` | `GET/POST/PATCH /api/leaves` |
| 公告欄 | `/announcements` | `GET/POST /api/announcements` |
| 專案管理 | `/projects` | `GET/POST /api/projects` |
| 公司行事曆 | `/calendar` | `GET/POST/PATCH/DELETE /api/calendar` |
| iCal 匯出 | — | `GET /api/calendar/export.ics` |

### 2.3 待完成

- bcrypt 密碼雜湊
- 匯出報表 CSV/Excel
- LINE / Telegram Bot 整合
- 簽核流程、任務看板

---

## 三、系統架構

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (Next.js 15)                     │
│  Sidebar + TopBar + Pages (儀表板/考勤/請假/公告/專案)    │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│  API Routes                                              │
│  /api/clock  /api/records  /api/leaves                   │
│  /api/announcements  /api/projects                       │
│  /api/webhooks/line  /api/webhooks/telegram  (Phase 2)   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  lib/ (業務邏輯)                                          │
│  db.ts → system.json                                     │
│  attendance.ts | leaves.ts | announcements.ts | projects │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  資料層 (Phase 1: JSON → Phase 3: SQLite/Supabase)     │
└─────────────────────────────────────────────────────────┘

外部整合 (Phase 2):
  LINE Messaging API ←→ Webhook
  Telegram Bot API   ←→ Webhook
```

### 模組清單

| 模組 | 優先級 | 狀態 |
|------|--------|------|
| 考勤打卡 | P0 | ✅ 含遲到/早退/工時 |
| 請假申請 | P0 | ✅ MVP |
| 公告欄 | P0 | ✅ MVP |
| 專案管理 | P1 | ✅ 骨架 |
| 員工管理 | P1 | ✅ CRUD |
| 登入權限 | P1 | ✅ Cookie Session |
| LINE/TG Bot | P1 | 待做 |
| 報表匯出 | P2 | 待做 |
| 排班/薪資 | P3 | 參考天諭 |

---

## 四、資料模型

### 4.1 Employee（員工）

```typescript
interface Employee {
  id: string;
  name: string;
  department: string;
  role: "admin" | "employee";
  username: string;
  password: string;  // 開發階段明文，之後換 bcrypt
}
```

### 4.1.1 WorkSettings（工時設定）

```typescript
interface WorkSettings {
  startTime: string;    // 預設 "09:00"
  endTime: string;      // 預設 "18:00"
  breakMinutes: number; // 預設 60
}
```

### 4.2 AttendanceRecord（打卡）

```typescript
interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: "in" | "out";
  timestamp: string;    // ISO 8601
  note?: string;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
}
```

### 4.2.1 台灣勞基法打卡邏輯（簡化）

- 標準工時：每日 8 小時、每週 40 小時
- 延長工時：每日不超過 4 小時，每月不超過 46 小時（顯示提示）
- 休息：連續工作 4 小時應有 30 分鐘休息（UI 提示）
- 遲到：上班打卡時間 > `workSettings.startTime`
- 早退：下班打卡時間 < `workSettings.endTime`
- 工時計算：下班 - 上班 - 休息時間（`breakMinutes`）

### 4.3 LeaveRequest（請假）

```typescript
interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: "annual" | "sick" | "personal" | "other";
  startDate: string;    // YYYY-MM-DD
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  // 擴充：approverId, attachments[], aiCheckResult
}
```

### 4.4 Announcement（公告）

```typescript
interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  pinned: boolean;
  createdAt: string;
}
```

### 4.5 Project（專案）

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  status: "planning" | "active" | "completed" | "on_hold";
  managerId?: string;
  managerName?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  // 擴充：tasks[], members[]
}
```

### 4.6 CalendarEvent（行事曆）

```typescript
interface CalendarEvent {
  id: string;
  title: string;
  type: "leave" | "meeting" | "project" | "other";
  startDate: string;    // YYYY-MM-DD
  endDate?: string;
  startTime?: string;   // HH:mm
  endTime?: string;
  employeeId?: string;
  projectId?: string;
  leaveId?: string;
  description?: string;
  googleEventId?: string;
  createdAt: string;
}
```

請假（已核准）與專案里程碑會自動聚合顯示於月曆，無需重複建立。

### 4.7 儲存結構

```json
// data/system.json
{
  "employees": [],
  "records": [],
  "leaves": [],
  "announcements": [],
  "projects": [],
  "calendarEvents": [],
  "workSettings": { "startTime": "09:00", "endTime": "18:00", "breakMinutes": 60 }
}
```

---

## 九、Google Calendar 整合

### 9.1 現況（v0.3）

| 功能 | 狀態 | 說明 |
|------|------|------|
| iCal 匯出 | ✅ | `GET /api/calendar/export.ics` 下載 .ics 檔（含請假/會議/專案） |
| 訂閱連結 | ✅ | 行事曆頁「複製訂閱連結」，貼至 Google Calendar → 透過 URL 新增 |
| 訂閱說明 Modal | ✅ | 圖文教學如何訂閱公司行事曆 |
| 加入 Google 日曆 | ✅ | 單一事件「加入 Google 日曆」按鈕 |
| OAuth 管理員串接 | ✅ | `/api/auth/google` + callback，儲存 `googleTokens` 至 `system.json` |
| 請假自動同步 | ✅ | 請假核准（PATCH status=approved）→ 自動建立 Google 日曆事件 |
| 手動同步 | ✅ | `POST /api/calendar/sync`（管理員，補同步歷史請假） |
| 連結狀態顯示 | ✅ | 行事曆頁顯示「已連結 Google 日曆 ✓」或「尚未連結」 |

### 9.2 環境變數

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

複製 `.env.example` 為 `.env.local` 後填入憑證。

### 9.3 管理員 OAuth 設定步驟

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立專案 → 啟用 **Google Calendar API**
3. 建立 OAuth 2.0 用戶端（Web 應用程式）
4. 授權重新導向 URI：`http://localhost:3000/api/auth/google/callback`（正式環境改為實際網域）
5. 填入 `.env.local` 的三個環境變數
6. 重啟 `npm run dev`
7. 以管理員登入 → 開啟 `/calendar` → 點「連結 Google 日曆」
8. 完成 OAuth 授權後，系統將 `refresh_token` 儲存至 `data/system.json` 的 `googleTokens`
9. 之後請假核准會自動同步至管理員 Google 日曆

### 9.4 員工訂閱方式（無需 OAuth）

1. 開啟 `/calendar` → 點「訂閱說明」或「複製訂閱連結」
2. Google Calendar → 左側「其他日曆」→「透過 URL 訂閱」
3. 貼上 `https://your-domain.com/api/calendar/export.ics`
4. iCal 內容包含：已核准請假、會議、專案里程碑

### 9.5 API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/auth/google` | OAuth 起始（管理員） |
| GET | `/api/auth/google/callback` | OAuth 回調，儲存 tokens |
| GET | `/api/calendar/google-status` | 查詢 OAuth 設定與連結狀態 |
| POST | `/api/calendar/sync` | 手動同步已核准請假（管理員） |
| GET | `/api/calendar/export.ics` | iCal 匯出/訂閱（公開） |

### 9.6 資料儲存

```json
// data/system.json
{
  "googleTokens": {
    "access_token": "...",
    "refresh_token": "...",
    "expiry": 1234567890000,
    "connectedAt": "2026-09-02T...",
    "calendarId": "primary"
  }
}
```

請假紀錄同步後會寫入 `googleEventId` 避免重複建立。

---

## 五、LINE vs Telegram 整合建議

### 5.1 比較

| 面向 | LINE | Telegram |
|------|------|----------|
| 台灣普及度 | ⭐⭐⭐⭐⭐ 企業/員工幾乎必裝 | ⭐⭐⭐ 技術團隊較多 |
| Bot API | Messaging API（需官方帳號） | Bot API（免費、開發友善） |
| 群組通知 | 官方帳號推播、群組 Bot | 群組/頻道 Bot |
| 開發難度 | 中等（需 Channel Secret/Token） | 低（@BotFather 即可） |
| 打卡 UX | Rich Menu 一鍵打卡 | Inline Keyboard 按鈕 |
| 成本 | 免費額度後按則計費 | 完全免費 |

### 5.2 建議策略

**主推 LINE**（台灣企業場景），**Telegram 作為備援/技術團隊通道**。

### 5.3 實作架構

```
員工 LINE → 官方帳號 → Webhook POST /api/webhooks/line
                              ↓
                         解析 event (message/postback)
                              ↓
                    綁定 employeeId ↔ lineUserId
                              ↓
                    clockInOut() / createLeave()
                              ↓
                         回覆 Flex Message
```

#### LINE 設定步驟

1. 至 [LINE Developers Console](https://developers.line.biz/) 建立 Provider + Messaging API Channel
2. 取得 `Channel Secret`、`Channel Access Token`
3. 設定 Webhook URL：`https://your-domain.com/api/webhooks/line`
4. 啟用 Webhook、關閉自動回覆
5. 環境變數：`.env.local`
   ```
   LINE_CHANNEL_SECRET=xxx
   LINE_CHANNEL_ACCESS_TOKEN=xxx
   ```
6. 實作 Rich Menu：上班打卡 | 下班打卡 | 請假 | 公告

#### Telegram 設定步驟

1. 與 [@BotFather](https://t.me/BotFather) 建立 Bot，取得 Token
2. 設定 Webhook：`https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/webhooks/telegram`
3. 環境變數：
   ```
   TELEGRAM_BOT_TOKEN=xxx
   ```
4. 指令設計：`/clock_in`、`/clock_out`、`/leave`、`/status`

### 5.4 員工綁定流程

1. 員工在網頁「我的帳號」產生綁定碼（6 位數）
2. 在 LINE/TG 傳送綁定碼給 Bot
3. Bot 將 `lineUserId` / `chatId` 寫入 `employees[].lineUserId`

---

## 六、分階段實作路線圖

### Phase 1 — MVP（已完成）

- [x] 側邊欄 + 儀表板
- [x] 請假申請頁 + API（含簡易審核）
- [x] 公告列表 + 發布 API
- [x] 專案管理骨架
- [x] 統一 `system.json` 資料層

### Phase 2 — 核心完善（本輪已完成）

- [x] 員工管理 CRUD
- [x] 簡易登入（admin / employee 角色）
- [x] 遲到/早退判斷（標準上班 09:00）
- [x] 科技風 UI 重設計
- [x] 打卡頁面重設計（勞基法邏輯）
- [ ] LINE Bot 打卡 + 請假通知
- [ ] 請假審核通知（LINE Push）

### Phase 3 — 進階功能（1–2 月）

- [ ] 資料庫遷移（SQLite 或 Supabase）
- [ ] 專案任務 Kanban
- [x] 公司行事曆（整合請假/專案/會議）
- [ ] CSV/Excel 報表匯出
- [ ] Telegram Bot 備援通道
- [ ] 排班模組（參考天諭 ty_shifts）

### Phase 4 — 企業級（長期）

- [ ] SSO 單一登入
- [ ] 電子簽核流程引擎
- [ ] 薪資試算
- [ ] AI 請假附件檢核

---

## 七、API 端點總覽

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/login` | 登入 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 當前使用者 |
| GET/POST/PATCH/DELETE | `/api/employees` | 員工 CRUD（admin） |
| GET | `/api/clock` | 員工列表 |
| POST | `/api/clock` | 打卡 `{ type }` |
| GET | `/api/records?date=YYYY-MM-DD` | 日期紀錄 |
| GET | `/api/records?summary=today` | 今日摘要（含遲到統計） |
| GET | `/api/attendance/summary` | 個人工時摘要 |
| GET | `/api/leaves` | 請假列表 |
| POST | `/api/leaves` | 新增請假 |
| PATCH | `/api/leaves` | 審核 `{ id, status }` |
| GET | `/api/announcements` | 公告列表 |
| POST | `/api/announcements` | 發布公告 |
| GET | `/api/projects` | 專案列表 |
| POST | `/api/projects` | 新增專案 |
| GET | `/api/calendar` | 行事曆事件（支援 `?month=` `?date=`） |
| POST | `/api/calendar` | 新增會議/事件 |
| PATCH | `/api/calendar` | 更新事件 |
| DELETE | `/api/calendar?id=` | 刪除事件 |
| GET | `/api/calendar/export.ics` | iCal 匯出/訂閱 |
| GET | `/api/auth/google` | Google OAuth 起始（管理員） |
| GET | `/api/calendar/google-status` | Google 連結狀態 |
| POST | `/api/calendar/sync` | 手動同步請假至 Google |

---

## 八、建議下一步

1. **驗證 MVP**：`npm run dev` → 瀏覽各頁面功能
2. **申請 LINE 官方帳號**：建立 Messaging API Channel
3. **實作 `/api/webhooks/line`**：Rich Menu 一鍵打卡
4. **員工管理頁**：補齊 CRUD，支援 LINE User ID 綁定欄位
5. **部署**：Vercel / Cloudflare Pages + 設定 Webhook 公開 URL
