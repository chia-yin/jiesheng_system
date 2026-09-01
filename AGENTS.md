# 杰升考勤系統 — Cloud Agent 指引

## 專案目標

建立**公司簡易打卡考勤系統**（杰升系統 / jiesheng_system）。

## 技術棧

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS
- 資料儲存：JSON 檔案 (`data/attendance.json`)，簡易版先用檔案，之後可換 SQLite/DB
- 語言：介面與註解使用**繁體中文**

## 目前已完成功能

- [x] 上班 / 下班打卡
- [x] 員工選擇（預設 3 名示範員工）
- [x] 今日打卡摘要與最新紀錄
- [x] 依日期查詢打卡紀錄

## 待完成（使用者會提供參考網頁）

- [ ] 依參考網頁調整 UI/UX 風格
- [ ] 員工管理（新增/編輯/刪除）
- [ ] 登入權限（管理員 vs 一般員工）
- [ ] 匯出報表（CSV/Excel）
- [ ] 遲到/早退/加班統計

## 開發指令

```bash
npm install
npm run dev      # 開發伺服器 http://localhost:3000
npm run build    # 建置
npm run start    # 正式模式
```

## Cloud 環境

- 設定檔：`.cursor/environment.json`
- `install`：npm install
- `start`：npm run dev（port 3000）
- 無需額外 secrets（目前階段）

## 注意事項

1. `data/attendance.json` 為執行時產生，已加入 `.gitignore`
2. 保持簡易，避免過度設計
3. 參考網頁尚未提供，UI 先用簡潔風格，收到參考後再調整
4. 所有使用者可見文字用繁體中文

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/clock` | 取得員工列表 |
| POST | `/api/clock` | 打卡 `{ employeeId, type: "in"\|"out" }` |
| GET | `/api/records?date=YYYY-MM-DD` | 查詢指定日期紀錄 |
| GET | `/api/records?summary=today` | 今日摘要 |
