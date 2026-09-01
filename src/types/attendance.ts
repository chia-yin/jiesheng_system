export type ClockType = "in" | "out";

export interface Employee {
  id: string;
  name: string;
  department: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: ClockType;
  timestamp: string;
  note?: string;
}

export interface AttendanceStore {
  employees: Employee[];
  records: AttendanceRecord[];
}
