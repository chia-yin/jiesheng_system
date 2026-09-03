"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import type { SessionUser } from "@/types/auth";

const TITLES: Record<string, string> = {
  "/": "儀表板",
  "/attendance": "打卡",
  "/leave": "請假申請",
  "/records": "打卡紀錄",
  "/settings": "帳號設定",
  "/announcements": "公告欄",
  "/projects": "專案管理",
  "/sprints": "本週 Sprint",
  "/calendar": "公司行事曆",
  "/admin/employees": "員工管理",
  "/admin/integrations": "整合設定",
};

export function TopBar({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const title =
    TITLES[pathname] ??
    (pathname.startsWith("/projects/") ? "專案詳情" : "杰勝科技");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initial = user.name.slice(0, 1);
  const roleLabel = user.role === "admin" ? "管理員" : "員工";

  return (
    <header className="flex h-[58px] items-center gap-4 border-b border-[var(--line)] bg-white px-6">
      <h1 className="text-[15px] font-semibold tracking-wide text-[var(--ink)]">{title}</h1>
      <div className="flex-1" />
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-[var(--bg)]"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold text-[var(--ink)]">{user.name}</p>
            <p className="text-[10.5px] text-[var(--muted)]">
              {roleLabel} · {user.department}
            </p>
          </div>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white ${
              user.role === "admin" ? "bg-[var(--brown-l)]" : "bg-[var(--primary)]"
            }`}
          >
            {initial}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-[var(--muted)] transition ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-[var(--line)] bg-white py-1 shadow-lg"
            role="menu"
          >
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--ink)] transition hover:bg-[var(--bg)]"
              role="menuitem"
            >
              <Settings className="h-4 w-4 text-[var(--muted)]" />
              帳號設定
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[var(--danger)] transition hover:bg-red-50"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
