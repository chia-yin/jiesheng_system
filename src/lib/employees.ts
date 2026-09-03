import type { Employee } from "@/types/attendance";
import { getStore, newId, saveStore } from "@/lib/db";
import { toPublicEmployee } from "@/lib/auth";
import {
  isSupabaseAuthEnabled,
  syncEmployeePasswordToSupabase,
  syncEmployeeUsernameToSupabase,
  verifySupabasePassword,
} from "@/lib/supabase-auth";

export async function listEmployees() {
  const store = await getStore();
  return store.employees.map(toPublicEmployee);
}

export async function getEmployeeById(id: string) {
  const store = await getStore();
  const employee = store.employees.find((e) => e.id === id);
  return employee ? toPublicEmployee(employee) : null;
}

export async function createEmployee(data: Omit<Employee, "id">) {
  const store = await getStore();

  if (store.employees.some((e) => e.username === data.username)) {
    throw new Error("帳號已存在");
  }
  if (data.email && store.employees.some((e) => e.email?.toLowerCase() === data.email!.toLowerCase())) {
    throw new Error("Google Email 已存在");
  }

  const employee: Employee = { ...data, id: newId("emp") };
  store.employees.push(employee);
  await saveStore(store);
  return toPublicEmployee(employee);
}

export async function updateEmployee(id: string, data: Partial<Omit<Employee, "id">>) {
  const store = await getStore();
  const index = store.employees.findIndex((e) => e.id === id);
  if (index === -1) throw new Error("找不到員工");

  if (data.username && store.employees.some((e) => e.username === data.username && e.id !== id)) {
    throw new Error("帳號已存在");
  }
  if (data.email && store.employees.some((e) => e.email?.toLowerCase() === data.email!.toLowerCase() && e.id !== id)) {
    throw new Error("Google Email 已存在");
  }

  store.employees[index] = { ...store.employees[index], ...data };
  await saveStore(store);
  return toPublicEmployee(store.employees[index]);
}

export interface UpdateProfileInput {
  username?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

/** 登入使用者自行更新帳號或密碼 */
export async function updateProfile(employeeId: string, input: UpdateProfileInput) {
  const store = await getStore();
  const index = store.employees.findIndex((e) => e.id === employeeId);
  if (index === -1) throw new Error("找不到員工");

  const employee = store.employees[index];
  const wantsUsernameChange =
    input.username !== undefined && input.username.trim() !== employee.username;
  const wantsPasswordChange = Boolean(input.newPassword);

  if (!wantsUsernameChange && !wantsPasswordChange) {
    throw new Error("沒有需要更新的內容");
  }

  // 內部小團隊：改帳號僅需登入；改密碼仍須驗證目前密碼
  if (wantsPasswordChange) {
    if (!input.currentPassword) {
      throw new Error("請輸入目前密碼");
    }
    const passwordOk = isSupabaseAuthEnabled()
      ? Boolean(await verifySupabasePassword(employee.username, input.currentPassword)) ||
        employee.password === input.currentPassword
      : employee.password === input.currentPassword;
    if (!passwordOk) {
      throw new Error("目前密碼不正確");
    }
  }

  const updates: Partial<Employee> = {};

  if (wantsUsernameChange) {
    const username = input.username!.trim();
    if (!username) throw new Error("帳號不可為空");
    if (store.employees.some((e) => e.username === username && e.id !== employeeId)) {
      throw new Error("帳號已存在");
    }
    updates.username = username;
  }

  if (wantsPasswordChange) {
    const newPassword = input.newPassword!;
    if (newPassword.length < 6) {
      throw new Error("新密碼至少 6 字元");
    }
    if (newPassword !== input.confirmPassword) {
      throw new Error("新密碼與確認密碼不一致");
    }
    updates.password = newPassword;
  }

  store.employees[index] = { ...employee, ...updates };
  await saveStore(store);

  const updated = store.employees[index];
  if (isSupabaseAuthEnabled()) {
    if (updates.password) {
      await syncEmployeePasswordToSupabase(updated, updates.password);
    }
    if (updates.username) {
      await syncEmployeeUsernameToSupabase(updated, updates.username);
    }
  }

  return toPublicEmployee(updated);
}

export async function deleteEmployee(id: string) {
  const store = await getStore();
  const employee = store.employees.find((e) => e.id === id);
  if (!employee) throw new Error("找不到員工");
  if (employee.role === "admin" && store.employees.filter((e) => e.role === "admin").length <= 1) {
    throw new Error("無法刪除最後一位管理員");
  }

  store.employees = store.employees.filter((e) => e.id !== id);
  await saveStore(store);
  return { ok: true };
}
