"use client";

import { useEffect, useState } from "react";
import { AtSign, Building2, CheckCircle2, KeyRound, Lock, MessageCircle, Settings, User } from "lucide-react";
import type { SessionUser } from "@/types/auth";
import styles from "./settings.module.css";

type SettingsTab = "username" | "password" | "line";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://jiesheng-system.netlify.app";

export default function SettingsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("username");

  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [lineEnabled, setLineEnabled] = useState(false);
  const [lineBound, setLineBound] = useState(false);
  const [bindCode, setBindCode] = useState<string | null>(null);
  const [bindExpiresAt, setBindExpiresAt] = useState<string | null>(null);
  const [lineLoading, setLineLoading] = useState(true);
  const [lineSaving, setLineSaving] = useState(false);
  const [lineError, setLineError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          setUsername(data.user.username);
        }
      })
      .finally(() => setLoading(false));

    fetch("/api/line/bind")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setLineEnabled(Boolean(data.enabled));
          setLineBound(Boolean(data.bound));
          setBindCode(data.bindCode ?? null);
          setBindExpiresAt(data.bindExpiresAt ?? null);
        }
      })
      .finally(() => setLineLoading(false));
  }, []);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUsernameError("");

    if (!username.trim()) {
      setUsernameError("帳號不可為空");
      return;
    }
    if (username.trim() === user?.username) {
      setUsernameError("帳號與目前相同");
      return;
    }

    setUsernameSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "更新失敗");

      setUser(data.user);
      setUsername(data.user.username);
      showToast("帳號已更新");
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setUsernameSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError("請輸入目前密碼");
      return;
    }
    if (!newPassword) {
      setPasswordError("請輸入新密碼");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("新密碼至少 6 字元");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("新密碼與確認密碼不一致");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "更新失敗");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("密碼已更新，您仍保持登入狀態");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleGenerateBindCode() {
    setLineError("");
    setLineSaving(true);
    try {
      const res = await fetch("/api/line/bind", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "產生綁定碼失敗");
      setBindCode(data.code);
      setBindExpiresAt(data.expiresAt);
      showToast("綁定碼已產生，15 分鐘內有效");
    } catch (err) {
      setLineError(err instanceof Error ? err.message : "產生綁定碼失敗");
    } finally {
      setLineSaving(false);
    }
  }

  async function handleUnbindLine() {
    setLineError("");
    setLineSaving(true);
    try {
      const res = await fetch("/api/line/bind", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "解除綁定失敗");
      setLineBound(false);
      setBindCode(null);
      setBindExpiresAt(null);
      showToast("已解除 LINE 綁定");
    } catch (err) {
      setLineError(err instanceof Error ? err.message : "解除綁定失敗");
    } finally {
      setLineSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-[var(--muted)]">載入中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-[var(--danger)]">無法取得使用者資訊</p>
      </div>
    );
  }

  const roleLabel = user.role === "admin" ? "管理員" : "員工";
  const avatarChar = user.name.trim().charAt(0) || user.username.charAt(0).toUpperCase();

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>
          <Settings className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
          帳號設定
        </h2>
        <p className={styles.pageSubtitle}>管理您的登入帳號與密碼</p>
      </header>

      <div className={styles.card}>
        <div className={styles.profileHeader}>
          <div className={styles.avatar} aria-hidden="true">
            {avatarChar}
          </div>
          <div className={styles.profileInfo}>
            <p className={styles.profileName}>{user.name}</p>
            <div className={styles.profileMeta}>
              <span className={styles.profileDept}>
                <Building2 className="mr-1 inline h-3.5 w-3.5 -translate-y-px" aria-hidden="true" />
                {user.department}
              </span>
              <span className={user.role === "admin" ? "chip-info" : "chip-approved"}>
                {roleLabel}
              </span>
            </div>
            <p className={styles.profileUsername}>@{user.username}</p>
          </div>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="帳號設定選項">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "username"}
            className={`${styles.tab} ${activeTab === "username" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("username")}
          >
            <AtSign className="h-4 w-4" aria-hidden="true" />
            修改帳號
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "password"}
            className={`${styles.tab} ${activeTab === "password" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("password")}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            修改密碼
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "line"}
            className={`${styles.tab} ${activeTab === "line" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("line")}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            LINE 綁定
          </button>
        </div>

        {activeTab === "username" && (
          <div className={styles.tabPanel} role="tabpanel">
            <form onSubmit={handleUsernameSubmit} className={styles.formSection}>
              <h3 className={styles.formTitle}>
                <User className="mr-1.5 inline h-4 w-4 -translate-y-px text-[var(--primary)]" aria-hidden="true" />
                修改登入帳號
              </h3>
              <p className={styles.formDesc}>變更帳號後，下次登入請使用新帳號（內部團隊免驗證密碼）</p>

              <div className={styles.fieldGroup}>
                <div>
                  <label htmlFor="username" className={styles.label}>
                    登入帳號
                  </label>
                  <input
                    id="username"
                    type="text"
                    className={`${styles.input} ${styles.inputMono}`}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                {usernameError && <p className={styles.error}>{usernameError}</p>}
              </div>

              <div className={styles.formActions}>
                <button type="submit" className="btn-primary" disabled={usernameSaving}>
                  {usernameSaving ? "儲存中..." : "儲存帳號"}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "password" && (
          <div className={styles.tabPanel} role="tabpanel">
            <form onSubmit={handlePasswordSubmit} className={styles.formSection}>
              <h3 className={styles.formTitle}>
                <Lock className="mr-1.5 inline h-4 w-4 -translate-y-px text-[var(--primary)]" aria-hidden="true" />
                修改登入密碼
              </h3>
              <p className={styles.formDesc}>建議使用至少 6 字元的安全密碼</p>

              <div className={styles.fieldGroup}>
                <div>
                  <label htmlFor="currentPassword" className={styles.label}>
                    目前密碼
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    className={styles.input}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className={styles.label}>
                    新密碼
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    className={styles.input}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                  />
                  <p className={styles.hint}>至少 6 字元</p>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className={styles.label}>
                    確認新密碼
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className={styles.input}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
                {passwordError && <p className={styles.error}>{passwordError}</p>}
              </div>

              <div className={styles.formActions}>
                <button type="submit" className="btn-primary" disabled={passwordSaving}>
                  {passwordSaving ? "儲存中..." : "儲存密碼"}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "line" && (
          <div className={styles.tabPanel} role="tabpanel">
            <div className={styles.formSection}>
              <h3 className={styles.formTitle}>
                <MessageCircle className="mr-1.5 inline h-4 w-4 -translate-y-px text-[var(--primary)]" aria-hidden="true" />
                LINE 打卡綁定
              </h3>
              <p className={styles.formDesc}>
                綁定後可在 LINE 以圖文卡片打卡，並收到上下班提醒（週末與請假期間不提醒）。
              </p>

              <div className={styles.lineSteps}>
                <p className={styles.label}>設定步驟</p>
                <ol>
                  <li>加入公司 LINE Bot 為好友</li>
                  <li>下方按「產生綁定碼」</li>
                  <li>在 LINE 對 Bot 傳送 6 位數綁定碼</li>
                  <li>綁定成功後可輸入：上班、下班、狀態、說明</li>
                </ol>
                <a
                  className={styles.lineSiteLink}
                  href={APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {APP_URL}
                </a>
              </div>

              {lineLoading ? (
                <p className={styles.hint}>載入 LINE 狀態…</p>
              ) : !lineEnabled ? (
                <p className={styles.hint}>管理員尚未設定 LINE Bot（需部署後設定環境變數）。</p>
              ) : lineBound ? (
                <div className={styles.fieldGroup}>
                  <p className={styles.successText}>✓ 已綁定 LINE，可直接在 LINE 打卡並接收提醒</p>
                  <div className={styles.formActions}>
                    <button type="button" className="btn-secondary" disabled={lineSaving} onClick={handleUnbindLine}>
                      {lineSaving ? "處理中…" : "解除綁定"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.fieldGroup}>
                  {bindCode ? (
                    <div className={styles.bindCodeBox}>
                      <p className={styles.label}>綁定碼（傳給 LINE Bot）</p>
                      <p className={styles.bindCode}>{bindCode}</p>
                      {bindExpiresAt && (
                        <p className={styles.hint}>
                          有效至 {new Date(bindExpiresAt).toLocaleString("zh-TW", { hour12: false })}
                        </p>
                      )}
                    </div>
                  ) : null}
                  {lineError && <p className={styles.error}>{lineError}</p>}
                  <div className={styles.formActions}>
                    <button type="button" className="btn-primary" disabled={lineSaving} onClick={handleGenerateBindCode}>
                      {lineSaving ? "產生中…" : bindCode ? "重新產生綁定碼" : "產生綁定碼"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="cal-toast" role="status">
          <CheckCircle2 className="h-4 w-4 text-[var(--success-l)]" />
          {toast}
        </div>
      )}
    </div>
  );
}
