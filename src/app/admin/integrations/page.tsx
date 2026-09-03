"use client";

import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, Link2, MessageCircle, Plug } from "lucide-react";

interface IntegrationState {
  line: {
    enabled: boolean;
    richMenuId: string;
    richMenuActive: boolean;
  };
  google: {
    oauthConfigured: boolean;
    connected: boolean;
    calendarId: string;
    connectedAt: string | null;
  };
}

export default function AdminIntegrationsPage() {
  const [data, setData] = useState<IntegrationState | null>(null);
  const [lineRichMenuId, setLineRichMenuId] = useState("");
  const [googleCalendarId, setGoogleCalendarId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/integrations");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "載入失敗");
      setData(json);
      setLineRichMenuId(json.line.richMenuId ?? "");
      setGoogleCalendarId(json.google.calendarId ?? "primary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineRichMenuId: lineRichMenuId.trim(),
          googleCalendarId: googleCalendarId.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "儲存失敗");
      setMessage("整合設定已儲存");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-[var(--muted)]">載入中…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
          <Plug className="h-5 w-5 text-[var(--primary)]" />
          整合設定
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">LINE 圖文選單與 Google 日曆同步目標</p>
      </header>

      <form onSubmit={handleSave} className="card space-y-6 p-6">
        <section>
          <h3 className="flex items-center gap-2 text-base font-bold text-[var(--ink)]">
            <MessageCircle className="h-4 w-4 text-[var(--primary)]" />
            LINE 圖文選單
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            員工在網站綁定 LINE 成功後，系統會自動對該使用者掛上此圖文選單；解除綁定時會移除。
          </p>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Rich Menu ID</label>
            <input
              className="input-field w-full font-mono text-sm"
              value={lineRichMenuId}
              onChange={(e) => setLineRichMenuId(e.target.value)}
              placeholder="richmenu-xxxxxxxx"
            />
            <p className="mt-1 text-xs text-[var(--faint)]">
              在 LINE Developers → Messaging API → Rich menus 建立選單後複製 ID。留空則不自動掛載。
            </p>
          </div>
          {data && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              LINE Bot：{data.line.enabled ? "已設定" : "未設定"}
              {data.line.richMenuActive ? " · 圖文選單已啟用" : ""}
            </p>
          )}
        </section>

        <hr className="border-[var(--line)]" />

        <section>
          <h3 className="flex items-center gap-2 text-base font-bold text-[var(--ink)]">
            <Calendar className="h-4 w-4 text-[var(--primary)]" />
            Google 請假同步日曆
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            管理員 OAuth 連結後，「同步請假」會寫入此日曆（非個人 primary 日曆）。
            請確認 Google Cloud 已啟用 <strong>Google Calendar API</strong>，且
            Netlify 已設定 <code className="text-xs">GOOGLE_CLIENT_ID</code>／
            <code className="text-xs">GOOGLE_CLIENT_SECRET</code>。
          </p>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">日曆 ID</label>
            <input
              className="input-field w-full font-mono text-sm"
              value={googleCalendarId}
              onChange={(e) => setGoogleCalendarId(e.target.value)}
              placeholder="primary 或 xxxx@group.calendar.google.com"
            />
            <p className="mt-1 text-xs text-[var(--faint)]">
              Google 日曆 → 設定 → 整合日曆 → 日曆 ID
            </p>
          </div>
          {data && (
            <div className="mt-2 space-y-1 text-xs text-[var(--muted)]">
              <p>
                OAuth：{data.google.oauthConfigured ? "已設定" : "未設定"}
                {" · "}
                {data.google.connected ? (
                  <span className="text-[var(--success-l)]">已連結 Google</span>
                ) : (
                  "尚未連結（請至行事曆頁連結）"
                )}
              </p>
              {data.google.connectedAt && (
                <p>連結時間：{new Date(data.google.connectedAt).toLocaleString("zh-TW", { hour12: false })}</p>
              )}
            </div>
          )}
        </section>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {message && (
          <p className="flex items-center gap-1 text-sm text-[var(--success-l)]">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "儲存中…" : "儲存設定"}
        </button>
      </form>

      <div className="card p-4 text-sm text-[var(--muted)]">
        <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
          <Link2 className="h-4 w-4" />
          操作提示
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
          <li>圖文選單請勿在 LINE Manager 設「所有好友預設」，改由系統綁定後自動掛載</li>
          <li>
            Google Cloud 專案需啟用{" "}
            <a
              href="https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=1052453858320"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] underline"
            >
              Google Calendar API
            </a>
          </li>
          <li>OAuth 連結帳號需對指定日曆有「建立事件」權限</li>
          <li>儲存日曆 ID 後，至行事曆頁按「同步請假」即可寫入新日曆</li>
        </ul>
      </div>
    </div>
  );
}
