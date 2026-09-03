/** 預設一週：起日共 7 天（含當天） */
export function defaultSprintRange(from?: string) {
  const start =
    from ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  const [y, m, d] = start.split("-").map(Number);
  const endDateObj = new Date(y, m - 1, d);
  endDateObj.setDate(endDateObj.getDate() + 6);
  const endDate = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, "0")}-${String(endDateObj.getDate()).padStart(2, "0")}`;
  return { startDate: start, endDate };
}

export function formatSprintWeekLabel(startDate: string, endDate: string): string {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${Number(m)}/${Number(d)}`;
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}
