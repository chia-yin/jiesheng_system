"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import type { CompanyCalendarDay } from "@/types/system";

interface TodayDecision {
  isWorkday: boolean;
  reason: string | null;
  label?: string;
}

interface TaiwanHoliday {
  date: string;
  name: string;
}

export default function AdminCompanyCalendarPage() {
  const [year, setYear] = useState(2026);
  const [companyDays, setCompanyDays] = useState<CompanyCalendarDay[]>([]);
  const [taiwanHolidays, setTaiwanHolidays] = useState<TaiwanHoliday[]>([]);
  const [today, setToday] = useState("");
  const [todayDecision, setTodayDecision] = useState<TodayDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [formDate, setFormDate] = useState("");
  const [formKind, setFormKind] = useState<"holiday" | "workday">("holiday");
  const [formName, setFormName] = useState("");

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/company-calendar?year=${y}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "載入失敗");
      setCompanyDays(json.companyDays ?? []);
      setTaiwanHolidays(json.taiwanHolidays ?? []);
      setToday(json.today ?? "");
      setTodayDecision(json.todayDecision ?? null);
      setYear(json.year ?? y);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(year);
  }, [load, year]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/company-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formDate,
          kind: formKind,
          name: formName.trim() || (formKind === "workday" ? "公司補班" : "公司放假"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "儲存失敗");
      setCompanyDays(json.companyDays ?? []);
      setMessage("已儲存公司日曆覆寫");
      setFormDate("");
      setFormName("");
      await load(year);
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(date: string) {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/company-calendar?date=${encodeURIComponent(date)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "刪除失敗");
      setCompanyDays(json.companyDays ?? []);
      setMessage("已刪除覆寫");
      await load(year);
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setSaving(false);
    }
  }

  const todayHint = todayDecision
    ? todayDecision.isWorkday
      ? `今天 ${today} 視為工作日${todayDecision.label ? `（${todayDecision.label}）` : ""}，會發送打卡提醒`
      : `今天 ${today} 不提醒：${todayDecision.label ?? todayDecision.reason}`
    : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
          <CalendarDays className="h-5 w-5 text-[var(--primary)]" />
          休假日設定
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          內建台灣國定假日／補假；可另設公司放假或補班。優先順序：公司覆寫 → 國定假日 → 週末。
        </p>
      </header>

      {todayHint && (
        <div className="rounded-xl border border-[var(--line)] bg-slate-50 px-4 py-3 text-sm text-[var(--ink)]">
          {todayHint}
        </div>
      )}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <section className="card space-y-4 p-6">
        <h3 className="text-base font-bold text-[var(--ink)]">新增公司覆寫</h3>
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">日期</label>
            <input
              type="date"
              className="input-field w-full"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">類型</label>
            <select
              className="input-field w-full"
              value={formKind}
              onChange={(e) => setFormKind(e.target.value as "holiday" | "workday")}
            >
              <option value="holiday">放假（不提醒）</option>
              <option value="workday">補班（仍提醒）</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">名稱</label>
            <input
              className="input-field w-full"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={formKind === "workday" ? "例如：專案趕工補班" : "例如：公司尾牙放假"}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary gap-1" disabled={saving || !formDate}>
              <Plus className="h-3.5 w-3.5" />
              {saving ? "儲存中…" : "新增／覆寫"}
            </button>
          </div>
        </form>

        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">已設定的公司日</p>
          {companyDays.length === 0 ? (
            <p className="text-sm text-[var(--faint)]">尚無公司覆寫</p>
          ) : (
            <ul className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
              {companyDays.map((d) => (
                <li key={d.date} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-[var(--ink)]">{d.date}</span>
                    <span className="ml-2 text-[var(--muted)]">
                      {d.kind === "workday" ? "補班" : "放假"} · {d.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-[var(--faint)] hover:text-[var(--danger)]"
                    onClick={() => handleDelete(d.date)}
                    disabled={saving}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    刪除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card space-y-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-[var(--ink)]">內建國定假日（唯讀）</h3>
          <select
            className="input-field w-auto text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>
        <p className="text-xs text-[var(--muted)]">
          依人事總處辦公日曆；若公司規則不同，請用上方「公司覆寫」調整。
        </p>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">載入中…</p>
        ) : taiwanHolidays.length === 0 ? (
          <p className="text-sm text-[var(--faint)]">此年尚無內建資料（可先用公司覆寫）</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {taiwanHolidays.map((h) => (
              <li key={h.date} className="flex gap-3 text-[var(--ink)]">
                <span className="w-28 shrink-0 font-mono text-[var(--muted)]">{h.date}</span>
                <span>{h.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
