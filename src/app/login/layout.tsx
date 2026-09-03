import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "登入 — 杰勝科技管理系統",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100dvh", background: "#f8fafc" }}>{children}</div>;
}
