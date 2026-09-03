export const PAGE_SIZE = 10;

export type SortOrder = "desc" | "asc";

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function matchesMonth(dateStr: string, month: string | null): boolean {
  if (!month) return true;
  return getMonthKey(dateStr) === month;
}

export function matchesMonthAny(dates: string[], month: string | null): boolean {
  if (!month) return true;
  return dates.some((d) => matchesMonth(d, month));
}

export function sortByDate<T>(
  items: T[],
  getDate: (item: T) => string,
  order: SortOrder = "desc"
): T[] {
  return [...items].sort((a, b) => {
    const diff = new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime();
    return order === "desc" ? diff : -diff;
  });
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    totalCount,
    totalPages,
    page: safePage,
  };
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function useListPipeline<T>(
  items: T[],
  options: {
    month: string | null;
    getDates: (item: T) => string[];
    getSortDate: (item: T) => string;
    sortOrder: SortOrder;
    page: number;
    pageSize?: number;
  }
) {
  const { month, getDates, getSortDate, sortOrder, page, pageSize = PAGE_SIZE } = options;

  const filtered = items.filter((item) => matchesMonthAny(getDates(item), month));
  const sorted = sortByDate(filtered, getSortDate, sortOrder);
  const result = paginate(sorted, page, pageSize);

  return { ...result, filteredCount: filtered.length };
}
