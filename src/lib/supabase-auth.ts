import { getSupabaseAdmin, getSupabaseAnon, isSupabaseEnabled, supabaseAuthEmail } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/db";
import type { Employee } from "@/types/attendance";

export function isSupabaseAuthEnabled(): boolean {
  return isSupabaseEnabled() && process.env.USE_SUPABASE_AUTH === "true" && Boolean(process.env.SUPABASE_ANON_KEY);
}

export async function verifySupabasePassword(username: string, password: string): Promise<Employee | null> {
  if (!isSupabaseAuthEnabled()) return null;

  const sb = getSupabaseAnon();
  const email = supabaseAuthEmail(username);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error || !data.user) return null;

  const store = await getStore();
  let employee =
    store.employees.find((e) => e.supabaseUserId === data.user!.id) ??
    store.employees.find((e) => e.username === username);

  if (!employee) return null;

  if (!employee.supabaseUserId) {
    const index = store.employees.findIndex((e) => e.id === employee!.id);
    store.employees[index].supabaseUserId = data.user!.id;
    await saveStore(store);
    employee = store.employees[index];
  }

  return employee;
}

export async function syncEmployeePasswordToSupabase(employee: Employee, newPassword: string): Promise<void> {
  if (!isSupabaseAuthEnabled()) return;

  const admin = getSupabaseAdmin();
  const email = supabaseAuthEmail(employee.username);

  if (employee.supabaseUserId) {
    const { error } = await admin.auth.admin.updateUserById(employee.supabaseUserId, {
      password: newPassword,
      email,
    });
    if (error) throw new Error(`Supabase Auth 密碼更新失敗：${error.message}`);
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: newPassword,
    email_confirm: true,
    user_metadata: { employee_id: employee.id, name: employee.name },
  });

  if (error) {
    throw new Error(`Supabase Auth 建立使用者失敗：${error.message}`);
  }

  const store = await getStore();
  const index = store.employees.findIndex((e) => e.id === employee.id);
  if (index >= 0) {
    store.employees[index].supabaseUserId = data.user.id;
    await saveStore(store);
  }
}

export async function syncEmployeeUsernameToSupabase(employee: Employee, newUsername: string): Promise<void> {
  if (!isSupabaseAuthEnabled() || !employee.supabaseUserId) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(employee.supabaseUserId, {
    email: supabaseAuthEmail(newUsername),
  });
  if (error) throw new Error(`Supabase Auth 帳號更新失敗：${error.message}`);
}
