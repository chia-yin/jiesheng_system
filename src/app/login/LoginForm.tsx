"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Lock, ShieldCheck, User } from "lucide-react";
import styles from "./login.module.css";

const INPUT_ICON_PADDING = "2.5rem";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const googleError = searchParams.get("google_error");
    if (googleError) setError(decodeURIComponent(googleError));
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "登入失敗");

      const from = searchParams.get("from") || "/";
      router.push(from);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    const from = searchParams.get("from") || "/";
    window.location.href = `/api/auth/google/login?from=${encodeURIComponent(from)}`;
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.brand}>
          <Image
            src="/logo-jiesheng.png"
            alt="杰勝科技 JIE-SHENG TECHNOLOGY"
            width={240}
            height={240}
            className={styles.logo}
            priority
          />
        </div>

        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h1 className={styles.panelTitle}>登入</h1>
          </div>

          <button type="button" onClick={handleGoogleLogin} className={styles.googleBtn}>
            <GoogleIcon />
            Google 帳號登入
          </button>

          <p className={styles.divider}>
            <span>或</span>
          </p>

          <form onSubmit={handleSubmit}>
            <div className={styles.fieldGroup}>
              <div>
                <label className={styles.label} htmlFor="login-username">
                  帳號
                </label>
                <div className={styles.inputWrap}>
                  <User className={styles.icon} aria-hidden="true" />
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={styles.input}
                    style={{ paddingLeft: INPUT_ICON_PADDING }}
                    placeholder="請輸入帳號"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
              <div>
                <label className={styles.label} htmlFor="login-password">
                  密碼
                </label>
                <div className={styles.inputWrap}>
                  <Lock className={styles.icon} aria-hidden="true" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.input}
                    style={{ paddingLeft: INPUT_ICON_PADDING }}
                    placeholder="請輸入密碼"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} className={styles.submit}>
              {loading ? "登入中..." : "登入"}
            </button>
          </form>

          <p className={styles.secureNote}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            僅限授權員工
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
