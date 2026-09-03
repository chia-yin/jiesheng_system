import type { UserRole } from "@/types/attendance";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  employeeId: string;
  department: string;
}
