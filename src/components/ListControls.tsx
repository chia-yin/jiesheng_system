"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthLabel, shiftMonth, currentMonth, type SortOrder } from "@/lib/list-utils";

interface ListControlsProps {
  month: string | null;
  onMonthChange: (month: string | null) => void;
  totalCount: number;
  page?: number;
  totalPages?: number;
  sortOrder?: SortOrder;
  onSortChange?: (order: SortOrder) => void;
  showMonthFilter?: boolean;
  showSort?: boolean;
  className?: string;
}

function recentMonths(count = 24): string[] {
  const months: string[] = [];
  let m = currentMonth();
  for (let i = 0; i < count; i++) {
    months.push(m);
    m = shiftMonth(m, -1);
  }
  return months;
}

export function ListControls({
  month,
  onMonthChange,
  totalCount,
  page,
  totalPages,
  sortOrder = "desc",
  onSortChange,
  showMonthFilter = true,
  showSort = true,
  className = "",
}: ListControlsProps) {
  const monthOptions = recentMonths();

  function handlePrevMonth() {
    const base = month ?? currentMonth();
    onMonthChange(shiftMonth(base, -1));
  }

  function handleNextMonth() {
    const base = month ?? currentMonth();
    onMonthChange(shiftMonth(base, 1));
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        {showMonthFilter && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
              aria-label="上個月"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white/60 px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
              <select
                value={month ?? ""}
                onChange={(e) => onMonthChange(e.target.value || null)}
                className="max-w-[8rem] cursor-pointer bg-transparent text-sm font-medium text-[var(--ink)] outline-none sm:max-w-none"
              >
                <option value="">全部月份</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
              aria-label="下個月"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {showSort && onSortChange && (
          <select
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value as SortOrder)}
            className="input-field w-auto py-1.5 text-sm"
          >
            <option value="desc">最新優先</option>
            <option value="asc">最舊優先</option>
          </select>
        )}
      </div>

      <p className="text-sm text-[var(--muted)]">
        共 <span className="font-medium text-[var(--ink)]">{totalCount}</span> 筆
        {totalPages && totalPages > 1 && page && (
          <span>
            ，第 {page} / {totalPages} 頁
          </span>
        )}
      </p>
    </div>
  );
}
