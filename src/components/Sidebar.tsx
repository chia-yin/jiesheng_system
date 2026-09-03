"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  Building2,
  Calendar,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FolderKanban,
  LayoutDashboard,
  Megaphone,
  Menu,
  Plug,
  Rocket,
  Settings,
  Users,
} from "lucide-react";
import type { SessionUser } from "@/types/auth";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "全公司",
    items: [
      { href: "/", label: "儀表板", icon: LayoutDashboard },
      { href: "/announcements", label: "公告欄", icon: Megaphone },
      { href: "/calendar", label: "公司行事曆", icon: Calendar },
    ],
  },
  {
    title: "我的",
    items: [
      { href: "/attendance", label: "打卡", icon: Clock },
      { href: "/leave", label: "請假申請", icon: CalendarOff },
      { href: "/records", label: "打卡紀錄", icon: ClipboardList },
      { href: "/settings", label: "帳號設定", icon: Settings },
    ],
  },
  {
    title: "專案",
    items: [
      { href: "/projects", label: "專案管理", icon: FolderKanban },
      { href: "/sprints", label: "本週 Sprint", icon: Rocket },
    ],
  },
  {
    title: "管理",
    items: [
      { href: "/admin/employees", label: "員工管理", icon: Users, adminOnly: true },
      { href: "/admin/integrations", label: "整合設定", icon: Plug, adminOnly: true },
    ],
  },
];

export function Sidebar({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState(0);

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const fetchPending = () => {
      fetch("/api/notifications/pending")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setPendingLeaves(data.pendingLeaves ?? 0);
        })
        .catch(() => {});
    };

    fetchPending();
    const timer = setInterval(fetchPending, 30000);
    return () => clearInterval(timer);
  }, [user, pathname]);

  if (!user) return null;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-700/50 bg-[var(--sidebar)] text-[var(--sidebar-text)] transition-all duration-200 lg:static ${
          collapsed ? "w-[62px]" : "w-[236px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-[58px] items-center gap-2.5 border-b border-white/10 px-4">
          <Building2 className="h-5 w-5 shrink-0 text-[var(--primary)]" />
          {!collapsed && (
            <div>
              <p className="text-sm font-bold tracking-wide text-white">杰勝科技</p>
              <p className="font-mono text-[10px] text-[var(--sidebar-muted)]">v0.3</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.adminOnly || user.role === "admin");
            if (!items.length) return null;
            return (
              <div key={group.title}>
                {!collapsed && (
                  <p className="px-[18px] pb-1.5 pt-3.5 text-[10px] font-bold tracking-[2px] text-[var(--sidebar-muted)]">
                    {group.title}
                  </p>
                )}
                {items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`relative flex items-center gap-3 border-l-2 px-[18px] py-2.5 text-[13.5px] transition ${
                        active
                          ? "border-[var(--primary)] bg-[var(--primary)]/15 text-white"
                          : "border-transparent text-[var(--sidebar-text)] hover:bg-white/8"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex flex-1 items-center justify-between">
                          {item.label}
                          {item.href === "/leave" && user.role === "admin" && pendingLeaves > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                              {pendingLeaves > 9 ? "9+" : pendingLeaves}
                            </span>
                          )}
                        </span>
                      )}
                      {collapsed && item.href === "/leave" && user.role === "admin" && pendingLeaves > 0 && (
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <button
        type="button"
        className="fixed left-3 top-3 z-50 rounded-lg bg-white p-2 shadow lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="開啟選單"
      >
        <Menu className="h-5 w-5 text-[var(--ink)]" />
      </button>
      <button
        type="button"
        className="hidden rounded-lg p-2 text-[var(--muted)] hover:bg-black/5 lg:fixed lg:left-[200px] lg:top-3 lg:z-50 lg:block"
        onClick={() => setCollapsed((v) => !v)}
        aria-label="收合側欄"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </>
  );
}
