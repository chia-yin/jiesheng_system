import { promises as fs } from "fs";
import path from "path";
import type { AttendanceRecord, AttendanceStore, ClockType } from "@/types/attendance";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "attendance.json");

const DEFAULT_STORE: AttendanceStore = {
  employees: [
    { id: "emp-001", name: "王小明", department: "業務部" },
    { id: "emp-002", name: "李小華", department: "行政部" },
    { id: "emp-003", name: "張大同", department: "技術部" },
  ],
  records: [],
};

async function ensureStore(): Promise<AttendanceStore> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as AttendanceStore;
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_STORE, null, 2), "utf-8");
    return DEFAULT_STORE;
  }
}

async function saveStore(store: AttendanceStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export async function getEmployees() {
  const store = await ensureStore();
  return store.employees;
}

export async function getRecords(date?: string) {
  const store = await ensureStore();

  if (!date) {
    return store.records;
  }

  return store.records.filter((record) => record.timestamp.startsWith(date));
}

export async function clockInOut(employeeId: string, type: ClockType, note?: string) {
  const store = await ensureStore();
  const employee = store.employees.find((item) => item.id === employeeId);

  if (!employee) {
    throw new Error("找不到員工");
  }

  const record: AttendanceRecord = {
    id: `rec-${Date.now()}`,
    employeeId: employee.id,
    employeeName: employee.name,
    type,
    timestamp: new Date().toISOString(),
    note,
  };

  store.records.unshift(record);
  await saveStore(store);

  return record;
}

export async function getTodaySummary(date = new Date().toISOString().slice(0, 10)) {
  const records = await getRecords(date);
  const clockedIn = new Set(records.filter((r) => r.type === "in").map((r) => r.employeeId));

  return {
    date,
    totalEmployees: (await getEmployees()).length,
    clockedInCount: clockedIn.size,
    records,
  };
}
