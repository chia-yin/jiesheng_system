export const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;

export interface DayCell {
  date: string;
  day: number;
  inMonth: boolean;
  isWeekend: boolean;
}

export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseMonthKey(month: string): { year: number; month: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y, month: m };
}

export function getMonthGrid(year: number, month: number): DayCell[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();
  const cells: DayCell[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    const dow = new Date(y, m - 1, day).getDay();
    cells.push({ date: toDateStr(y, m, day), day, inMonth: false, isWeekend: dow === 0 || dow === 6 });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    cells.push({ date: toDateStr(year, month, d), day: d, inMonth: true, isWeekend: dow === 0 || dow === 6 });
  }

  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    const dow = new Date(y, m - 1, d).getDay();
    cells.push({ date: toDateStr(y, m, d), day: d, inMonth: false, isWeekend: dow === 0 || dow === 6 });
  }

  return cells;
}
