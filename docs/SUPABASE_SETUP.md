# Supabase 專案資訊（jiesheng-attendance）

| 項目 | 值 |
|------|-----|
| 專案名稱 | jiesheng-attendance |
| Project ID | `onmdzkwmfxbxjkhqluoz` |
| 區域 | ap-northeast-1（東京，距台灣最近） |
| API URL | https://onmdzkwmfxbxjkhqluoz.supabase.co |
| Dashboard | https://supabase.com/dashboard/project/onmdzkwmfxbxjkhqluoz |

## 已完成

- [x] 建立獨立 Supabase Project（Ocean 組織）
- [x] 執行 schema  migration（employees、打卡、請假、專案等表）
- [x] 產生 `.env.local` 範本（需補 service_role key）

## 待你完成（約 5 分鐘）

### 1. 補 Service Role Key

1. 開啟 [API Settings](https://supabase.com/dashboard/project/onmdzkwmfxbxjkhqluoz/settings/api)
2. 複製 **service_role** key（secret）
3. 貼到 `.env.local` 的 `SUPABASE_SERVICE_ROLE_KEY=`

### 2. 匯入本地資料

```bash
npm run migrate:supabase
```

### 3. Netlify 部署

本機尚未登入 Netlify CLI。請在終端機執行：

```bash
npx netlify login
npx netlify init   # 連結 GitHub repo chia-yin/jiesheng_system
```

Netlify 環境變數（與 `.env.local` 相同，加上正式網域）：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `SESSION_SECRET`（正式環境用隨機長字串）
- `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN`（LINE 設定後）

### 4. LINE Bot

需在 [LINE Developers](https://developers.line.biz/) 建立 Channel，Webhook 設為：

```
https://你的網域/api/bot/line
```

---

## 與其他 Supabase 專案隔離

此 Project 為全新建立，與 `ai_customer_service`、`STORAGE` 等既有專案完全獨立。
