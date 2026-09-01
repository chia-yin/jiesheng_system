"use client";

import { useEffect, useState } from "react";
import type { AttendanceRecord } from "@/types/attendance";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("zh-TW");
}

export default function RecordsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadRecords(selectedDate: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/records?date=${selectedDate}`);
      const data = await res.json();
      setRecords(data.records ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords(date);
  }, [date]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">打卡紀錄</h2>
          <p className="text-sm text-slate-500">依日期查詢員工上下班紀錄</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-slate-300 px-4 py-2"
        />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">員工</th>
              <th className="px-3 py-3 font-medium">類型</th>
              <th className="px-3 py-3 font-medium">時間</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                  載入中...
                </td>
              </tr>
            ) : records.length ? (
              records.map((record) => (
                <tr key={record.id} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium">{record.employeeName}</td>
                  <td className="px-3 py-3">{record.type === "in" ? "上班" : "下班"}</td>
                  <td className="px-3 py-3 text-slate-600">{formatDateTime(record.timestamp)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                  此日期沒有紀錄
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
