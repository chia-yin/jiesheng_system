import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "杰升考勤系統",
  description: "公司簡易打卡考勤系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div>
              <p className="text-sm font-medium text-blue-600">杰升系統</p>
              <h1 className="text-xl font-semibold">考勤打卡</h1>
            </div>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="text-slate-600 hover:text-slate-900">
                打卡
              </a>
              <a href="/records" className="text-slate-600 hover:text-slate-900">
                紀錄
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
