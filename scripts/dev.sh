#!/usr/bin/env bash
# 啟動前先關閉佔用 port 3000 的本專案 next 進程；必要時清理損壞的 .next
set -euo pipefail

PORT="${PORT:-3000}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NEXT_DIR="${PROJECT_DIR}/.next"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  杰升考勤系統 — 本地開發"
echo "  ⚠️  dev 運行中請勿執行 npm run build（會損壞 .next chunk）"
echo "  建置請用：npm run build:check（CI）或先停止 dev 再 build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 若 .next 存在但缺少 BUILD_ID，多半是 dev 與 production build 混用
if [ -d "$NEXT_DIR" ] && [ ! -f "$NEXT_DIR/BUILD_ID" ]; then
  echo "⚠️  偵測到不完整的 .next（缺少 BUILD_ID），正在清除..."
  rm -rf "$NEXT_DIR"
fi

# 偵測 production build 殘留（有 BUILD_ID 但正在啟動 dev）
if [ -d "$NEXT_DIR" ] && [ -f "$NEXT_DIR/BUILD_ID" ]; then
  echo "⚠️  .next 含 production BUILD_ID，與 dev 不相容，正在清除..."
  rm -rf "$NEXT_DIR"
fi

# 可選：cache 目錄異常（空目錄或權限問題時一併清掉）
if [ -d "$NEXT_DIR/cache" ]; then
  if [ ! -r "$NEXT_DIR/cache" ] 2>/dev/null; then
    echo "⚠️  .next/cache 無法讀取，正在清除整個 .next..."
    rm -rf "$NEXT_DIR"
  fi
fi

echo "🔍 檢查 port ${PORT}..."

PIDS=$(lsof -ti tcp:"${PORT}" 2>/dev/null || true)

if [ -n "$PIDS" ]; then
  for PID in $PIDS; do
    CMD=$(ps -p "$PID" -o command= 2>/dev/null || true)
    if echo "$CMD" | grep -qE "next|node.*jiesheng"; then
      echo "⚡ 關閉舊進程 PID ${PID}"
      kill "$PID" 2>/dev/null || true
    fi
  done
  sleep 1
  REMAINING=$(lsof -ti tcp:"${PORT}" 2>/dev/null || true)
  if [ -n "$REMAINING" ]; then
    for PID in $REMAINING; do
      CMD=$(ps -p "$PID" -o command= 2>/dev/null || true)
      if echo "$CMD" | grep -qE "next|node"; then
        kill -9 "$PID" 2>/dev/null || true
      fi
    done
  fi
fi

echo "🚀 啟動 Next.js dev server (port ${PORT})..."
echo "   改 code 會自動熱更新（HMR），無需重啟"
cd "$PROJECT_DIR"
exec npx next dev -p "${PORT}"
