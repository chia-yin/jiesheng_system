# 杰升考勤系統 — Cloud Agent 指引

## 專案目標

建立**公司考勤與專案管理系統**（杰勝科技 / jiesheng_system）。

## 技術棧

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS
- 資料儲存：本地 `data/system.json` 或 **Supabase Postgres**（見 `docs/DEPLOY.md`）
- 語言：介面與註解使用**繁體中文**
- UI 風格：**現代科技感**（白藍棕綠配色）

## 目前已完成功能

- [x] 側邊欄導航 + 全公司儀表板
- [x] 上班 / 下班打卡（含遲到/早退/工時計算）
- [x] 簡易登入系統（admin / employee 角色）
- [x] 登入後自行修改帳號與密碼（`/settings`）
- [x] 員工管理 CRUD（管理員專用）
- [x] 今日打卡摘要與最新紀錄
- [x] 依日期查詢打卡紀錄
- [x] 請假申請（含簡易審核）
- [x] 公告欄（列表 + 發布，管理員發布）
- [x] 專案管理（任務、Sprint、Kanban 看板）
- [x] 公司行事曆（請假/專案/會議聚合）
- [x] lucide-react icon
- [x] 開發伺服器自動清理 port 3000
- [x] Supabase 資料層 + 遷移腳本（階段 1）
- [x] LINE Webhook 打卡 + 綁定（階段 2）
- [x] Supabase Auth 雙通道登入（階段 3，選用）

## 待完成

- [ ] Telegram Bot 整合
- [ ] 匯出報表（CSV/Excel）
- [x] 專案任務 Kanban
- [x] Google Calendar OAuth 管理員串接 + 員工 iCal 訂閱
- [ ] bcrypt 密碼雜湊（或使用 USE_SUPABASE_AUTH=true）

## 預設帳號

| 帳號 | 密碼 | 角色 |
|------|------|------|
| admin | admin123 | 管理員 |
| employee1 | emp123 | 員工 |

## 開發指令

```bash
npm install
npm run dev      # 自動清理 port 3000 後啟動 http://localhost:3000
npm run build    # 建置
npm run start    # 正式模式
npm run migrate:supabase   # JSON → Supabase 匯入
npm run sync:supabase-auth # 員工同步至 Supabase Auth
```

## 部署

詳見 `docs/DEPLOY.md`（Netlify + 獨立 Supabase Project + LINE）

## 規劃文件

詳見 `docs/PLAN.md`

## Cloud 環境

- 設定檔：`.cursor/environment.json`
- `install`：npm install
- `start`：npm run dev（port 3000）
- 無需額外 secrets（目前階段）

## 注意事項

1. `data/system.json` 為執行時產生，已加入 `.gitignore`（自動遷移舊版 attendance.json）
2. 保持簡易，避免過度設計
3. 所有使用者可見文字用繁體中文
4. 密碼目前為明文儲存，正式環境應改用 bcrypt

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/login` | 登入 `{ username, password }` |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 取得當前使用者 |
| PATCH | `/api/auth/profile` | 更新自己的帳號/密碼 `{ username?, currentPassword, newPassword?, confirmPassword? }` |
| GET/POST/PATCH/DELETE | `/api/employees` | 員工 CRUD（admin） |
| GET | `/api/clock` | 取得員工列表 |
| POST | `/api/clock` | 打卡 `{ type: "in"\|"out" }` |
| GET | `/api/records?date=YYYY-MM-DD` | 查詢指定日期紀錄 |
| GET | `/api/records?summary=today` | 今日摘要（含遲到統計） |
| GET | `/api/attendance/summary` | 個人工時摘要（今日+本週） |
| GET/POST/PATCH | `/api/leaves` | 請假列表/申請/審核 |
| GET/POST | `/api/announcements` | 公告列表/發布 |
| GET/POST | `/api/projects` | 專案列表（全員）/ 新增（admin） |
| GET/PATCH/DELETE | `/api/projects/[id]` | 專案詳情（全員）/ 編輯刪除（admin） |
| GET/POST | `/api/projects/[id]/sprints` | Sprint 列表（全員）/ 新增（admin） |
| PATCH/DELETE | `/api/projects/[id]/sprints/[sprintId]` | Sprint 編輯刪除（admin） |
| GET/POST | `/api/projects/[id]/tasks` | 任務列表（全員）/ 新增（admin） |
| PATCH/DELETE | `/api/projects/[id]/tasks/[taskId]` | 任務更新（admin 或 assignee）/ 刪除（admin 或 assignee） |
| GET/POST/PATCH/DELETE | `/api/calendar` | 行事曆事件 CRUD |
| GET | `/api/calendar/export.ics` | iCal 匯出/訂閱 |
| GET | `/api/calendar/google-status` | Google 連結狀態 |
| POST | `/api/calendar/sync` | 手動同步請假至 Google |
| GET | `/api/auth/google` | Google OAuth 起始（admin） |
| POST | `/api/bot/line` | LINE Webhook（公開，簽章驗證） |
| GET/POST/DELETE | `/api/line/bind` | LINE 綁定狀態 / 產生綁定碼 / 解除綁定 |
