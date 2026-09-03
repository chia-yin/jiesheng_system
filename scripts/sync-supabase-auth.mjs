/**
 * 階段 3：將 employees 同步至 Supabase Auth（不影響 LINE 綁定）
 * 用法：SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-supabase-auth.mjs
 */
import { readFile, access } from "fs/promises";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "data", "system.json");
const EMAIL_DOMAIN = process.env.SUPABASE_AUTH_EMAIL_DOMAIN ?? "users.jiesheng.internal";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("請設定 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

function authEmail(username) {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

async function loadEmployees() {
  if (process.env.USE_JSON_EMPLOYEES === "true") {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw).employees ?? [];
  }

  const { data, error } = await sb.from("employees").select("*");
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    username: e.username,
    password: e.password,
    name: e.name,
    supabaseUserId: e.supabase_user_id,
  }));
}

async function main() {
  let employees;
  try {
    employees = await loadEmployees();
  } catch (err) {
    if (err.code === "ENOENT") {
      const { data, error } = await sb.from("employees").select("*");
      if (error) throw error;
      employees = (data ?? []).map((e) => ({
        id: e.id,
        username: e.username,
        password: e.password,
        name: e.name,
        supabaseUserId: e.supabase_user_id,
      }));
    } else {
      throw err;
    }
  }

  console.log(`同步 ${employees.length} 位員工至 Supabase Auth…`);

  for (const emp of employees) {
    if (!emp.username || !emp.password) {
      console.log(`  略過 ${emp.id}（無帳密）`);
      continue;
    }

    const email = authEmail(emp.username);

    if (emp.supabaseUserId) {
      const { error } = await sb.auth.admin.updateUserById(emp.supabaseUserId, {
        email,
        password: emp.password,
        email_confirm: true,
        user_metadata: { employee_id: emp.id, name: emp.name },
      });
      if (error) {
        console.error(`  ✗ 更新 ${emp.username}: ${error.message}`);
        continue;
      }
      console.log(`  ↻ 更新 ${emp.username}`);
      continue;
    }

    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: emp.password,
      email_confirm: true,
      user_metadata: { employee_id: emp.id, name: emp.name },
    });

    if (error) {
      if (error.message.includes("already been registered")) {
        const { data: list } = await sb.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email === email);
        if (existing) {
          await sb.from("employees").update({ supabase_user_id: existing.id }).eq("id", emp.id);
          console.log(`  ↔ 已存在，寫入 supabase_user_id：${emp.username}`);
        } else {
          console.error(`  ✗ 建立 ${emp.username}: ${error.message}`);
        }
        continue;
      }
      console.error(`  ✗ 建立 ${emp.username}: ${error.message}`);
      continue;
    }

    await sb.from("employees").update({ supabase_user_id: data.user.id }).eq("id", emp.id);
    console.log(`  ✓ 建立 ${emp.username}`);
  }

  console.log("✅ Auth 同步完成。請在 Netlify 設定 USE_SUPABASE_AUTH=true");
}

main().catch((err) => {
  console.error("❌", err.message ?? err);
  process.exit(1);
});
