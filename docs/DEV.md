# 本地開發說明

## 日常開發

```bash
npm run dev
```

- 預設 `http://localhost:3000`
- 修改程式碼會自動熱更新（HMR），**無需重啟** dev server

## 遇到 500 / Cannot find module './xxx.js'

多半是 `.next` 與 dev server 狀態不一致（例如在 dev 運行中執行了 `npm run build`）。

```bash
npm run dev:clean
```

會清除 `.next` 並重新啟動 dev。

## 重要：勿在 dev 運行中 build

| 情境 | 建議 |
|------|------|
| 本地改 code | 只用 `npm run dev` |
| 驗證 production 建置 | **先停止 dev**，再執行 `npm run build` 或 `npm run build:check` |
| CI 建置 | 使用 `npm run build:check` |

在 dev 運行中執行 `npm run build` 會覆寫/混用 webpack chunk，導致 Internal Server Error。

## 其他指令

- `npm run clean` — 清除 `.next` 與 `node_modules/.cache`（不啟動 server）
- `npm run dev:clean` — 清除 `.next` 後啟動 dev
