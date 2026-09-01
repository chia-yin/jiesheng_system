"use client";

import { useEffect, useState } from "react";
import type { AttendanceRecord, Employee } from "@/types/attendance";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function HomePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<{
    date: string;
    totalEmployees: number;
    clockedInCount: number;
    records: AttendanceRecord[];
  } | null>(null);

  async function loadData() {
    const [empRes, summaryRes] = await Promise.all([
      fetch("/api/clock"),
      fetch("/api/records?summary=today"),
    ]);

    const empData = await empRes.json();
    const summaryData = await summaryRes.json();

    setEmployees(empData.employees ?? []);
    setSummary(summaryData);
    if (!selectedId && empData.employees?.length) {
      setSelectedId(empData.employees[0].id);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleClock(type: "in" | "out") {
    if (!selectedId) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedId, type }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "打卡失敗");

      const label = type === "in" ? "上班" : "下班";
      setMessage(`${label}打卡成功：${data.record.employeeName} ${formatTime(data.record.timestamp)}`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "打卡失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">今日打卡</h2>
        <p className="mt-1 text-sm text-slate-500">
          {summary
            ? `${summary.date} · 已上班 ${summary.clockedInCount} / ${summary.totalEmployees} 人`
            : "載入中..."}
        </p>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">選擇員工</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
          >
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}（{employee.department}）
              </option>
            ))}
          </select>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => handleClock("in")}
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              上班打卡
            </button>
            <button
              onClick={() => handleClock("out")}
              disabled={loading}
              className="rounded-xl bg-blue-600 px-4 py-4 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              下班打卡
            </button>
          </div>

          {message && (
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{message}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">今日最新紀錄</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {summary?.records.length ? (
            summary.records.slice(0, 8).map((record) => (
              <div key={record.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{record.employeeName}</p>
                  <p className="text-slate-500">{record.type === "in" ? "上班" : "下班"}</p>
                </div>
                <p className="text-slate-600">{formatTime(record.timestamp)}</p>
              </div>
            ))
          ) : (
            <p className="py-6 text-sm text-slate-500">今天尚無打卡紀錄</p>
          )}
        </div>
      </section>
    </div>
  );
}
